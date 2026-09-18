import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Lucas/projects/flowtranslate/package.json');
const { chromium } = require('@playwright/test');
const ds = process.argv[2]; const theme = process.argv[3] || 'dark'; const width = +(process.argv[4] || 960); const height = +(process.argv[5] || 680);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto('file:///' + path.join(ds, 'render', `SettingsScreen-${theme}.html`).split(path.sep).join('/'));
await page.waitForTimeout(300);
for (const label of ['Lecture', 'Moteurs', 'Confidentialité']) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(ds, 'shots', `Settings-${label}-${theme}-${width}.png`), animations: 'disabled' });
}
await browser.close();
