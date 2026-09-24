// Motion helpers: springs as CSS linear(), named curves, a page-wide playback rate (slow
// motion) and the lab's own reduced-motion switch.
import { springToLinear, springSolver, fromAppleDurationBounce, fromDampingRatio, toAppleDurationBounce } from './spring.js';

export { fromAppleDurationBounce, fromDampingRatio, toAppleDurationBounce };

const cache = new Map();
// { easing: 'linear(...)', duration: ms, fn: progress → value } for a spring given as
// Apple-style duration (s) and bounce (−1…1).
export function spring(duration = 0.35, bounce = 0.15) {
  const key = `${duration}|${bounce}`;
  if (cache.has(key)) return cache.get(key);
  const phys = fromAppleDurationBounce(Math.max(0.05, duration), Math.max(-0.9, Math.min(0.9, bounce)));
  const lin = springToLinear(phys);
  const solver = springSolver(phys);
  const T = lin.duration / 1000;
  const result = { easing: lin.easing, duration: lin.duration, fn: p => solver.pos(p * T), phys };
  cache.set(key, result);
  return result;
}

// Named cubic-bézier curves with their sources.
export const CURVES = {
  'emil-out': { label: 'Sortie douce (Emil)', css: 'cubic-bezier(0.23,1,0.32,1)' },
  'fluent-in': { label: 'Windows 11 « Fast In »', css: 'cubic-bezier(0,0,0,1)' },
  'fluent-p2p': { label: 'Windows 11 « Point to Point »', css: 'cubic-bezier(0.55,0.55,0,1)' },
  'm3-standard': { label: 'Material 3 standard', css: 'cubic-bezier(0.2,0,0,1)' },
  'm3-decel': { label: 'Material 3 emphasized decelerate', css: 'cubic-bezier(0.05,0.7,0.1,1)' },
  'out-quart': { label: 'easeOutQuart', css: 'cubic-bezier(0.25,1,0.5,1)' },
  'out-expo': { label: 'easeOutExpo', css: 'cubic-bezier(0.16,1,0.3,1)' },
  'out-back': { label: 'easeOutBack (dépasse)', css: 'cubic-bezier(0.34,1.56,0.64,1)' },
  'in-out-cubic': { label: 'easeInOutCubic', css: 'cubic-bezier(0.65,0,0.35,1)' },
  'ease': { label: 'ease (navigateur)', css: 'ease' },
  'linear': { label: 'Linéaire', css: 'linear' },
  'in-quad': { label: 'Accélère (ease-in)', css: 'cubic-bezier(0.55,0,1,0.45)' },
  'fluent-out': { label: 'Windows 11 « Soft Out »', css: 'cubic-bezier(1,0,1,1)' },
};

// A motion spec: { type: 'spring', duration, bounce } or { type: 'curve', curve, ms }.
export function resolve(spec) {
  if (!spec) return { easing: 'linear', duration: 0 };
  if (spec.type === 'spring') { const s = spring(spec.duration, spec.bounce); return { easing: s.easing, duration: s.duration }; }
  return { easing: (CURVES[spec.curve] || CURVES['emil-out']).css, duration: spec.ms };
}

// Progress function for previews (curves drawn in the lab).
export function progressFn(spec) {
  if (spec.type === 'spring') return spring(spec.duration, spec.bounce).fn;
  const css = (CURVES[spec.curve] || CURVES['emil-out']).css;
  if (css === 'linear') return t => t;
  if (css === 'ease') return bezier(0.25, 0.1, 0.25, 1);
  const m = /cubic-bezier\(([^)]+)\)/.exec(css);
  const v = m ? m[1].split(',').map(Number) : [0.25, 0.1, 0.25, 1];
  return bezier(...v);
}

export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return t => {
    let u = t;
    for (let i = 0; i < 10; i++) {
      const x = ((ax * u + bx) * u + cx) * u - t;
      const d = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(d) < 1e-6) break;
      u -= x / d;
    }
    u = Math.max(0, Math.min(1, u));
    return ((ay * u + by) * u + cy) * u;
  };
}

export const SPRING_FALLBACK = 'cubic-bezier(0.34,1.3,0.64,1)';
export const LINEAR_OK = typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)');

// ——— Page-wide clock: playback rate (slow motion) and reduced motion ———
export const clock = { rate: 1, reduced: false };
const listeners = new Set();
export function onClock(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setClock(patch) {
  Object.assign(clock, patch);
  const root = document.documentElement;
  root.dataset.motion = clock.reduced ? 'reduced' : 'full';
  root.style.setProperty('--rate', String(clock.rate));
  applyRate();
  listeners.forEach(fn => fn(clock));
}
export function applyRate() {
  for (const a of document.getAnimations()) if (a.playbackRate !== clock.rate) a.playbackRate = clock.rate;
}
setInterval(applyRate, 40);

// Wait scaled by the playback rate; `signal` (AbortSignal) ends it early.
export function wait(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve(false);
    const t = setTimeout(() => resolve(true), clock.reduced ? Math.min(ms, 300) : ms / clock.rate);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(false); }, { once: true });
  });
}

// Web Animations with the lab clock applied. `spec` is a motion spec or { easing, duration }.
// `force` keeps the motion even under reduced motion (the curve comparisons exist to be seen).
export function animate(node, frames, spec, extra = {}) {
  if (!node) return Promise.resolve(null);
  const { easing, duration } = spec.easing ? spec : resolve(spec);
  const { force, ...rest } = extra;
  const options = { fill: 'both', easing, duration, ...rest };
  if (clock.reduced && !force) {
    // Reduced motion keeps fades short and drops movement: only opacity frames survive.
    const opacityOnly = frames.map(f => ('opacity' in f ? { opacity: f.opacity } : {}));
    const hasOpacity = opacityOnly.some(f => 'opacity' in f);
    options.duration = hasOpacity ? 120 : 1; options.easing = 'linear'; options.delay = 0;
    frames = hasOpacity ? opacityOnly : [frames[frames.length - 1], frames[frames.length - 1]];
  }
  let a;
  try { a = node.animate(frames, options); }
  catch { a = node.animate(frames, { ...options, easing: SPRING_FALLBACK }); } // linear() unsupported
  a.playbackRate = clock.rate;
  return a.finished.then(() => a, () => a);
}
