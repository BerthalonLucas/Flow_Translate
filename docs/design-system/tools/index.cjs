// Writes project/design-system.json from tools/uploads.json ({"<Group>/<file>": "<blob id>"}) and the files in assets-src/.
const fs = require('fs');
const path = require('path');
const ds = path.resolve(__dirname, '..');
const uploads = JSON.parse(fs.readFileSync(path.join(__dirname, 'uploads.json'), 'utf8'));
const TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png' };
const GROUPS = {
  Logos: { tile: 'l', order: ['flowtranslate-app-icon.svg', 'flowtranslate-app-icon-256.png', 'flowtranslate-glyph-ink.svg', 'flowtranslate-glyph-light.svg'] },
  Tray: { tile: 's', order: ['tray-idle', 'tray-busy', 'tray-alert'].flatMap(s => [`${s}-light-taskbar.svg`, `${s}-dark-taskbar.svg`]) },
  Icons: { tile: 'xs', order: JSON.parse(fs.readFileSync(path.join(__dirname, 'icons-order.json'), 'utf8')).map(n => `${n}.svg`) },
};
const key = n => n.replace(/[^A-Za-z0-9_./-]/g, c => '~' + c.charCodeAt(0).toString(16).padStart(2, '0'));
const assetGroups = {};
for (const [name, g] of Object.entries(GROUPS)) {
  const dir = path.join(ds, 'assets-src', name);
  const onDisk = fs.readdirSync(dir).sort();
  const missing = onDisk.filter(f => !g.order.includes(f)).concat(g.order.filter(f => !onDisk.includes(f)));
  if (missing.length) throw new Error(`${name}: order and disk differ: ${missing.join(', ')}`);
  const files = {};
  for (const f of g.order) {
    const [id, size] = uploads[`${name}/${f}`] || [];
    if (!/^[0-9a-f]{32}$/.test(id || '')) throw new Error(`no upload id for ${name}/${f}`);
    files[key(f)] = { name: f, blob: id, size, type: TYPES[path.extname(f)] };
  }
  assetGroups[name] = { name, tile: g.tile, order: g.order, files };
}
const now = process.argv[2];
if (!now) throw new Error('usage: node index.cjs <ISO now>');
const index = {
  v: 3,
  layout: 'files',
  createdOnFiles: { v: 1, at: now },
  title: 'FlowTranslate',
  namespace: 'FlowTranslate',
  libraries: [{ name: 'react', version: '18' }, { name: 'react-dom', version: '18' }],
  sections: {},
  groups: Object.keys(GROUPS),
  assetGroups,
  blobs: {},
  docs: { readme: 'project/README.md', sections: [] },
  lastChange: { by: 'Lucas', at: now, via: 'Claude Code', note: 'Refonte 1.0 « Graphite & Surligneur », extraite de FlowTranslate 0.4.0' },
};
fs.writeFileSync(path.join(ds, 'project', 'design-system.json'), JSON.stringify(index, null, 2) + '\n');
console.log('design-system.json', Object.values(assetGroups).map(g => `${g.name}:${g.order.length}`).join(' '));
