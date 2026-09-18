// Local stand-in for the page's tokens.css generator (render checks only; the page writes the real one).
const fs = require('fs');
const t = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const themes = t.color.themes.map(x => x.id);
const val = (v, th) => typeof v === 'string' ? (th === themes[0] ? v : null) : (v[th] ?? null);
const css = v => v.replace(/^\{(.+)\}$/, 'var(--$1)');
let out = '';
for (const [i, th] of themes.entries()) {
  const sel = i === 0 ? `:root, [data-theme="${th}"]` : `[data-theme="${th}"]`;
  const lines = [];
  for (const fam of ['color', 'shadow']) for (const tok of t[fam].tokens) {
    let v = val(tok.value, th); if (i === 0 && v === null && typeof tok.value === 'object') v = Object.values(tok.value)[0];
    if (v !== null) lines.push(`  --${tok.name}: ${css(v)};`);
    else if (i > 0 && typeof tok.value === 'string' && /^\{/.test(tok.value)) lines.push(`  --${tok.name}: ${css(tok.value)};`);
  }
  out += `${sel} {\n${lines.join('\n')}\n}\n`;
}
const plain = [];
for (const [k, fam] of Object.entries(t)) if (!['color', 'shadow', 'type', 'meta', 'name', 'version'].includes(k) && fam.tokens) for (const tok of fam.tokens) plain.push(`  --${tok.name}: ${tok.value};`);
for (const [k, v] of Object.entries(t.type.families)) plain.push(`  --font-${k}: ${v};`);
out += `:root {\n${plain.join('\n')}\n}\n`;
for (const g of t.type.groups) for (const s of g.styles) {
  const fam = s.family || g.family;
  out += `.${s.name} { font-family: var(--font-${fam}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }\n`;
}
fs.writeFileSync(process.argv[3], out);
console.log('tokens.css', out.length, 'bytes');
