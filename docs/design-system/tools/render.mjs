// Renders components/<Name>/preview.html the way the frame does (tokens.css, bundle.css, React 18, bundle.js preloaded), both themes.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Lucas/projects/flowtranslate/package.json');
const { chromium } = require('@playwright/test');
const ds = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const comp = path.join(ds, 'project/components');
const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
const themes = process.argv.includes('--light') ? ['light'] : process.argv.includes('--dark') ? ['dark'] : ['dark', 'light'];
const list = names.length ? names : fs.readdirSync(comp).filter(n => fs.existsSync(path.join(comp, n, 'preview.html')));
fs.mkdirSync(path.join(ds, 'render'), { recursive: true });
fs.mkdirSync(path.join(ds, 'shots'), { recursive: true });
const tokens = fs.readFileSync(path.join(ds, 'tokens.css'), 'utf8');
const css = fs.readFileSync(path.join(comp, 'bundle.css'), 'utf8');
const url = p => 'file:///' + p.split(path.sep).join('/');
const browser = await chromium.launch();
for (const name of list) {
  const src = fs.readFileSync(path.join(comp, name, 'preview.html'), 'utf8');
  const marker = src.split('\n')[0];
  const height = +(marker.match(/height=(\d+)/)?.[1] ?? 120);
  const width = +(marker.match(/width=(\d+)/)?.[1] ?? (name === 'Cover' ? 960 : 720));
  for (const theme of themes) {
    const inject = `<style>${tokens}</style><style>${css}</style><script src="${url(path.join(comp, 'lib/react.production.min.js'))}"></script><script src="${url(path.join(comp, 'lib/react-dom.production.min.js'))}"></script><script src="${url(path.join(comp, 'bundle.js'))}"></script>`;
    let html = src.replace(/<html([^>]*)>/i, `<html$1 data-theme="${theme}">`).replace(/<head>/i, `<head>${inject}`);
    const file = path.join(ds, 'render', `${name}-${theme}.html`);
    fs.writeFileSync(file, html);
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url(file));
    await page.waitForTimeout(450);
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: path.join(ds, 'shots', `${name}-${theme}.png`), fullPage: true, animations: 'disabled' });
    console.log(name, theme, `${width}x${height}`, scroll > height + 2 ? `OVERFLOW ${scroll}` : '', errors.length ? 'ERRORS ' + errors.join(' | ') : '');
    await page.close();
  }
}
await browser.close();
