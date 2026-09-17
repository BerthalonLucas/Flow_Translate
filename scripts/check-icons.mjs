#!/usr/bin/env node
// Contrôle des icônes de src-tauri/icons/.
//
//   node scripts/check-icons.mjs
//
// Vérifie des propriétés, pas une empreinte : un PNG rasterisé par Chromium est
// en général reproductible octet pour octet, mais rien ne le garantit en
// travers d'un changement de pilote ou de fontes. Sont contrôlés : la présence
// des fichiers, leurs dimensions réelles, la structure de l'ICO (nombre et
// tailles des entrées, chaque couche relue et redécodée), l'encre attendue sur
// des pixels témoins des six glyphes de notification, la pastille rouge
// présente dans les deux variantes d'alerte et absente partout ailleurs, et la
// lisibilité de la tuile jusqu'à 16 px.
//
// L'inventaire attendu est écrit ici, indépendamment de build-icons.mjs : un
// contrôle qui lirait sa liste dans le générateur ne contrôlerait rien.

import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src-tauri', 'icons');

const TRAY_NAMES = [
  'tray-idle-dark-taskbar',
  'tray-idle-light-taskbar',
  'tray-busy-dark-taskbar',
  'tray-busy-light-taskbar',
  'tray-alert-dark-taskbar',
  'tray-alert-light-taskbar',
];

const ICO_SIZES = [16, 24, 32, 48, 256];

const APP_PNGS = [
  ['icon.png', 512],
  ['128x128@2x.png', 256],
  ['128x128.png', 128],
  ['32x32.png', 32],
];

// Encres du design system (docs/design-system/assets/*/README.md).
const TILE = [0x16, 0x17, 0x1b];
const LINE = [0xec, 0xee, 0xf1];
const BAND = [0xff, 0xd2, 0x4a];
const ALERT = [0xe5, 0x53, 0x4b];
const INK_DARK_TASKBAR = [0xff, 0xff, 0xff];
const INK_LIGHT_TASKBAR = [0x16, 0x17, 0x1b];

// --------------------------------------------------------------- décodage PNG

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Renvoie { width, height, rgba } — RGBA 8 bits non prémultiplié.
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('signature PNG absente');
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = null;
  let paletteAlpha = null;
  const idat = [];
  let at = 8;
  while (at < buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') paletteAlpha = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  if (depth !== 8) throw new Error(`profondeur ${depth} non gérée`);
  if (interlace !== 0) throw new Error('PNG entrelacé non géré');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`type de couleur ${colorType} non géré`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const lines = Buffer.alloc(stride * height);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x];
      const a = x >= channels ? lines[row + x - channels] : 0;
      const b = y > 0 ? lines[prev + x] : 0;
      const c = y > 0 && x >= channels ? lines[prev + x - channels] : 0;
      let out;
      if (filter === 0) out = value;
      else if (filter === 1) out = value + a;
      else if (filter === 2) out = value + b;
      else if (filter === 3) out = value + ((a + b) >> 1);
      else if (filter === 4) out = value + paeth(a, b, c);
      else throw new Error(`filtre ${filter} inconnu`);
      lines[row + x] = out & 0xff;
    }
    src += stride;
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    const d = i * 4;
    if (colorType === 6) {
      lines.copy(rgba, d, s, s + 4);
    } else if (colorType === 2) {
      lines.copy(rgba, d, s, s + 3);
      rgba[d + 3] = 255;
    } else if (colorType === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s];
      rgba[d + 3] = 255;
    } else if (colorType === 4) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s];
      rgba[d + 3] = lines[s + 1];
    } else {
      const index = lines[s];
      rgba[d] = palette[index * 3];
      rgba[d + 1] = palette[index * 3 + 1];
      rgba[d + 2] = palette[index * 3 + 2];
      rgba[d + 3] = paletteAlpha && index < paletteAlpha.length ? paletteAlpha[index] : 255;
    }
  }
  return { width, height, rgba };
}

// -------------------------------------------------------------------- mesures

const pixel = (image, x, y) => {
  const d = (y * image.width + x) * 4;
  return [image.rgba[d], image.rgba[d + 1], image.rgba[d + 2], image.rgba[d + 3]];
};

