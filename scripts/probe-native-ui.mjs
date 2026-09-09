// Tests the web content in an explicitly started FlowTranslate demo process.
// A WebView screenshot is not evidence of Windows backdrop/focus/hit-testing;
// the HWND inspection below is evidence of the frameless silhouette only.
import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = process.env.FLOWTRANSLATE_CDP_URL ?? 'http://127.0.0.1:9227';
const host = new URL(endpoint);
if (!['127.0.0.1', 'localhost'].includes(host.hostname)) throw Error('Local test endpoint required');
const output = resolve(process.argv[2] ?? 'release/native-ui-probe');
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(endpoint);
const report = { status: 'running', cycles: [], notChecked: ['desktop backdrop and residual composition', 'foreground focus', 'pointer hit regions', 'monitor DPI', 'animation frame times', 'real selection capture'] };
const chromeStyles = ['CAPTION', 'THICKFRAME', 'SYSMENU', 'MINIMIZEBOX', 'MAXIMIZEBOX'];
// Top-level HWNDs of the test process: physical geometry, region box, caption styles.
const inspectNative = () => {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(dirname(fileURLToPath(import.meta.url)), 'inspect-native-windows.ps1')];
  if (process.env.FLOWTRANSLATE_TEST_PID) args.push('-ProcessId', process.env.FLOWTRANSLATE_TEST_PID);
  return JSON.parse(execFileSync('powershell', args, { encoding: 'utf8' }));
};
try {
  const overlayTargets = () => browser.contexts().flatMap(context => context.pages()).filter(page => /tauri\.localhost/.test(page.url()) && new URL(page.url()).searchParams.get('window') === 'overlay');
  await expect.poll(() => overlayTargets().length, { timeout: 10000, message: 'Expected exactly one packaged FlowTranslate overlay' }).toBe(1);
  const targets = overlayTargets();
  const page = targets[0];
  // Refuse to capture an arbitrary live translation: the launcher must start an explicit demo.
  // The demo sentence follows the persisted target language (FR by default, EN once Lucas switched).
  await expect(page.locator('.translation-text')).toHaveText(/^(Pourriez-vous envoyer la proposition mise à jour avant jeudi \?|Could you send the updated proposal before Thursday\?)$/);
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const info = await page.evaluate(() => ({ userAgent: navigator.userAgent, devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, nativeBridge: '__TAURI_INTERNALS__' in window }));
  Object.assign(report, info);
  const nativeVisible = label => page.evaluate(label => window.__TAURI_INTERNALS__.invoke('plugin:window|is_visible', { label }), label);
  const nativeSize = () => page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:window|outer_size', { label: 'overlay' }));
  // The visible overlay HWND must stay frameless (no DWM title) and keep its region.
  const expectFrameless = async step => {
    const size = await nativeSize();
    const windows = inspectNative();
    const overlay = windows.find(w => w.visible && w.width === size.width && w.height === size.height);
    expect(overlay, `${step}: visible overlay HWND of ${size.width}×${size.height}`).toBeTruthy();
    expect(overlay.styles.filter(style => chromeStyles.includes(style)), `${step}: caption styles`).toEqual([]);
    expect(overlay.region, `${step}: window region`).toEqual({ width: size.width, height: size.height });
    return overlay;
  };
  for (let cycle = 0; cycle < 3; cycle++) {
  if (cycle > 0) await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('capture_text'));
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await expect.poll(() => nativeVisible('overlay')).toBe(true);
  const beforeSize = await nativeSize();
  const result = { cycle: cycle + 1, beforeSize, domClosed: false, nativeHidden: false };
  report.cycles.push(result);
  if (cycle === 0) {
    await page.screenshot({ path: resolve(output, 'webview-short.png') });
    result.framelessAfterShow = await expectFrameless('after show');
    // The capsule click path: activation must not bring Tao's caption back nor drop the region.
    await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('focus_overlay'));
    await page.waitForTimeout(400);
    result.framelessAfterFocus = await expectFrameless('after focus_overlay');
  }
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  result.menuSize = await nativeSize();
  if (cycle === 0) await page.screenshot({ path: resolve(output, 'webview-menu.png') });
  await page.getByRole('menuitem', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  result.domClosed = true;
  result.overlayVisibleAfterDomClose = await nativeVisible('overlay');
  result.capsuleVisibleAfterDomClose = await nativeVisible('capsule');
  await expect.poll(() => nativeVisible('overlay')).toBe(false);
  await expect.poll(() => nativeVisible('capsule')).toBe(false);
  result.nativeHidden = true;
  }
  report.status = 'passed';
  console.log('PASS: 3 real WebView2 cycles, frameless HWND with region after show and focus_overlay, menus, DOM close and native windows hidden. Desktop composition not established.');
} catch (error) {
  report.status = 'failed';
  report.error = String(error.message);
  throw error;
} finally {
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
