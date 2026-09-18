import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = 'C:/Users/Lucas/projects/flowtranslate/node_modules/lucide-react/dist/esm/icons/';
const alias = { 'trash-2': 'trash', history: 'rotate-ccw-clock' };
const names = ['copy','check','ellipsis','x','pin','pin-off','loader-circle','eye','eye-off','clipboard-paste','rotate-ccw','refresh-cw','settings-2','info','triangle-alert','circle-alert','circle-check','languages','spell-check','briefcase-business','wand','plus','trash-2','chevron-down','keyboard','server','shield-check','type','power','history'];
const data = {};
const outDir = process.argv[2];
for (const n of names) {
  const mod = await import(pathToFileURL(root + (alias[n] ?? n) + '.mjs').href);
  const node = mod.__iconData.node.map(([tag, attrs]) => { const { key, ...rest } = attrs; return [tag, rest]; });
  data[n] = node;
  const body = node.map(([tag, a]) => `  <${tag} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('\n');
  fs.writeFileSync(path.join(outDir, n + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16171b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">\n${body}\n</svg>\n`);
}
fs.writeFileSync(process.argv[3], JSON.stringify(data));
console.log(names.length, 'icons');
