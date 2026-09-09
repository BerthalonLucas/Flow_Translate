// Tests the web content in an explicitly started FlowTranslate demo process.
// A WebView screenshot is not evidence of Windows backdrop/focus/hit-testing.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const endpoint = process.env.FLOWTRANSLATE_CDP_URL ?? 'http://127.0.0.1:9227';
const host = new URL(endpoint);
if (!['127.0.0.1', 'localhost'].includes(host.hostname)) throw Error('Local test endpoint required');
const output = resolve(process.argv[2] ?? 'release/native-ui-probe');
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(endpoint);
const report = { status: 'running', cycles: [], notChecked: ['desktop backdrop and residual composition', 'foreground focus', 'pointer hit regions', 'monitor DPI', 'animation frame times', 'real selection capture'] };
try {
  const overlayTargets = () => browser.contexts().flatMap(context => context.pages()).filter(page => /tauri\.localhost/.test(page.url()) && new URL(page.url()).searchParams.get('window') === 'overlay');
  await expect.poll(() => overlayTargets().length, { timeout: 10000, message: 'Expected exactly one packaged FlowTranslate overlay' }).toBe(1);
  const targets = overlayTargets();
  const page = targets[0];
  // Refuse to capture an arbitrary live translation: the launcher must start an explicit demo.
  await expect(page.locator('.translation-text')).toHaveText('Pourriez-vous envoyer la proposition mise à jour avant jeudi ?');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const info = await page.evaluate(() => ({ userAgent: navigator.userAgent, devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, nativeBridge: '__TAURI_INTERNALS__' in window }));
  Object.assign(report, info);
  const nativeVisible = label => page.evaluate(label => window.__TAURI_INTERNALS__.invoke('plugin:window|is_visible', { label }), label);
  const nativeSize = () => page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:window|outer_size', { label: 'overlay' }));
  for (let cycle = 0; cycle < 3; cycle++) {
  if (cycle > 0) await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('capture_text'));
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await expect.poll(() => nativeVisible('overlay')).toBe(true);
  const beforeSize = await nativeSize();
  if (cycle === 0) await page.screenshot({ path: resolve(output, 'webview-short.png') });
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  const menuSize = await nativeSize();
  if (cycle === 0) await page.screenshot({ path: resolve(output, 'webview-menu.png') });
  await page.getByRole('menuitem', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  const result = { cycle: cycle + 1, beforeSize, menuSize, domClosed: true, nativeHidden: false };
  report.cycles.push(result);
  result.overlayVisibleAfterDomClose = await nativeVisible('overlay');
  result.capsuleVisibleAfterDomClose = await nativeVisible('capsule');
  await expect.poll(() => nativeVisible('overlay')).toBe(false);
  await expect.poll(() => nativeVisible('capsule')).toBe(false);
  result.nativeHidden = true;
  }
  report.status = 'passed';
  console.log('PASS: 3 real WebView2 cycles, menus, DOM close and native windows hidden. Desktop composition not established.');
} catch (error) {
  report.status = 'failed';
  report.error = String(error.message);
  throw error;
} finally {
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
