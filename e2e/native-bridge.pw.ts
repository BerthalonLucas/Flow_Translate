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
      recoverSettings: () => void;
      connect: () => void;
      refuseShortcut: () => void;
      error: () => Promise<void>;
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
// The packaged root carries the shadow halo around the tight regions: 32 px each side,
// 20 px above and 44 px below (16 px below when docked, 8 px above once folded).
const HALO = { x: 32, top: 20, bottom: 44, dockedBottom: 16, foldedTop: 8 };

test('IPC fixture: the glass keeps its ring size while streaming, resizes once to the 220px ceiling when the result lands, never auto-enlarges, and orders bounded hit regions', async ({ page }) => {
  await openNativeFixture(page);
  await expect.poll(async () => (await geometry(page))?.width).toBe(300 + 2 * HALO.x);
  const initial = await geometry(page);
  const initialCount = await resizeCount(page);
  await page.evaluate(async () => {
    for (let i = 0; i < 120; i++) await window.nativeFixture.delta('Une longue traduction. ');
  });
  // Buffered: nothing lands and nothing resizes before the stream ends.
  await expect(page.locator('.loading-ring')).toBeVisible();
  await expect(page.locator('.translation-text')).not.toContainText('Une longue');
  expect(await resizeCount(page)).toBe(initialCount);
  await page.evaluate(() => window.nativeFixture.done());
  await expect(page.locator('.translation-text')).toContainText('Une longue traduction. '.repeat(120));
  await expect.poll(async () => (await geometry(page))?.height).toBe(234 + HALO.top + HALO.bottom);
  expect(await resizeCount(page)).toBe(initialCount + 1);
  expect((await geometry(page))?.width).toBe(300 + 2 * HALO.x);
  expect((initial?.height as number)).toBeLessThan(234 + HALO.top + HALO.bottom);
  await expect(page.locator('.translation-copy')).toHaveAttribute('data-capped', 'true');
  await expect(page.locator('.translation-bubble')).toHaveAttribute('data-reveal', 'true');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect((await geometry(page))?.presentation).toBe('contextual');
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '300px');
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCSS('transform', 'none');
  await expect.poll(async () => ((await geometry(page))?.regions as unknown[])?.length).toBe(3);
  await expect.poll(async () => { const regions = (await geometry(page))?.regions as Array<{ y: number }>; return regions[2]?.y - regions[0].y; }).toBe(20);
  const current = await geometry(page);
  const regions = current!.regions as Array<{ x: number; y: number; width: number; height: number; radius: number }>;
  expect(regions[0].width).toBe(300);
  expect(regions[0].radius).toBe(28);
  expect(regions[1].width).toBe(52);
  expect(regions[1].height).toBe(28);
  expect(regions[1].y).toBe(regions[0].y - 14);
  expect(regions[2].y).toBe(regions[0].y + 20);
  expect(regions[2].width).toBe(196);
  expect(current!.height as number).toBeGreaterThanOrEqual(regions[2].y + regions[2].height);
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
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '300px');
});


test('IPC fixture: a long source starts compact; only the menu enlarges and the choice persists', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.capture('long-source', 'A long source paragraph with details to translate. '.repeat(20)));
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('long-source');
  expect((await geometry(page))?.presentation).toBe('contextual');
  await expect(page.locator('.translation-text .loading-ring')).toHaveAttribute('aria-label', 'Traduction en cours');
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Agrandir', exact: true }).click();
  await expect.poll(async () => (await geometry(page))?.presentation).toBe('reader');
  await expect.poll(async () => (await geometry(page))?.width).toBe(420 + 2 * HALO.x);
  await page.evaluate(async () => { await window.nativeFixture.delta('Très court.'); await window.nativeFixture.done(); });
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect((await geometry(page))?.presentation).toBe('reader');
  expect((await geometry(page))?.height as number).toBeLessThanOrEqual(454 + HALO.top + HALO.bottom);
});

async function openSettingsFixture(page: Page, fail = false) {
  await page.route('**/?window=settings&fixture=1*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto(`/?window=settings&fixture=1${fail ? '&settingsError=1' : ''}`);
}

test('IPC fixture: settings recover from load failure', async ({ page }) => {
  await openSettingsFixture(page, true);
  await expect(page.getByRole('alert')).toContainText('réglages sont indisponibles');
  await expect(page.getByText('Chargement des réglages…')).toHaveCount(0);
  await page.evaluate(() => window.nativeFixture.recoverSettings());
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByLabel('Langue cible')).toBeVisible();
});