const near = (got, want, tolerance) =>
  want.every((channel, i) => Math.abs(got[i] - channel) <= tolerance);

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function countNear(image, want, tolerance) {
  let n = 0;
  for (let i = 0; i < image.width * image.height; i++) {
    const d = i * 4;
    if (image.rgba[d + 3] < 128) continue;
    if (near([image.rgba[d], image.rgba[d + 1], image.rgba[d + 2]], want, tolerance)) n++;
  }
  return n;
}

// ------------------------------------------------------------------ contrôles

const failures = [];
let passed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    return true;
  }
  failures.push(detail ? `${label} — ${detail}` : label);
  return false;
}

function load(relative) {
  const file = path.join(OUT, relative);
  if (!existsSync(file)) {
    failures.push(`${relative} — fichier absent`);
    return null;
  }
  try {
    return decodePng(readFileSync(file));
  } catch (error) {
    failures.push(`${relative} — illisible : ${error.message}`);
    return null;
  }
}

// La tuile : trois éléments doivent survivre à la réduction, 16 px compris,
// parce que cet ICO est aussi le repli de l'icône de notification.
function checkAppTile(label, image) {
  const size = image.width;
  const at = (fx, fy) => pixel(image, Math.round(fx * size), Math.round(fy * size));
  check(`${label} : coin arrondi transparent`, at(4 / 512, 4 / 512)[3] === 0, `alpha ${at(4 / 512, 4 / 512)[3]}`);
  check(`${label} : bande surligneur présente`, countNear(image, BAND, 24) > 0);

  if (size >= 32) {
    const tile = at(40 / 512, 256 / 512);
    check(`${label} : fond graphite`, near(tile, TILE, 6) && tile[3] === 255, tile.join(','));
    const band = at(256 / 512, 256 / 512);
    check(`${label} : bande #ffd24a au centre`, near(band, BAND, 6), band.join(','));
    const top = at(256 / 512, 170 / 512);
    check(`${label} : ligne haute claire`, near(top, LINE, 6), top.join(','));
    const bottom = at(256 / 512, 342 / 512);
    check(`${label} : ligne basse claire`, near(bottom, LINE, 6), bottom.join(','));
    const right = at(480 / 512, 342 / 512);
    check(`${label} : ligne basse plus courte`, near(right, TILE, 6), right.join(','));
  } else {
    // Sous 32 px les traits d'encre sont sous le pixel : on contrôle qu'ils
    // restent visibles (contraste), pas qu'ils gardent leur teinte exacte.
    let brightest = 0;
    for (let y = Math.round(0.28 * size); y < Math.round(0.38 * size); y++) {
      for (let x = 0; x < size; x++) {
        const p = pixel(image, x, y);
        if (p[3] > 200) brightest = Math.max(brightest, luminance(p));
      }
    }
    check(`${label} : ligne haute encore lisible`, brightest >= 120, `luminance max ${brightest.toFixed(0)}`);
  }
}

console.log('Icône d’application');
for (const [name, size] of APP_PNGS) {
  const image = load(name);
  if (!image) continue;
  check(`${name} : ${size} × ${size}`, image.width === size && image.height === size, `${image.width} × ${image.height}`);
  checkAppTile(name, image);
}

