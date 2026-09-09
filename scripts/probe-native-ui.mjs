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
try {
  const pages = browser.contexts().flatMap(context => context.pages());
  const targets = pages.filter(page => /tauri\.localhost/.test(page.url()) && new URL(page.url()).searchParams.get('window') === 'overlay');
  if (targets.length !== 1) throw Error('Expected exactly one FlowTranslate overlay');
  const page = targets[0];
  // Refuse to capture an arbitrary live translation: this must be the explicit demo.
  await expect(page.locator('.translation-text')).toHaveText('Pourriez-vous envoyer la proposition mise à jour avant jeudi ?');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const info = await page.evaluate(() => ({ userAgent: navigator.userAgent, devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, nativeBridge: '__TAURI_INTERNALS__' in window }));
  await page.screenshot({ path: resolve(output, 'webview-short.png') });
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.screenshot({ path: resolve(output, 'webview-menu.png') });
  await page.getByRole('menuitem', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ ...info, checked: ['completed demo rendered in real WebView2', 'menu opened', 'close removed overlay DOM'], notChecked: ['desktop backdrop', 'native window visibility', 'foreground focus', 'pointer hit regions', 'monitor DPI', 'animation frame times'] }, null, 2));
  console.log('PASS: real WebView2 demo, menu, close. Desktop composition remains a separate check.');
} finally { await browser.close(); }
