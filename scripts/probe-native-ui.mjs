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
const report = { status: 'running', cycles: [], notChecked: ['desktop composition of the anti-aliased edges and shadows', 'foreground focus', 'monitor DPI', 'animation frame times', 'real selection capture'] };
const chromeStyles = ['CAPTION', 'THICKFRAME', 'SYSMENU', 'MINIMIZEBOX', 'MAXIMIZEBOX'];
// Top-level HWNDs of the test process: physical geometry, region box, caption and pass-through styles.
const probeArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(dirname(fileURLToPath(import.meta.url)), 'inspect-native-windows.ps1')];
const inspectNative = () => {
  const args = [...probeArgs];
  if (process.env.FLOWTRANSLATE_TEST_PID) args.push('-ProcessId', process.env.FLOWTRANSLATE_TEST_PID);
  return JSON.parse(execFileSync('powershell', args, { encoding: 'utf8' }));
};
// Moves the real cursor, lets the hit tester react (8 ms poll, 40 ms wait) and reports the window under it.
const hitTest = (x, y) => JSON.parse(execFileSync('powershell', [...probeArgs, '-MoveCursor', `${x},${y}`, '-HitTest', `${x},${y}`], { encoding: 'utf8' }));
// A locked session (LogonUI) neither moves nor reports the real cursor: the probe then feeds the
// hit tester through the test-only `override_cursor` command and says so in the report.
const sessionLocked = () => { const check = hitTest(700, 700); return check.cursor.x !== 700 || check.cursor.y !== 700; };
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
  const locked = sessionLocked();
  report.cursorSource = locked ? 'override_cursor (session locked: SetCursorPos and GetCursorPos inert)' : 'real cursor (SetCursorPos)';
  const pointCursor = async (x, y) => {
    if (!locked) return hitTest(x, y);
    await page.evaluate(([x, y]) => window.__TAURI_INTERNALS__.invoke('override_cursor', { x, y }), [x, y]);
    await page.waitForTimeout(60);
    return JSON.parse(execFileSync('powershell', [...probeArgs, '-HitTest', `${x},${y}`], { encoding: 'utf8' }));
  };
  const nativeSize = () => page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:window|outer_size', { label: 'overlay' }));
  // The visible overlay HWND must stay frameless (no DWM title) and carry no region: the
  // silhouette is Chromium's, and the pass-through styles follow the real cursor.
  const expectFrameless = async step => {
    const size = await nativeSize();
    const windows = inspectNative();
    const overlay = windows.find(w => w.visible && w.width === size.width && w.height === size.height);
    expect(overlay, `${step}: visible overlay HWND of ${size.width}×${size.height}`).toBeTruthy();
    expect(overlay.styles.filter(style => chromeStyles.includes(style)), `${step}: caption styles`).toEqual([]);
    expect(overlay.region, `${step}: window region`).toBeNull();
    const dpr = await page.evaluate(() => devicePixelRatio);
    const glass = await page.locator('.translation-bubble').boundingBox();
    const inside = await pointCursor(Math.round(overlay.x + (glass.x + glass.width / 2) * dpr), Math.round(overlay.y + (glass.y + glass.height / 2) * dpr));
    expect(inside.root.hwnd, `${step}: the glass takes the cursor`).toBe(overlay.hwnd);
    expect(inspectNative().find(w => w.hwnd === overlay.hwnd).exStyles, `${step}: pass-through cleared on the glass`).toEqual([]);
    const halo = await pointCursor(overlay.x + 2, overlay.y + 2);
    expect(halo.root.hwnd, `${step}: the halo lets the cursor through`).not.toBe(overlay.hwnd);
    expect(inspectNative().find(w => w.hwnd === overlay.hwnd).exStyles, `${step}: pass-through set in the halo`).toEqual(['TRANSPARENT', 'LAYERED']);
    return { ...overlay, inside, halo };
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
    // The capsule click path: activation must not bring Tao's caption back nor set a region.
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
  console.log('PASS: 3 real WebView2 cycles, frameless HWND without region, cursor let through in the halo and taken on the glass after show and focus_overlay, menus, DOM close and native windows hidden. Desktop composition not established.');
} catch (error) {
  report.status = 'failed';
  report.error = String(error.message);
  throw error;
} finally {
  await writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
