import { test, expect, type Page } from '@playwright/test';
import { anchoredFloor, dock, halo, menu } from '../src/layout';

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
      near: (near: boolean) => Promise<void>;
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
type Region = { x: number; y: number; width: number; height: number; radius: number };
const regionsOf = async (page: Page) => ((await geometry(page))?.regions ?? []) as Region[];
const tab = { x: (dock.width - dock.tab.width) / 2, y: dock.height - halo.dockedBottom - dock.tab.height, width: dock.tab.width, height: dock.tab.height, radius: 10 };

// The packaged root carries the shadow halo (src/layout.ts) and the window is reserved: an
// anchored glass never asks less than the floor that keeps the menu under the pill, so the
// ring and the result share one window size and only the surfaces change.
test('IPC fixture: the glass keeps its ring size while streaming, publishes new surfaces once when the result lands, never auto-enlarges, and orders bounded hit regions', async ({ page }) => {
  await openNativeFixture(page);
  await expect.poll(async () => (await geometry(page))?.width).toBe(300 + 2 * halo.x);
  const initial = await geometry(page);
  expect(initial?.height).toBe(anchoredFloor);
  expect((await regionsOf(page))[0].height).toBeLessThan(220);
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
  await expect.poll(async () => (await regionsOf(page))[0].height).toBe(220);
  expect(await resizeCount(page)).toBe(initialCount + 1);
  expect((await geometry(page))?.width).toBe(300 + 2 * halo.x);
  expect((await geometry(page))?.height).toBe(anchoredFloor);
  await expect(page.locator('.translation-copy')).toHaveAttribute('data-capped', 'true');
  await expect(page.locator('.translation-bubble')).toHaveAttribute('data-reveal', 'true');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect((await geometry(page))?.presentation).toBe('contextual');
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '300px');
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCSS('transform', 'none');
  await expect.poll(async () => (await regionsOf(page)).length).toBe(3);
  await expect.poll(async () => { const regions = await regionsOf(page); return regions[2]?.y - regions[0].y; }).toBe(20);
  const current = await geometry(page);
  const regions = current!.regions as Region[];
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
  // The menu fits the reserve: opening it changed the surfaces, not the window.
  expect(regions[2].height).toBeLessThanOrEqual(menu.reserve);
  expect([current!.width, current!.height]).toEqual([300 + 2 * halo.x, anchoredFloor]);
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
  await expect.poll(async () => (await geometry(page))?.width).toBe(420 + 2 * halo.x);
  await page.evaluate(async () => { await window.nativeFixture.delta('Très court.'); await window.nativeFixture.done(); });
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect((await geometry(page))?.presentation).toBe('reader');
  expect((await geometry(page))?.height).toBe(anchoredFloor);
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

test('IPC fixture: a finished glass the pointer left folds to one tab region in the reserved window; the tab, the unfold and the menu never resize it', async ({ page }) => {
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
  expect([folded!.width, folded!.height]).toEqual([dock.width, dock.height]);
  expect(folded!.regions).toEqual([tab]);
  // The body fades in place, then leaves the page for the pointer, the focus and assistive technology.
  await expect(page.locator('.translation-bubble')).toBeHidden();
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-folded', 'true');
  await expect(page.locator('.glass-body')).toHaveAttribute('inert', '');
  expect(await page.locator('.dock-tab').boundingBox()).toMatchObject({ width: 44, height: 20 });
  await page.locator('.dock-tab').hover();
  await expect(page.locator('.translation-bubble')).toBeVisible();
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-folded', 'false');
  await expect(copy).toBeEnabled();
  await expect.poll(async () => (await regionsOf(page)).length).toBe(3);
  const open = await geometry(page);
  const regions = open!.regions as Region[];
  expect(open!.presentation).toBe('docked');
  expect([open!.width, open!.height]).toEqual([dock.width, dock.height]);
  expect(regions[0]).toMatchObject({ x: (dock.width - 300) / 2, width: 300 });
  expect(regions[2]).toEqual(tab);
  expect(regions[0].y + regions[0].height + 6).toBe(regions[2].y);
  // The menu opens in the reserve above the pill: surfaces change, the window does not.
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect.poll(async () => (await regionsOf(page)).length).toBe(4);
  const withMenu = await regionsOf(page);
  expect(withMenu[2].y).toBeGreaterThanOrEqual(halo.top);
  expect(withMenu[2].height).toBeLessThanOrEqual(menu.reserve);
  expect(Math.abs(withMenu[2].y + withMenu[2].height + 6 - regions[1].y)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.locator('.translation-bubble').hover();
  await page.mouse.move(600, 460);
  await expect(page.locator('.translation-bubble')).toBeHidden({ timeout: 3000 });
  await expect.poll(async () => (await regionsOf(page)).length).toBe(1);
  const dockedSizes = await page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'resize_overlay' && call.args?.presentation === 'docked').map(call => `${call.args?.width}×${call.args?.height}`));
  expect(dockedSizes.length).toBeGreaterThanOrEqual(5);
  expect(new Set(dockedSizes).size).toBe(1);
});

test('IPC fixture: the native cursor proximity holds the glass; it folds once the cursor has left the silhouette', async ({ page }) => {
  await openNativeFixture(page);
  await page.evaluate(async () => { await window.nativeFixture.delta('Bonjour.'); await window.nativeFixture.done(); });
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.evaluate(() => window.nativeFixture.near(true));
  await page.mouse.move(600, 460);
  await page.waitForTimeout(900);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-collapsed', 'false');
  await page.evaluate(() => window.nativeFixture.near(false));
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-collapsed', 'true', { timeout: 3000 });
});

test('IPC fixture: a long path breaks after its separators in the result and in the original, never inside a name', async ({ page }) => {
  await openNativeFixture(page);
  const path = 'C:\\Users\\Lucas\\projects\\flowtranslate\\src-tauri\\target\\release\\FlowTranslate.exe';
  await page.evaluate(path => window.nativeFixture.capture('path', `The binary is at ${path}`), path);
  await expect.poll(async () => (await geometry(page))?.captureId).toBe('path');
  await page.evaluate(async path => { await window.nativeFixture.delta(`Le binaire est dans ${path}`); await window.nativeFixture.done(); }, path);
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const text = page.locator('.translation-text');
  await expect(text).toHaveText(`Le binaire est dans ${path}`);
  await expect(text).toHaveCSS('overflow-wrap', 'break-word');
  expect(await text.locator('wbr').count()).toBe(10);
  // Pieces without a space stay on one line each: the wrap happens at the separators only.
  const wrapped = (scope: string) => page.locator(scope).evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const lines: number[] = [];
    let split = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange(); range.selectNodeContents(node);
      const tops = new Set(Array.from(range.getClientRects()).map(rect => Math.round(rect.top)));
      tops.forEach(top => lines.push(top));
      if (!/\s/.test(node.textContent ?? '') && tops.size > 1) split++;
    }
    return { split, lines: new Set(lines).size };
  });
  expect(await wrapped('.translation-text')).toMatchObject({ split: 0 });
  expect((await wrapped('.translation-text')).lines).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Afficher l’original', exact: true }).click();
  await expect(page.locator('.original-copy')).toContainText('The binary is at');
  expect(await page.locator('.original-copy wbr').count()).toBe(10);
  expect(await wrapped('.original-copy')).toMatchObject({ split: 0 });
});
