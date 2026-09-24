// Vérifications du labo, rejouables : node verify.mjs (après npm install ici et à la racine).
// Ce sont les mesures qui ont servi à valider le labo ; elles servent aussi de modèle pour
// tester la nouvelle DA dans l'app (centrage, non-recouvrement, sélection au mot près…).
// Navigateur seulement : rien ici ne valide la vraie fenêtre Windows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const page = join(here, 'labo-flowtranslate.html');
const STORE = 'flowtranslate-labo-v4';
let failures = 0;
const check = (ok, label, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };

async function open(browser, { reduced = false, viewport = { width: 1440, height: 1000 } } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  // React comes from cdnjs in the page; serve the local copies so the check runs offline.
  await p.route('**/react.production.min.js', r => r.fulfill({ body: readFileSync(join(here, 'node_modules/react/umd/react.production.min.js')), contentType: 'text/javascript' }));
  await p.route('**/react-dom.production.min.js', r => r.fulfill({ body: readFileSync(join(here, 'node_modules/react-dom/umd/react-dom.production.min.js')), contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.goto('file://' + page);
  await p.waitForTimeout(500);
  return p;
}
const shortcut = async p => { await p.keyboard.down('Control'); await p.keyboard.down('Alt'); await p.keyboard.press('Space'); await p.keyboard.up('Alt'); await p.keyboard.up('Control'); };
const selectPara = (p, n) => p.click(`.stage-bar .seg button:has-text("¶${n}")`);
const surfaceOverRange = p => p.evaluate(() => {
  const s = document.querySelector('[data-surface]')?.getBoundingClientRect();
  const rs = [...(document.querySelector('[data-range]')?.getClientRects() || [])];
  if (!s || !rs.length) return null;
  return rs.some(r => !(s.right <= r.left || s.left >= r.right || s.bottom <= r.top || s.top >= r.bottom));
});

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  // 1. Parcours de base : Îlot, Entrée = dernière action, remplacement, Annuler.
  let p = await open(browser);
  await selectPara(p, 1);
  await shortcut(p); await p.waitForTimeout(500);
  check(await p.isVisible('[data-surface] .m-row'), 'Îlot ouvert par Ctrl+Alt+Espace');
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  check(await p.evaluate(() => document.querySelector('[data-range]')?.className.includes('tfx-sweep')), 'balayage de lumière sur la sélection pendant le travail');
  await p.waitForTimeout(1300);
  check((await p.textContent('[data-pid="p1"]')).includes('your notes'), 'texte corrigé en place');
  check(await p.$$eval('.chg-hold:not(.is-leaving)', e => e.length > 0), 'mots changés surlignés pendant l’annulation');
  check((await surfaceOverRange(p)) === false, 'la pilule ne recouvre pas le nouveau texte');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(600);
  check((await p.textContent('[data-pid="p1"]')).includes('you notes'), 'Ctrl+Z rétablit l’original');

  // 2. Pilule : contenu centré pendant la transformation menu → pilule.
  await p.evaluate(s => localStorage.setItem(s, JSON.stringify({ hold: true, loaderDelay: 0 })), STORE);
  await p.reload(); await p.waitForTimeout(400);
  await selectPara(p, 1); await shortcut(p); await p.waitForTimeout(400); await p.keyboard.press('Enter');
  let worst = 0;
  for (let k = 0; k < 10; k++) {
    await p.waitForTimeout(40);
    const d = await p.evaluate(() => { const s = document.querySelector('[data-surface]').getBoundingClientRect(); const l = document.querySelector('[data-surface] .ldr')?.getBoundingClientRect(); if (!l) return 0; return Math.max(Math.abs(l.left + l.width / 2 - s.left - s.width / 2), Math.abs(l.top + l.height / 2 - s.top - s.height / 2)); });
    worst = Math.max(worst, d);
  }
  check(worst < 0.5, 'indicateur centré pendant la transformation', `écart max ${worst.toFixed(2)} px`);
  await p.keyboard.press('Escape');
  await p.evaluate(s => localStorage.removeItem(s), STORE);

  // 3. Pas de recouvrement même quand le texte s'allonge (mail rédigé, traduction).
  p = await open(browser);
  for (const [n, key, label] of [[2, 'e', 'Rédiger un mail'], [1, 't', 'Traduire']]) {
    await selectPara(p, n); await shortcut(p); await p.waitForTimeout(400); await p.keyboard.press(key); await p.waitForTimeout(2300);
    check((await surfaceOverRange(p)) === false, `pilule à côté du nouveau texte (${label})`);
    await p.click('text=Remettre le texte');
  }

  // 4. Sélection au mot près (glisser) et double-clic.
  const box = await p.evaluate(() => { const t = document.querySelector('[data-pid="p1"]').firstChild; const i = t.textContent.indexOf('you notes on the draft'); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); const a = r.getBoundingClientRect(); r.setStart(t, i + 21); r.setEnd(t, i + 22); const z = r.getBoundingClientRect(); return { x1: a.left + 1, x2: z.right - 1, y: a.top + a.height / 2 }; });
  await p.mouse.move(box.x1, box.y); await p.mouse.down(); await p.mouse.move(box.x2, box.y, { steps: 8 }); await p.mouse.up();
  check((await p.textContent('[data-range]')) === 'you notes on the draft', 'sélection au caractère près');

  // 5. Les 10 menus s'ouvrent et se ferment au clavier.
  const menus = await p.$$('#menus .btn.primary');
  let opened = 0;
  for (let i = 0; i < menus.length; i++) {
    await (await p.$$('#menus .btn.primary'))[i].click(); await p.waitForTimeout(1300);
    if (await p.$('[data-surface]')) opened++;
    await p.keyboard.press('Escape'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(350);
    await p.click('text=Remettre le texte');
  }
  check(opened === 10, 'les 10 menus s’ouvrent', `${opened}/10`);

  // 6. Erreur de configuration → Réglages ouverts sur le bon champ (réglages remis à zéro : Îlot).
  const earlier = p.errors.splice(0);
  await p.evaluate(s => localStorage.removeItem(s), STORE); await p.reload(); await p.waitForTimeout(400);
  p.errors.push(...earlier);
  await p.click('.tabs button:has-text("Simulation")');
  await p.selectOption('.panel select', 'key');
  await selectPara(p, 2); await shortcut(p); await p.waitForTimeout(400); await p.keyboard.press('f'); await p.waitForTimeout(1900);
  await p.click('[data-surface] .pill-btn:has-text("Fix key")'); await p.waitForTimeout(600);
  check(await p.isVisible('.settings-win .s-field.is-target'), 'erreur de clé → champ Clé API mis en évidence');
  check(p.errors.length === 0, 'aucune erreur de console', p.errors.join(' | '));

  // 7. Largeur téléphone et appareil en « animations réduites ».
  const m = await open(browser, { viewport: { width: 400, height: 860 } });
  const [sw, iw] = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(sw <= iw, 'pas de défilement horizontal à 400 px');
  const r = await open(browser, { reduced: true });
  check(await r.isVisible('.banner'), 'bandeau affiché quand l’appareil réduit les animations');
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} vérification(s) en échec` : '\nToutes les vérifications passent.');
process.exit(failures ? 1 : 0);
