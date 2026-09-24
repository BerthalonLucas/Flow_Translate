import { test, expect, type Page } from '@playwright/test';
import { ilotRegion, ilotReserve } from '../src/layout';

// Lot 9: the pill's place after Rust's own paste (docs/BRIDGE.md « The pill's place », « Moving
// the window »), over the IPC fixture (e2e/native-fixture.ts), which answers `result_pill` as Rust
// places it (under the new text's last line, above it without room, in the margin) relative to the
// window, and records each `move_overlay` with what the page showed then. The pill leaves the
// selection's old end for its place, never over the new text: in the DOM when the place is in the
// window (every frame in the region Rust holds), else the window moves once, at rest, the pill
// faded out. Synthetic texts and rectangles: a browser run, not the Windows window.
type Call = { command: string; args?: Record<string, unknown>; at: number };
type Box = { x: number; y: number; width: number; height: number };
type Region = Box & { radius: number };
type Geometry = { width: number; height: number; captureId: string; presentation: string; regions: Region[]; frame: Region };
type Move = { dx: number; dy: number; at: number; opacity: string; shape: { width: number; height: number } | null };
type Fixture = {
  calls: Call[];
  moves: Move[];
  settings: (next: Record<string, unknown>) => Promise<void>;
  captureMenu: (id: string, lastActionId?: string | null, text?: string) => Promise<void>;
  unanchoredMenu: (id: string, lastActionId?: string | null) => Promise<void>;
  done: (text?: string) => Promise<void>;
  error: (code?: string, message?: string) => Promise<void>;
  pasted: (options?: { undoable?: boolean; pastedRects?: Box[] }) => Promise<void>;
  undoState: (reason?: string, requestId?: string) => Promise<void>;
  pillAnswer: (answer: Record<string, unknown> | 'refuse') => void;
  refuseMove: () => void;
  windowPosition: () => { x: number; y: number };
  requestId: () => string;
};
const fixture = (page: Page) => ({
  run: <T>(run: (fixture: Fixture) => T | Promise<T>) => page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<T>,
  with: <A, T>(run: (fixture: Fixture, arg: A) => T | Promise<T>, arg: A) => page.evaluate(({ source, arg }) => new Function('fixture', 'arg', `return (${source})(fixture, arg)`)((window as unknown as { nativeFixture: Fixture }).nativeFixture, arg), { source: run.toString(), arg }) as Promise<T>,
});
const calls = (page: Page, command: string) => page.evaluate(name => (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(call => call.command === name).map(call => call.args ?? {}), command);
const geometries = async (page: Page, captureId: string) => (await calls(page, 'resize_overlay') as Geometry[]).filter(geometry => geometry.captureId === captureId);
const moves = (page: Page) => fixture(page).run(f => f.moves.map(move => ({ ...move })));
const stage = (page: Page) => page.locator('.ilot-stage');
const box = (page: Page) => page.locator('[data-ilot-shape]').evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const sameSurface = (page: Page) => page.locator('[data-ilot-shape]').evaluate(element => (element as HTMLElement & { tag?: string }).tag === 'surface');
const opacity = (page: Page) => page.locator('.ilot-corner').evaluate(element => getComputedStyle(element).opacity);
const inside = (shape: Box, region: Region) => shape.x >= region.x - 1 && shape.y >= region.y - 1 && shape.x + shape.width <= region.x + region.width + 1 && shape.y + shape.height <= region.y + region.height + 1;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function openIlot(page: Page, settings: Record<string, unknown> = {}, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1');
  await expect(page.locator('.glass-overlay')).toBeVisible();
  await page.evaluate(next => (window as unknown as { nativeFixture: Fixture }).nativeFixture.settings({ uiVersion: 'ilot', ...next }), settings);
}
async function settled(page: Page) {
  await expect.poll(async () => { const a = await box(page); await page.waitForTimeout(80); const b = await box(page); return JSON.stringify(a) === JSON.stringify(b); }).toBe(true);
}
// A menu capture chosen with Enter, the model's result, the work pill at rest on the Îlot's
// surface (tagged, to tell it is the same element later).
async function working(page: Page, id: string, anchored = true) {
  if (anchored) await page.evaluate(id => (window as unknown as { nativeFixture: Fixture }).nativeFixture.captureMenu(id, null, 'Their going too the store'), id);
  else await page.evaluate(id => (window as unknown as { nativeFixture: Fixture }).nativeFixture.unanchoredMenu(id), id);
  await expect(stage(page)).toHaveAttribute('data-capture-id', id);
  await expect(stage(page)).toHaveAttribute('data-stage', 'menu');
  await page.locator('[data-ilot-shape]').evaluate(element => { (element as HTMLElement & { tag?: string }).tag = 'surface'; });
  await page.keyboard.press('Enter');
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await fixture(page).run(f => f.done('They are going to the store'));
  await settled(page);
}
// Every frame for `ms` after `act`: the painted shape, the corner's opacity, the geometry Rust
// last received, on the page's clock.
type Frame = { t: number; shape: Box; opacity: number; geometry: Geometry };
async function follow(page: Page, captureId: string, act: () => Promise<unknown>, ms = 1400) {
  const frames = page.evaluate(({ captureId, ms }) => new Promise<Frame[]>(resolve => {
    const out: Frame[] = [];
    const start = performance.now();
    const tick = () => {
      const element = document.querySelector('[data-ilot-shape]');
      const corner = document.querySelector('.ilot-corner');
      const shape = element?.getBoundingClientRect();
      const geometry = (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(call => call.command === 'resize_overlay' && call.args?.captureId === captureId).at(-1)?.args as Geometry;
      if (shape && corner) out.push({ t: performance.now(), shape: { x: shape.x, y: shape.y, width: shape.width, height: shape.height }, opacity: Number(getComputedStyle(corner).opacity), geometry });
      if (performance.now() - start < ms) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }), { captureId, ms });
  await act();
  return frames;
}
const paste = (page: Page, pastedRects: Box[]) => fixture(page).with((f, rects) => f.pasted({ pastedRects: rects }), pastedRects);
test.describe.configure({ timeout: 45_000 });

const reserve = ilotReserve('anchored');
const cornerX = reserve.frame.x + reserve.frame.width;
// The fixture's window: Rust put it at (88, 222), the strip's corner on the selection's end (520, 318 + 8).
const origin = { x: 88, y: 222 };
const inWindow = (rect: Box) => ({ ...rect, x: rect.x - origin.x, y: rect.y - origin.y });

test('a longer text: the pill glides in the DOM to 8 px under the new text’s last line, its right edge on that line’s end, never over it; every frame in the region, the window never moves', async ({ page }) => {
  await openIlot(page);
  await working(page, 'glide');
  const start = await box(page);
  expect(start.x + start.width).toBeCloseTo(cornerX, 0);
  // Two lines now, the last ending at x = 560, its bottom at y = 336.
  const lines = [{ x: 300, y: 300, width: 420, height: 18 }, { x: 300, y: 318, width: 260, height: 18 }];
  const frames = await follow(page, 'glide', () => paste(page, lines));
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const pill = await box(page);
  const requestId = await fixture(page).run(f => f.requestId());
  // Asked once, for the size of the check's pill.
  expect(await calls(page, 'result_pill')).toEqual([{ requestId, width: pill.width, height: pill.height }]);
  // At its place: right edge on 560 − 88, top 336 + 8 − 222; clear of every line of the new text.
  expect(pill.x + pill.width).toBeCloseTo(560 - origin.x, 0);
  expect(pill.y).toBeCloseTo(336 + 8 - origin.y, 0);
  for (const line of lines) expect(overlaps(pill, inWindow(line)), JSON.stringify(line)).toBe(false);
  expect((await geometries(page, 'glide')).at(-1)?.regions).toEqual([ilotRegion('anchored', 'below', { width: pill.width, height: pill.height, shift: 40, dy: 18 })]);
  // Every frame lies in the region Rust holds at that frame; the glide is seen on its way.
  expect(frames.length).toBeGreaterThan(20);
  for (const frame of frames) expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  expect(frames.filter(frame => frame.shape.x + frame.shape.width > cornerX + 2 && frame.shape.x + frame.shape.width < 560 - origin.x - 2).length).toBeGreaterThan(3);
  expect(frames.every(frame => frame.opacity === 1)).toBe(true);
  // The window stayed: no move, the same reserve and frame in every geometry; the same surface.
  expect(await moves(page)).toEqual([]);
  expect(await calls(page, 'move_overlay')).toEqual([]);
  for (const geometry of await geometries(page, 'glide')) expect(geometry).toMatchObject({ width: reserve.width, height: reserve.height, frame: reserve.frame });
  expect(await sameSurface(page)).toBe(true);

  // Undo withdrawn there: the check alone keeps that place's corner, frame after frame.
  const withdrawn = await follow(page, 'glide', () => fixture(page).run(f => f.undoState('typed')), 900);
  await settled(page);
  const check = await box(page);
  expect(check.width).toBeLessThan(pill.width);
  for (const frame of withdrawn) {
    expect(Math.abs(frame.shape.x + frame.shape.width - (pill.x + pill.width)), JSON.stringify(frame)).toBeLessThan(0.5);
    expect(Math.abs(frame.shape.y - pill.y), JSON.stringify(frame)).toBeLessThan(0.5);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(await calls(page, 'result_pill')).toHaveLength(1);
});

test('the check alone (no Undo) keeps the work pill’s size, and still goes to its place', async ({ page }) => {
  await openIlot(page);
  await working(page, 'check');
  const work = await box(page);
  const lines = [{ x: 300, y: 300, width: 420, height: 18 }, { x: 300, y: 318, width: 260, height: 18 }];
  await fixture(page).with((f, rects) => f.pasted({ undoable: false, pastedRects: rects }), lines);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect(page.locator('[data-result-content="done"]')).toHaveClass(/is-check-only/);
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(1);
  await settled(page);
  const pill = await box(page);
  expect({ width: pill.width, height: pill.height }).toEqual({ width: work.width, height: work.height });
  expect((await calls(page, 'result_pill'))[0]).toMatchObject({ width: work.width, height: work.height });
  expect(pill.x + pill.width).toBeCloseTo(560 - origin.x, 0);
  expect(pill.y).toBeCloseTo(336 + 8 - origin.y, 0);
  expect(await calls(page, 'move_overlay')).toEqual([]);
});

test('a place outside the window: once the shape rests the pill fades out, the window moves once, Rust answers again for it, and the pill fades back in there', async ({ page }) => {
  await openIlot(page);
  await working(page, 'far');
  // Twelve lines: the last ends at x = 700, its bottom at y = 516: out of the 581 × 264 window.
  const lines = Array.from({ length: 12 }, (_, index) => ({ x: 100, y: 300 + 18 * index, width: 600, height: 18 }));
  const frames = await follow(page, 'far', () => paste(page, lines), 1800);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(2);
  await settled(page);
  await expect.poll(() => opacity(page)).toBe('1');
  const pill = await box(page);
  const requestId = await fixture(page).run(f => f.requestId());
  // The window moved by what puts the pill's corner on 700 and its top on 516 + 8.
  const dx = 700 - origin.x - cornerX, dy = 516 + 8 - origin.y - reserve.frame.y;
  expect(await calls(page, 'move_overlay')).toEqual([{ captureId: 'far', dx, dy }]);
  expect(await fixture(page).run(f => f.windowPosition())).toEqual({ x: origin.x + dx, y: origin.y + dy });
  expect(await calls(page, 'result_pill')).toEqual([{ requestId, width: pill.width, height: pill.height }, { requestId, width: pill.width, height: pill.height }]);
  // Never while anything moved: at that moment the pill was invisible and at rest, its shape final.
  const [move] = await moves(page);
  expect(move.opacity).toBe('0');
  expect(move.shape).toEqual({ width: pill.width, height: pill.height });
  const changing = frames.filter((frame, index) => index > 0 && (Math.abs(frame.shape.width - frames[index - 1].shape.width) > 0.01 || Math.abs(frame.shape.x - frames[index - 1].shape.x) > 0.01));
  expect(changing.length).toBeGreaterThan(3);
  expect(Math.max(...changing.map(frame => frame.t))).toBeLessThan(move.at);
  // In the DOM the pill never left the strip's corner: the window carried it. It faded out and in.
  for (const frame of frames) {
    expect(Math.abs(frame.shape.x + frame.shape.width - cornerX), JSON.stringify(frame)).toBeLessThan(0.5);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(frames.some(frame => frame.opacity < 0.05)).toBe(true);
  expect(frames.at(-1)?.opacity).toBe(1);
  expect(pill.x + pill.width).toBeCloseTo(cornerX, 0);
  expect(pill.y).toBeCloseTo(reserve.frame.y, 0);
  expect((await geometries(page, 'far')).at(-1)?.regions).toEqual([ilotRegion('anchored', 'below', { width: pill.width, height: pill.height })]);
  expect(await sameSurface(page)).toBe(true);
  // Undo still there, on the moved window.
  await expect(page.locator('.shape-layer:not(.is-leaving) .result-undo')).toBeVisible();
});

test('in the margin the pill keeps its left edge beside the text: a narrower shape shrinks away from the text', async ({ page }) => {
  await openIlot(page, { pillPlacement: 'margin' });
  await working(page, 'margin');
  // The widest line ends at x = 420: the pill's left edge at 428, level with the last line (318).
  const lines = [{ x: 200, y: 300, width: 220, height: 18 }, { x: 200, y: 318, width: 150, height: 18 }];
  await paste(page, lines);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const pill = await box(page);
  expect(pill.x).toBeCloseTo(428 - origin.x, 0);
  expect(pill.y).toBeCloseTo(318 - origin.y, 0);
  for (const line of lines) expect(overlaps(pill, inWindow(line)), JSON.stringify(line)).toBe(false);
  expect(await calls(page, 'move_overlay')).toEqual([]);
  const withdrawn = await follow(page, 'margin', () => fixture(page).run(f => f.undoState('typed')), 900);
  await settled(page);
  const check = await box(page);
  expect(check.width).toBeLessThan(pill.width);
  expect(check.x).toBeCloseTo(pill.x, 0);
  for (const frame of withdrawn) {
    expect(Math.abs(frame.shape.x - pill.x), JSON.stringify(frame)).toBeLessThan(1);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
});

test('the pill stays where it is when Rust refuses its place or the window’s move; a retried paste and a bottom Îlot never ask', async ({ page }) => {
  await openIlot(page);
  // result_pill refused (a stale request): no move at all.
  await working(page, 'refused');
  await fixture(page).run(f => f.pillAnswer('refuse'));
  await paste(page, [{ x: 300, y: 318, width: 260, height: 18 }]);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await expect.poll(() => calls(page, 'result_pill')).toHaveLength(1);
  await settled(page);
  let pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(cornerX, 0);
  expect(pill.y).toBeCloseTo(reserve.frame.y, 0);
  expect(await calls(page, 'move_overlay')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // move_overlay refused: the pill fades back in where it was, asked once.
  await working(page, 'unmoved');
  await fixture(page).run(f => f.refuseMove());
  await paste(page, Array.from({ length: 12 }, (_, index) => ({ x: 100, y: 300 + 18 * index, width: 600, height: 18 })));
  await expect.poll(() => moves(page)).toHaveLength(1);
  await expect.poll(() => opacity(page)).toBe('1');
  await settled(page);
  pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(cornerX, 0);
  expect(pill.y).toBeCloseTo(reserve.frame.y, 0);
  expect(await calls(page, 'result_pill')).toHaveLength(2);
  expect(await fixture(page).run(f => f.windowPosition())).toEqual(origin);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // A result the Îlot pasted itself (Try again): no new place.
  await page.evaluate(() => (window as unknown as { nativeFixture: Fixture }).nativeFixture.captureMenu('retry', null, 'Their going too the store'));
  await expect(stage(page)).toHaveAttribute('data-stage', 'menu');
  await page.keyboard.press('Enter');
  await expect(stage(page)).toHaveAttribute('data-stage', 'working');
  await fixture(page).run(f => f.error('busy'));
  await page.getByRole('button', { name: 'Try again' }).click();
  await fixture(page).run(f => f.done('They are going to the store'));
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await page.waitForTimeout(300);
  expect(await calls(page, 'result_pill')).toHaveLength(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ilot]')).toHaveCount(0);

  // Without an anchor the Îlot stays docked at the bottom.
  await working(page, 'docked', false);
  await paste(page, [{ x: 300, y: 318, width: 260, height: 18 }]);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await page.waitForTimeout(300);
  expect(await calls(page, 'result_pill')).toHaveLength(2);
  expect(await calls(page, 'move_overlay')).toHaveLength(1);
});

test('reduced motion: the pill takes its place at once, no glide', async ({ page }) => {
  await openIlot(page, {}, 'reduce');
  await working(page, 'still');
  const lines = [{ x: 300, y: 300, width: 420, height: 18 }, { x: 300, y: 318, width: 260, height: 18 }];
  const frames = await follow(page, 'still', () => paste(page, lines), 700);
  await expect(stage(page)).toHaveAttribute('data-stage', 'done');
  await settled(page);
  const pill = await box(page);
  expect(pill.x + pill.width).toBeCloseTo(560 - origin.x, 0);
  expect(pill.y).toBeCloseTo(336 + 8 - origin.y, 0);
  // Only its two places, never a position between them.
  for (const frame of frames) {
    const right = frame.shape.x + frame.shape.width;
    expect(Math.abs(right - cornerX) < 0.5 || Math.abs(right - (560 - origin.x)) < 0.5, JSON.stringify(frame)).toBe(true);
    expect(inside(frame.shape, frame.geometry.regions[0]), JSON.stringify(frame)).toBe(true);
  }
  expect(await calls(page, 'move_overlay')).toEqual([]);
});
