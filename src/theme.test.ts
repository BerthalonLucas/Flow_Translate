import { describe, expect, it } from 'vitest';
import css from './theme.css?raw';
import labData from '../design-lab/src/data.js?raw';

// The tokens as the browser resolves them: the light block on :root, the dark block over it.
type Tokens = Record<string, string>;
function block(selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}
const light = block(':root');
const darkChoice = block(':root[data-theme="dark"]');
const darkSystem = block(':root:not([data-theme="light"])');
const themes = { light, dark: { ...light, ...darkChoice } } as const;
function resolve(tokens: Tokens, value: string, depth = 0): string {
  if (depth > 8) throw new Error(`var cycle in ${value}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    if (!(name in tokens)) throw new Error(`unknown ${name}`);
    return resolve(tokens, tokens[name], depth + 1);
  });
}

// Colours: rgb(R G B[ / A]) or #rgb / #rrggbb, composited over an opaque backdrop.
type Rgba = { r: number; g: number; b: number; a: number };
function color(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d) : hex[1].match(/../g)!;
    const [r, g, b] = digits.map(d => parseInt(d, 16));
    return { r, g, b, a: 1 };
  }
  const rgb = value.match(/^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (!rgb) throw new Error(`not a colour: ${value}`);
  return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
}
const over = (top: Rgba, bottom: Rgba): Rgba => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
const channel = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = ({ r, g, b }: Rgba) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function ratio(text: Rgba, background: Rgba) {
  const fg = luminance(over(text, background)), bg = luminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}
const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };

describe('theme tokens', () => {
  it('writes the dark theme once for the system and once for the choice, identically', () => {
    expect(darkSystem).toEqual(darkChoice);
    for (const name of Object.keys(darkChoice)) expect(light, name).toHaveProperty(name);
  });

  // The floating surfaces are translucent: the desktop behind may be white or black, and the
  // diagonal sheen lightens their top corner. Every text token must hold 4.5:1 on each.
  for (const [theme, tokens] of Object.entries(themes)) {
    const token = (name: string) => color(resolve(tokens, `var(${name})`));
    const sheen = +resolve(tokens, 'var(--surface-sheen)').match(/\/\s*([\d.]+)\)/)![1];
    it(`keeps 4.5:1 for text on the ${theme} surfaces, over a white or a black desktop`, () => {
      for (const desktop of [white, black]) {
        const base = over(token('--surface-fill'), desktop);
        const backgrounds = { base, sheen: over({ ...white, a: sheen }, base), hover: over(token('--hover'), base), quiet: over(token('--quiet-bg'), base) };
        for (const [where, background] of Object.entries(backgrounds)) {
          const texts = where === 'base' || where === 'sheen' ? ['--text', '--text-muted', '--text-subtle', '--error-text', '--warning-text'] : ['--text'];
          for (const text of texts) expect(ratio(token(text), background), `${theme} ${text} on ${where} over ${desktop === white ? 'white' : 'black'}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`keeps 4.5:1 for text in the ${theme} settings window`, () => {
      const bg = token('--settings-bg');
      expect(bg.a).toBe(1);
      const row = over(token('--settings-row'), bg);
      const pairs: Array<[string, string, Rgba]> = [];
      for (const text of ['--text', '--text-muted', '--text-subtle', '--link', '--error-text', '--warning-text']) pairs.push([text, 'window', bg], [text, 'row', row]);
      pairs.push(['--text', 'field', over(token('--settings-field'), row)], ['--text-subtle', 'field', over(token('--settings-field'), row)]);
      pairs.push(['--text-muted', 'segment track', over(token('--segment-track'), row)], ['--segment-on-text', 'segment on', over(token('--segment-on-bg'), row)]);
      pairs.push(['--primary-text', 'primary', token('--primary-bg')], ['--text', 'quiet', over(token('--quiet-bg'), bg)], ['--link', 'hover', over(token('--hover'), row)]);
      for (const [text, where, background] of pairs) expect(ratio(token(text), background), `${theme} ${text} on ${where}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  // The lab decides (design-lab/src/data.js): the material is its materialVars() of the
  // « opaque-light » preset, and of « dark-glass » at the phase A opacity (.86) in dark.
  it('paints the lab material: opaque-light, and dark-glass at the phase A opacity', () => {
    const preset = (name: string) => new Function(`return (${labData.match(new RegExp(`'${name}': (\\{[^}]*\\})`))![1]})`)() as Record<string, unknown>;
    const source = labData.slice(labData.indexOf('export function materialVars(m) {') + 'export function materialVars(m) {'.length, labData.indexOf('\n}\n', labData.indexOf('export function materialVars')));
    const materialVars = new Function('m', source) as (m: Record<string, unknown>) => Record<string, string>;
    const numbers = (value: string) => value.replace(/-?\d*\.?\d+/g, n => String(+(+n).toFixed(4))).replace(/\s+/g, ' ').trim();
    const cases = [[themes.light, materialVars(preset('opaque-light'))], [themes.dark, materialVars({ ...preset('dark-glass'), bgAlpha: 0.86 })]] as const;
    for (const [tokens, lab] of cases) {
      expect(numbers(resolve(tokens, 'var(--surface-bg)'))).toBe(numbers(lab['--s-bg']));
      expect(numbers(resolve(tokens, 'var(--surface-rim)'))).toBe(numbers(lab['--s-rim']));
      expect(numbers(resolve(tokens, 'var(--surface-shadow)'))).toBe(numbers(lab['--s-shadow']));
      expect(numbers(resolve(tokens, 'var(--surface-sheen)'))).toBe(numbers(lab['--s-sheen']));
    }
    expect([light['--ink-rgb'], darkChoice['--ink-rgb']]).toEqual(['29 29 31', '245 246 248']);
  });
});
