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

test('IPC fixture: choose language and engine, recover connection, save and close without translation', async ({ page }) => {
  await openSettingsFixture(page);
  const engine = page.getByRole('region', { name: 'Connexion du moteur' });
  await expect(engine).toContainText('Serveur de traduction');
  await expect(engine).toContainText('Adresse du serveur à renseigner');
  expect(await page.evaluate(() => window.nativeFixture.calls.some(call => call.command === 'check_connection'))).toBe(false);
  await page.getByLabel('Langue cible').selectOption('en');
  await page.getByLabel('Mode par défaut').selectOption('fast');
  await expect(engine.getByRole('heading')).toHaveText('Moteur Rapide');
  const check = page.getByRole('button', { name: 'Enregistrer et vérifier le moteur', exact: true });
  await check.click();
  await expect(engine.getByRole('status')).toContainText('Connexion indisponible');
  await expect(engine).toContainText('Démarrez le serveur');
  await page.evaluate(() => window.nativeFixture.connect());
  await check.click();
  await expect(engine.getByRole('status')).toContainText('Modèle disponible');
  await page.getByRole('button', { name: 'Connexion avancée', exact: true }).click();
  await page.getByLabel('Modèle', { exact: true }).nth(1).fill('changed-model');
  await expect(engine.getByRole('status')).not.toContainText('Modèle disponible');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const calls = await page.evaluate(() => window.nativeFixture.calls);
  expect(calls.filter(call => call.command === 'check_connection').map(call => call.args?.mode)).toEqual(['fast', 'fast']);
  expect(calls.filter(call => call.command === 'save_settings').at(-1)?.args?.settings).toMatchObject({ targetLanguage: 'en', mode: 'fast' });
  expect(calls.some(call => call.command === 'translate')).toBe(false);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.nativeFixture.calls.some(call => call.command === 'plugin:window|close'))).toBe(true);
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
