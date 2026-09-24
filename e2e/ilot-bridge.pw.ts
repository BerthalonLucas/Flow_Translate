import { test, expect, type Page } from '@playwright/test';

// The Îlot contract over the IPC fixture (lots 3–4): a menu capture never translates by
// itself, the frontend asks for the keyboard, a choice goes through `choose_action` once
// and `translate` then runs the returned action. The keys are driven through the
// provisional probe (src/menu/NativeMenuProbe.tsx); the Îlot of lot 7 takes these tests
// over with its own keyboard table.
type Call = { command: string; args?: Record<string, unknown> };
type Fixture = {
  calls: Call[];
  settings: (next: Record<string, unknown>) => Promise<void>;
  captureMenu: (id: string, lastActionId?: string | null, text?: string) => Promise<void>;
  refuseFocus: () => void;
  menuKey: (key: string, shiftKey?: boolean, captureId?: string) => Promise<void>;
  menuRepeat: (captureId?: string) => Promise<void>;
};
// Runs `run` in the page against the fixture (the function travels as source: no outer variables).
const on = <T>(page: Page, run: (fixture: Fixture) => T | Promise<T>) => page.evaluate(`(${run.toString()})(window.nativeFixture)`) as Promise<T>;
const calls = (page: Page, command: string) => page.evaluate(name => (window as unknown as { nativeFixture: Fixture }).nativeFixture.calls.filter(call => call.command === name).map(call => call.args ?? {}), command);
const translations = async (page: Page, captureId: string) => (await calls(page, 'translate')).map(args => args.request as { captureId: string; actionId: string }).filter(request => request.captureId === captureId);

async function openIlot(page: Page) {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1');
  await expect(page.locator('.glass-overlay')).toBeVisible();
  await on(page, f => f.settings({ uiVersion: 'ilot' }));
}

test('IPC fixture: an Îlot capture waits for its choice, takes the keyboard, and Enter runs the last action once', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('menu'));
  await expect(page.locator('[data-menu-probe]')).toHaveAttribute('data-focused', 'true');
  expect((await calls(page, 'focus_overlay')).length).toBeGreaterThan(0);
  expect(await translations(page, 'menu')).toHaveLength(0);
  await page.keyboard.press('Enter');
  // No action remembered for this application: the default one (Fix grammar).
  await expect.poll(() => calls(page, 'choose_action')).toEqual([{ captureId: 'menu', actionId: 'correct' }]);
  await expect.poll(() => translations(page, 'menu')).toEqual([expect.objectContaining({ captureId: 'menu', actionId: 'correct' })]);
  // Chosen: the probe leaves, the pill waits for the native paste; a second Enter chooses nothing.
  await expect(page.locator('[data-menu-probe]')).toHaveCount(0);
  await expect(page.locator('.wait-pill')).toBeVisible();
  await page.keyboard.press('Enter');
  expect(await calls(page, 'choose_action')).toHaveLength(1);
});

test('IPC fixture: without the foreground the menu reads the native menu-key events, digits pick a tile', async ({ page }) => {
  await openIlot(page);
  await on(page, f => { f.refuseFocus(); return f.captureMenu('fallback', 'correct'); });
  await expect(page.locator('[data-menu-probe]')).toHaveAttribute('data-focused', 'false');
  await on(page, f => f.menuKey('2', false, 'stale-capture'));
  await on(page, f => f.menuKey('2'));
  // The second tile of the default grid: Translate.
  await expect.poll(() => calls(page, 'choose_action')).toEqual([{ captureId: 'fallback', actionId: 'translate' }]);
  await expect.poll(() => translations(page, 'fallback')).toEqual([expect.objectContaining({ actionId: 'translate' })]);
});

test('IPC fixture: a double press of the menu shortcut runs the application\'s last action once, without a key', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('twice', 'shorten'));
  await expect(page.locator('[data-menu-probe]')).toBeVisible();
  await on(page, f => f.menuRepeat('stale-capture'));
  await on(page, f => f.menuRepeat());
  await expect.poll(() => calls(page, 'choose_action')).toEqual([{ captureId: 'twice', actionId: 'shorten' }]);
  await expect.poll(() => translations(page, 'twice')).toEqual([expect.objectContaining({ actionId: 'shorten' })]);
  await on(page, f => f.menuRepeat());
  expect(await calls(page, 'choose_action')).toHaveLength(1);
  // Nothing remembered for that application: the default action.
  await on(page, f => f.captureMenu('first-time'));
  await on(page, f => f.menuRepeat());
  await expect.poll(async () => (await calls(page, 'choose_action')).at(-1)).toEqual({ captureId: 'first-time', actionId: 'correct' });
});

test('IPC fixture: Space opens a real field for a free instruction; Escape goes back, then closes without choosing', async ({ page }) => {
  await openIlot(page);
  await on(page, f => f.captureMenu('free', 'correct'));
  await expect(page.locator('[data-menu-probe]')).toHaveAttribute('data-focused', 'true');
  await page.keyboard.press('Space');
  const field = page.getByRole('textbox', { name: 'Instruction' });
  await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(field).toHaveCount(0);
  expect(await calls(page, 'dismiss_overlay')).toHaveLength(0);
  await page.keyboard.press('Space');
  await field.fill('Mets au pluriel, sans « tu »');
  await page.keyboard.press('Enter');
  await expect.poll(() => calls(page, 'choose_action')).toEqual([{ captureId: 'free', actionId: 'instruction', instruction: 'Mets au pluriel, sans « tu »' }]);
  // The instruction is frozen in Rust: `translate` carries the reserved id, never the text of the instruction.
  await expect.poll(() => translations(page, 'free')).toEqual([expect.objectContaining({ actionId: 'instruction' })]);
  expect(JSON.stringify(await translations(page, 'free'))).not.toContain('pluriel');

  await on(page, f => f.captureMenu('closing'));
  await expect(page.locator('[data-menu-probe]')).toHaveAttribute('data-focused', 'true');
  await page.keyboard.press('Escape');
  await expect.poll(() => calls(page, 'dismiss_overlay')).toHaveLength(1);
  expect((await calls(page, 'choose_action')).filter(args => args.captureId === 'closing')).toHaveLength(0);
});
