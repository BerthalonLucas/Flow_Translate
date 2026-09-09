import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    nativeFixture: {
      calls: Array<{ command: string; args?: Record<string, unknown> }>;
      capture: (id: string, text?: string) => Promise<void>;
      delta: (text: string, requestId?: string) => Promise<void>;
      done: () => Promise<void>;
      dismissEvent: (captureId: string) => Promise<void>;
      requestId: () => string;
      holdCopy: () => void;
      releaseCopy: () => void;
    };
  }
}

async function openNativeFixture(page: Page) {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/?window=overlay&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1');
  await expect(page.locator('.glass-overlay')).toBeVisible();
}
const geometry = (page: Page) => page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'resize_overlay').at(-1)?.args);
const resizeCount = (page: Page) => page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'resize_overlay').length);

test('IPC fixture: stable streaming, one completion promotion and ordered bounded hit regions', async ({ page }) => {
  await openNativeFixture(page);
  await expect.poll(async () => (await geometry(page))?.width).toBe(280);
  const initial = await geometry(page);
  const initialCount = await resizeCount(page);
  await page.evaluate(async () => {
    for (let i = 0; i < 120; i++) await window.nativeFixture.delta('Une longue traduction. ');
  });
  await expect(page.locator('.translation-text')).toContainText('Une longue traduction. '.repeat(120));
  expect(await resizeCount(page)).toBe(initialCount);
  expect(await geometry(page)).toEqual(initial);
  await page.evaluate(() => window.nativeFixture.done());
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await expect.poll(async () => (await geometry(page))?.presentation).toBe('reader');
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '560px');
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect.poll(async () => ((await geometry(page))?.regions as unknown[])?.length).toBe(3);
  const current = await geometry(page);
  const regions = current!.regions as Array<{ x: number; y: number; width: number; height: number; radius: number }>;
  expect(regions[0].width).toBe(560);
  expect(regions[0].radius).toBe(26);
  expect(regions[1].width).toBe(60);
  expect(regions[1].height).toBe(28);
  expect(regions[1].y).toBe(regions[0].y - 14);
  expect(regions[2].y + regions[2].height).toBeLessThan(regions[0].y);
  for (const part of regions) {
    expect(part.x).toBeGreaterThanOrEqual(0); expect(part.y).toBeGreaterThanOrEqual(0);
    expect(part.x + part.width).toBeLessThanOrEqual(current!.width as number);
    expect(part.y + part.height).toBeLessThanOrEqual(current!.height as number);
    expect(part.radius * 2).toBeLessThanOrEqual(Math.min(part.width, part.height));
  }
  expect(current!.height as number).toBeLessThanOrEqual(480);
  await page.evaluate(() => window.nativeFixture.capture('second'));
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('second');
  await expect.poll(async () => (await geometry(page))?.presentation).toBe('contextual');
});

test('IPC fixture: initial regions are sent even when hidden WebView rAF is suspended', async ({ page }) => {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 1; });
  await openNativeFixture(page);
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('first');
  expect(((await geometry(page))?.regions as unknown[]).length).toBe(2);
});

test('IPC fixture: native close request animates then acknowledges and ignores late streams', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.delta('Bonjour'));
  const request = await page.evaluate(() => window.nativeFixture.requestId());
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-closing', 'true');
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'complete_overlay_dismiss').map(call => call.args?.captureId))).toEqual(['first']);
  await page.evaluate(id => window.nativeFixture.delta('Late stream', id), request);
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
});

test('IPC fixture: a new capture during exit cannot be closed by the old animation', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => {
    await window.nativeFixture.dismissEvent('first');
    await new Promise(resolve => setTimeout(resolve, 35));
    await window.nativeFixture.capture('new-capture');
    await window.nativeFixture.delta('Nouvelle traduction');
    await window.nativeFixture.done();
  });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-capture-id', 'new-capture');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'complete_overlay_dismiss').length)).toBe(0);
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-closing', 'false');
});

test('IPC fixture: a late copy acknowledgement never appears in the next capture', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => { await window.nativeFixture.delta('Bonjour'); await window.nativeFixture.done(); window.nativeFixture.holdCopy(); });
  await page.getByRole('button', { name: 'Copier la traduction', exact: true }).click();
  await page.evaluate(async () => { await window.nativeFixture.capture('next'); window.nativeFixture.releaseCopy(); await window.nativeFixture.delta('Autre traduction'); await window.nativeFixture.done(); });
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await expect(page.locator('.compact-feedback')).toHaveCount(0);
});

test('IPC fixture: reduced motion closes immediately through the same handshake', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.dismissEvent('first'));
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => window.nativeFixture.calls.some(call => call.command === 'complete_overlay_dismiss'))).toBe(true);
});

test('IPC fixture: capture during presentation fade cancels the old layout commit', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => { await window.nativeFixture.delta('Court'); await window.nativeFixture.done(); });
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Agrandir', exact: true }).click();
  await page.evaluate(() => window.nativeFixture.capture('replacement'));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-capture-id', 'replacement');
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('replacement');
  await page.evaluate(async () => { await window.nativeFixture.delta('Remplacement court'); await window.nativeFixture.done(); });
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect((await geometry(page))?.presentation).toBe('contextual');
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '280px');
});


test('IPC fixture: long source selects reader before streaming and never automatically demotes', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.capture('long-source', 'A long source paragraph with details to translate. '.repeat(20)));
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('long-source');
  expect((await geometry(page))?.presentation).toBe('reader');
  await expect(page.locator('.translation-text')).toContainText('Traduction en cours');
  await page.evaluate(async () => { await window.nativeFixture.delta('Très court.'); await window.nativeFixture.done(); });
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect((await geometry(page))?.presentation).toBe('reader');
});
