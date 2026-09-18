// Record the real browser components with simulated text; not a native FPS test.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] ?? 'release/material-preview');
const base = process.env.FLOWTRANSLATE_PROFILE_URL ?? 'http://127.0.0.1:5173';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 900, height: 600 }, reducedMotion: 'no-preference',
    recordVideo: { dir: output, size: { width: 900, height: 600 } },
  });
  const page = await context.newPage();
  const video = page.video();
  await page.goto(`${base}/?window=overlay&demo=1`);
  await page.waitForFunction(() => {
    const copy = document.querySelector('button[aria-label="Copier le résultat"]');
    return copy && !copy.disabled;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(output, 'compact.png') });
  // The browser demo acknowledges Copy without touching the system clipboard.
  await page.getByRole('button', { name: 'Copier le résultat', exact: true }).click();
  await page.waitForTimeout(600);
  const more = () => page.getByRole('button', { name: 'Plus d’options', exact: true });
  await more().hover();
  await page.waitForTimeout(300);
  await more().click();
  await page.waitForTimeout(500);
  await page.getByRole('menuitem', { name: 'Agrandir', exact: true }).click();
  await page.waitForTimeout(700);
  await more().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(output, 'reader-menu.png') });
  await page.getByRole('menuitem', { name: 'Réduire', exact: true }).click();
  await page.waitForTimeout(700);
  await more().click();
  await page.waitForTimeout(450);
  await page.getByRole('menuitem', { name: 'Fermer', exact: true }).click();
  await page.waitForTimeout(450);
  await context.close();
  await video.saveAs(resolve(output, 'transitions.webm'));
  console.log(`Preview written to ${output}`);
} finally {
  await browser.close();
}