test('IPC fixture: choices save immediately, checks never save, typing saves after a pause, close without translation', async ({ page }) => {
  await openSettingsFixture(page);
  expect(await page.evaluate(() => window.nativeFixture.calls.some(call => call.command === 'check_connection'))).toBe(false);
  await expect(page.locator('.save-status')).toHaveText('Enregistré');
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Enregistré à l’instant');
  await page.getByRole('radio', { name: 'Rapide', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'save_settings').length)).toBe(2);
  await page.getByRole('button', { name: 'Connexion', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'save_settings').at(-1)?.args?.settings)).toMatchObject({ targetLanguage: 'en', mode: 'fast', connectionExpanded: true });
  const fast = page.locator('.profile').nth(1);
  await expect(fast).toContainText('Rapide');
  const saves = await page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'save_settings').length);
  await fast.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(fast.getByRole('status')).toHaveText('Échec de connexion');
  await expect(fast).toContainText('Serveur indisponible.');
  await page.evaluate(() => window.nativeFixture.connect());
  await fast.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(fast.getByRole('status')).toContainText('Connecté ·');
  expect(await page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'save_settings').length)).toBe(saves);
  await page.getByLabel('Modèle', { exact: true }).nth(1).fill('changed-model');
  await expect(fast.getByRole('status')).toHaveText('Non vérifié');
  await expect.poll(() => page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'save_settings').at(-1)?.args?.settings)).toMatchObject({ profiles: { fast: { model: 'changed-model' } } });
  const calls = await page.evaluate(() => window.nativeFixture.calls);
  expect(calls.filter(call => call.command === 'check_connection').map(call => call.args?.mode)).toEqual(['fast', 'fast']);
  expect(calls.some(call => call.command === 'translate')).toBe(false);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.nativeFixture.calls.some(call => call.command === 'plugin:window|close'))).toBe(true);
});

test('IPC fixture: a refused shortcut keeps the previous combination and explains the conflict', async ({ page }) => {
  await openSettingsFixture(page);
  await page.evaluate(() => window.nativeFixture.refuseShortcut());
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.keyboard.press('Control+Alt+Y');
  await expect(page.getByRole('alert')).toHaveText('Déjà utilisé par une autre application');
  await expect(page.locator('.keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'T']);
  await expect(page.locator('.save-status')).toHaveText('Enregistré');
});

test('IPC fixture: server error offers retry and settings through existing menu', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.error());
  await expect(page.locator('.error-copy')).toContainText('Réglages et Réessayer');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Réglages', exact: true }).click();
  expect(await page.evaluate(() => window.nativeFixture.calls.some(call => call.command === 'open_settings'))).toBe(true);
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Réessayer', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'translate').length)).toBe(2);
  await page.evaluate(async () => { await window.nativeFixture.delta('Bonjour'); await window.nativeFixture.done(); });
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
});

test('IPC fixture: a finished glass the pointer left docks as one tab region; hovering the tab restores the glass above it', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(() => window.nativeFixture.delta('Bonjour.'));
  await page.evaluate(() => window.nativeFixture.done());
  const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
  await expect(copy).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.mouse.move(600, 460);
  await expect(page.locator('.dock-tab')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(async () => (await geometry(page))?.presentation).toBe('docked');
  const folded = await geometry(page);
  const tabRegions = folded!.regions as Array<{ x: number; y: number; width: number; height: number; radius: number }>;
  expect(tabRegions).toHaveLength(1);
  expect(tabRegions[0]).toEqual({ x: 128 + HALO.x, y: HALO.foldedTop, width: 44, height: 20, radius: 10 });
  expect(folded!.height).toBe(HALO.foldedTop + 20 + HALO.dockedBottom);
  await page.locator('.dock-tab').hover();
  await expect(page.locator('.translation-bubble')).toBeVisible();
  await expect(copy).toBeEnabled();
  await expect.poll(async () => ((await geometry(page))?.regions as unknown[])?.length).toBe(3);
  const open = await geometry(page);
  const regions = open!.regions as Array<{ x: number; y: number; width: number; height: number; radius: number }>;
  expect(open!.presentation).toBe('docked');
  expect(regions[0].width).toBe(300);
  expect(regions[2].width).toBe(44);
  expect(regions[2].y + regions[2].height + HALO.dockedBottom).toBe(open!.height);
  expect(regions[0].y + regions[0].height + 6).toBe(regions[2].y);
  await page.locator('.translation-bubble').hover();
  await page.mouse.move(600, 460);
  await expect(page.locator('.translation-bubble')).toHaveCount(0, { timeout: 3000 });
  await expect.poll(async () => ((await geometry(page))?.regions as unknown[])?.length).toBe(1);
});
