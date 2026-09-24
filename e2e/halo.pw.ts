import { test, expect, type Page } from '@playwright/test';
import type { HaloEvent } from '../src/types';

// The halo window (lot 6) over the IPC fixture: what it draws from the `halo` events Rust
// sends (src-tauri/src/halo.rs). The real window (placement, pass-through, z-order) is
// checked on Windows, not here.
const lines = [
  { x: 12, y: 12, width: 380, height: 20 },
  { x: 12, y: 32, width: 412, height: 22 },
  { x: 12, y: 54, width: 96, height: 20 },
];
const run = (generation: number, phase: HaloEvent['phase'] = 'work'): HaloEvent => phase === 'work'
  ? { generation, phase, lines, width: 436, height: 86 }
  : { generation, phase, lines: [], width: 0, height: 0 };
const send = (page: Page, event: HaloEvent) => page.evaluate(event => (window as unknown as { nativeFixture: { halo: (event: HaloEvent) => Promise<void> } }).nativeFixture.halo(event), event);

async function openHalo(page: Page) {
  await page.setViewportSize({ width: 436, height: 86 });
  await page.route('**/?window=halo&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=halo&fixture=1');
  await expect(page.locator('body')).toHaveClass(/flowtranslate-halo/);
  await expect(page.locator('html')).toHaveAttribute('data-halo-ready', 'true');
}

test('work draws one rounded line per rectangle, 250 ms after it starts, the sweep of the lab', async ({ page }) => {
  await openHalo(page);
  const sent = await page.evaluate(() => performance.now());
  await send(page, run(1));
  const halo = page.locator('.halo');
  await expect(page.locator('.halo-line')).toHaveCount(3);
  await expect(halo).toHaveAttribute('data-state', 'waiting');
  await expect(halo).toHaveCSS('opacity', '0');
  await expect(halo).toHaveAttribute('data-state', 'shown');
  const shownAfter = await page.evaluate(start => performance.now() - start, sent);
  expect(shownAfter).toBeGreaterThanOrEqual(240);
  expect(shownAfter).toBeLessThan(700);
  await expect(halo).toHaveCSS('opacity', '1');
  for (const [index, line] of lines.entries()) {
    const div = page.locator('.halo-line').nth(index);
    expect(await div.boundingBox()).toEqual({ x: line.x, y: line.y, width: line.width, height: line.height });
    await expect(div).toHaveCSS('border-radius', '3px');
    await expect(div).toHaveCSS('animation-name', 'halo-sweep');
    await expect(div).toHaveCSS('animation-duration', '1.6s');
    await expect(div).toHaveCSS('animation-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)');
    await expect(div).toHaveCSS('animation-iteration-count', 'infinite');
    // design-lab/src/app.css .tfx-sweep: 100°, violet, pink, amber at .32, transparent ends.
    await expect(div).toHaveCSS('background-image', 'linear-gradient(100deg, rgba(0, 0, 0, 0) 25%, rgba(141, 159, 255, 0.32) 40%, rgba(188, 130, 243, 0.32) 50%, rgba(255, 186, 113, 0.32) 60%, rgba(0, 0, 0, 0) 75%)');
    // Three strips long: the strip is the three lines end to end (888 px).
    await expect(div).toHaveCSS('background-size', '2664px 100%');
    await expect(div).toHaveCSS('background-repeat', 'no-repeat');
  }
});

test('the band runs on from one line to the next at every moment', async ({ page }) => {
  await openHalo(page);
  await send(page, run(1));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'shown');
  for (const at of [0, 300, 800, 1400]) {
    const positions = await page.evaluate(at => [...document.querySelectorAll<HTMLElement>('.halo-line')].map(line => {
      const animation = line.getAnimations()[0];
      animation.pause();
      animation.currentTime = at;
      return parseFloat(getComputedStyle(line).backgroundPositionX);
    }), at);
    // The image point under a line's right edge is the one under the next line's left edge.
    for (let index = 0; index + 1 < lines.length; index++) {
      expect(lines[index].width - positions[index]).toBeCloseTo(-positions[index + 1], 1);
    }
    // One strip: at the start the band is before the first line, at the end past the last.
    if (at === 0) expect(positions[0]).toBeCloseTo(-2.4 * 888, 1);
  }
});

test('leave fades out in 150 ms, clear removes the lines, a stale event changes nothing', async ({ page }) => {
  await openHalo(page);
  await send(page, run(4));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'shown');
  await send(page, run(3, 'leave'));
  await send(page, run(3, 'clear'));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'shown');
  await send(page, run(4, 'leave'));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'leaving');
  await expect(page.locator('.halo')).toHaveCSS('transition-duration', '0.15s');
  await expect(page.locator('.halo')).toHaveCSS('opacity', '0');
  await send(page, run(5, 'clear'));
  await expect(page.locator('.halo-line')).toHaveCount(0);
  // A new run after a clear starts over, waiting 250 ms again.
  await send(page, run(6));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'waiting');
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'shown');
});

test('reduced animations: a fixed veil over the same strip, still after 250 ms', async ({ page }) => {
  await openHalo(page);
  await page.evaluate(() => (window as unknown as { nativeFixture: { settings: (next: Record<string, unknown>) => Promise<void> } }).nativeFixture.settings({ motion: 'reduced' }));
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const sent = await page.evaluate(() => performance.now());
  await send(page, run(1));
  await expect(page.locator('.halo')).toHaveAttribute('data-state', 'shown');
  expect(await page.evaluate(start => performance.now() - start, sent)).toBeGreaterThanOrEqual(240);
  const line = page.locator('.halo-line').nth(1);
  await expect(line).toHaveCSS('animation-name', 'none');
  await expect(line).toHaveCSS('background-size', '888px 100%');
  // The second line shows the strip from 380 px on: continuous with the first.
  await expect(line).toHaveCSS('background-position', '-380px 0px');
  await expect(line).toHaveCSS('background-image', 'linear-gradient(100deg, rgba(141, 159, 255, 0.32), rgba(188, 130, 243, 0.32) 50%, rgba(255, 186, 113, 0.32))');
});
