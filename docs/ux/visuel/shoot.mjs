// Capture chaque .scene d’une page en PNG à l’échelle 1. Usage : node shoot.mjs <page.html> [prefix]
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Lucas/projects/flowtranslate/package.json');
const { chromium } = require('@playwright/test');
const dir = path.posix.dirname(new URL(import.meta.url).pathname).replace(/^\//, '');
const page_ = process.argv[2] || 'bulles.html';
const prefix = process.argv[3] || '';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('file:///' + path.posix.join(dir, page_));
await page.waitForTimeout(400);
const ids = await page.$$eval('.shot', els => els.map(e => e.id));
for (const id of ids) {
  const el = await page.$('#' + id);
  await el.scrollIntoViewIfNeeded();
  const clipAttr = await el.getAttribute('data-clip');
  const box = await el.boundingBox();
  const out = path.posix.join(dir, `${prefix}${id}.png`);
  if (clipAttr) {
    const [x, y, w, h] = clipAttr.split(',').map(Number);
    await page.screenshot({ path: out, animations: 'disabled', clip: { x: box.x + x, y: box.y + y, width: w, height: h } });
  } else {
    await el.screenshot({ path: out, animations: 'disabled' });
  }
  console.log(out);
}
if (errors.length) console.log('console:', errors.join('\n'));
await browser.close();
