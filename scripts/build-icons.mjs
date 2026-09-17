#!/usr/bin/env node
// Régénère les icônes de src-tauri/icons/ depuis les SVG du design system.
// Rasterisation par Chromium (déjà installé avec @playwright/test), encodage PNG
// et assemblage ICO en Node pur : aucune dépendance supplémentaire.
//
//   node scripts/build-icons.mjs
//
// Sorties :
//   src-tauri/icons/icon.png           512  (tuile d'application)
//   src-tauri/icons/128x128@2x.png     256
//   src-tauri/icons/128x128.png        128
//   src-tauri/icons/32x32.png           32
//   src-tauri/icons/icon.ico           16, 24, 32, 48, 256
//   src-tauri/icons/mark.svg           copie de la source vectorielle
//   src-tauri/icons/tray/<nom>.png      16  (six glyphes de notification)
//   src-tauri/icons/tray/<nom>@2x.png   32

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'docs', 'design-system', 'assets');
const OUT = path.join(ROOT, 'src-tauri', 'icons');
const TRAY_OUT = path.join(OUT, 'tray');

const APP_ICON = path.join(ASSETS, 'Logos', 'flowtranslate-app-icon.svg');

const TRAY_NAMES = [
  'tray-idle-dark-taskbar',
  'tray-idle-light-taskbar',
  'tray-busy-dark-taskbar',
  'tray-busy-light-taskbar',
  'tray-alert-dark-taskbar',
  'tray-alert-light-taskbar',
];

// L'ICO lu par tauri-codegen à la compilation Rust, et rendu par
// app.default_window_icon(). 16 px doit rester lisible : c'est le repli du
// glyphe de notification.
const ICO_SIZES = [16, 24, 32, 48, 256];

const APP_PNGS = [
  ['icon.png', 512],
  ['128x128@2x.png', 256],
  ['128x128.png', 128],
  ['32x32.png', 32],
];

// ---------------------------------------------------------------- encodage PNG

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// RGBA 8 bits, non entrelacé, filtre None sur chaque ligne : le format le plus
// simple à relire, et reproductible d'une génération à l'autre.
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // couleur : RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ assemblage ICO

// Un ICO n'est qu'un répertoire d'entrées suivi des images concaténées. Les
// entrées sont rangées par taille croissante ; 256 s'écrit 0 sur un octet.
function buildIco(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type : icône
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (const [i, image] of images.entries()) {
    const o = 6 + i * 16;
    header[o] = image.size === 256 ? 0 : image.size;
    header[o + 1] = image.size === 256 ? 0 : image.size;
    header[o + 2] = 0; // palette
    header[o + 3] = 0; // réservé
    header.writeUInt16LE(1, o + 4); // plans
    header.writeUInt16LE(32, o + 6); // bits par pixel
    header.writeUInt32LE(image.png.length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += image.png.length;
  }
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

// ------------------------------------------------------------- rasterisation

// Le SVG est rendu à sa taille intrinsèque : on réécrit width/height de la
// balise racine pour qu'aucune mise à l'échelle de canevas n'intervienne.
function atSize(svg, size) {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) throw new Error('SVG sans balise racine');
  let tag = open[0].replace(/\swidth="[^"]*"/, '').replace(/\sheight="[^"]*"/, '');
  tag = tag.replace(/<svg\b/, `<svg width="${size}" height="${size}"`);
  return svg.replace(open[0], tag);
}

async function rasterize(page, svg, size) {
  const b64 = await page.evaluate(
    async ([markup, side]) => {
      const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
      ctx.clearRect(0, 0, side, side);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const data = ctx.getImageData(0, 0, side, side).data;
      let bin = '';
      for (let i = 0; i < data.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    },
    [atSize(svg, size), size],
  );
  const rgba = Buffer.from(b64, 'base64');
  if (rgba.length !== size * size * 4) {
    throw new Error(`rasterisation ${size} px : ${rgba.length} octets au lieu de ${size * size * 4}`);
  }
  return encodePng(size, size, rgba);
}

// ------------------------------------------------------------------- pilotage

async function main() {
  mkdirSync(TRAY_OUT, { recursive: true });

  const appSvg = readFileSync(APP_ICON, 'utf8');
  const traySvgs = new Map(
    TRAY_NAMES.map((name) => [name, readFileSync(path.join(ASSETS, 'Tray', `${name}.svg`), 'utf8')]),
  );

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>icons</title>');

  const written = [];
  const write = (file, buffer) => {
    writeFileSync(file, buffer);
    written.push(`${path.relative(ROOT, file).replace(/\\/g, '/')} (${buffer.length} o)`);
  };

  try {
    for (const [name, size] of APP_PNGS) {
      write(path.join(OUT, name), await rasterize(page, appSvg, size));
    }

    const layers = [];
    for (const size of ICO_SIZES) {
      layers.push({ size, png: await rasterize(page, appSvg, size) });
    }
    write(path.join(OUT, 'icon.ico'), buildIco(layers));

    // La source vectorielle voyage avec les icônes : même nom qu'avant, nouvelle
    // identité. tauri.conf.json n'a pas à bouger.
    write(path.join(OUT, 'mark.svg'), Buffer.from(appSvg, 'utf8'));

    for (const [name, svg] of traySvgs) {
      write(path.join(TRAY_OUT, `${name}.png`), await rasterize(page, svg, 16));
      write(path.join(TRAY_OUT, `${name}@2x.png`), await rasterize(page, svg, 32));
    }
  } finally {
    await browser.close();
  }

  for (const line of written) console.log(`écrit  ${line}`);
  console.log(`\n${written.length} fichiers régénérés depuis docs/design-system/assets/.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