// L'ICO : répertoire d'entrées puis PNG concaténés. tauri-codegen le lit à la
// compilation Rust — une couche absente ou mal déclarée casse tout le dépôt.
console.log('ICO');
{
  const file = path.join(OUT, 'icon.ico');
  if (!existsSync(file)) failures.push('icon.ico — fichier absent');
  else {
    const buf = readFileSync(file);
    const count = buf.length >= 6 ? buf.readUInt16LE(4) : 0;
    check('icon.ico : en-tête de type icône', buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1);
    if (check(`icon.ico : ${ICO_SIZES.length} entrées`, count === ICO_SIZES.length, `${count} entrées`)) {
      for (const [i, size] of ICO_SIZES.entries()) {
        const o = 6 + i * 16;
        const declared = buf[o] === 0 ? 256 : buf[o];
        const declaredHeight = buf[o + 1] === 0 ? 256 : buf[o + 1];
        const length = buf.readUInt32LE(o + 8);
        const offset = buf.readUInt32LE(o + 12);
        check(`icon.ico : entrée ${i} déclarée ${size}`, declared === size && declaredHeight === size, `${declared} × ${declaredHeight}`);
        check(`icon.ico : entrée ${i} en 32 bits`, buf.readUInt16LE(o + 4) === 1 && buf.readUInt16LE(o + 6) === 32);
        if (!check(`icon.ico : entrée ${i} dans le fichier`, offset + length <= buf.length && length > 0)) continue;
        const layer = buf.subarray(offset, offset + length);
        if (!check(`icon.ico : entrée ${i} encodée en PNG`, layer.subarray(0, 8).equals(PNG_SIG))) continue;
        try {
          const image = decodePng(layer);
          check(`icon.ico : couche ${i} mesurée ${size} × ${size}`, image.width === size && image.height === size, `${image.width} × ${image.height}`);
          checkAppTile(`icon.ico[${size}]`, image);
        } catch (error) {
          failures.push(`icon.ico : couche ${i} illisible — ${error.message}`);
        }
      }
    }
  }
}

check('mark.svg présent', existsSync(path.join(OUT, 'mark.svg')));

// Les glyphes de notification : grille de 16 entière, une seule encre, sauf la
// pastille rouge de l'état alerte que Windows affiche sans recoloration.
console.log('Zone de notification');
for (const name of TRAY_NAMES) {
  const ink = name.includes('-dark-taskbar') ? INK_DARK_TASKBAR : INK_LIGHT_TASKBAR;
  const busy = name.startsWith('tray-busy');
  const alert = name.startsWith('tray-alert');

  for (const [file, size] of [[`tray/${name}.png`, 16], [`tray/${name}@2x.png`, 32]]) {
    const image = load(file);
    if (!image) continue;
    const u = size / 16; // unité de la grille de 16
    const at = (x, y) => pixel(image, Math.round(x * u), Math.round(y * u));
    check(`${file} : ${size} × ${size}`, image.width === size && image.height === size, `${image.width} × ${image.height}`);

    const coin = at(0.2, 0.2);
    check(`${file} : fond transparent`, coin[3] === 0, `alpha ${coin[3]}`);

    const top = at(5.5, 2.9);
    check(`${file} : ligne haute à l’encre`, near(top, ink, 8) && top[3] > 200, top.join(','));

    const bottom = at(5.5, 12.9);
    check(`${file} : ligne basse à l’encre`, near(bottom, ink, 8) && bottom[3] > 200, bottom.join(','));

    const bandLeft = at(4.5, 7.9);
    check(`${file} : bande à l’encre`, near(bandLeft, ink, 8) && bandLeft[3] > 200, bandLeft.join(','));

    // Occupé : la moitié droite de la bande passe à 35 %.
    const bandRight = at(11.5, 7.9);
    if (busy) {
      check(`${file} : moitié droite à 35 %`, bandRight[3] > 60 && bandRight[3] < 120, `alpha ${bandRight[3]}`);
    } else {
      check(`${file} : bande pleine`, bandRight[3] > 200, `alpha ${bandRight[3]}`);
    }

    // Alerte : ligne haute raccourcie et pastille rouge. Ailleurs, aucune
    // couleur autre que l'encre.
    const pastille = countNear(image, ALERT, 24);
    if (alert) {
      check(`${file} : pastille rouge présente`, pastille >= 12 * u * u, `${pastille} pixels`);
      const shortened = at(11.5, 2.9);
      check(`${file} : pastille par-dessus la ligne haute raccourcie`, near(shortened, ALERT, 24), shortened.join(','));
    } else {
      check(`${file} : aucune pastille`, pastille === 0, `${pastille} pixels rouges`);
    }
  }
}

console.log();
if (failures.length) {
  for (const failure of failures) console.error(`ÉCHEC  ${failure}`);
  console.error(`\n${failures.length} contrôle(s) en échec sur ${passed + failures.length}.`);
  process.exit(1);
}
console.log(`${passed} contrôles passés. Icônes conformes au design system.`);
