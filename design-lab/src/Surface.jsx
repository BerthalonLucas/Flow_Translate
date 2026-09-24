import React, { useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import { animate, resolve, clock } from './motion.js';
import { materialVars } from './data.js';
import DATA from './icons-data.js';

export function Icon({ name, set = 'iconoir', size = 15, stroke }) {
  const s = DATA[set] || DATA.iconoir;
  const inner = s.icons[name];
  if (!inner) return null;
  const attrs = s.style === 'fill'
    ? { fill: 'currentColor' }
    : { fill: 'none', stroke: 'currentColor', strokeWidth: stroke ?? 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return <svg className="ico" width={size} height={size} viewBox={s.viewBox} {...attrs} aria-hidden="true" dangerouslySetInnerHTML={{ __html: inner }} />;
}

// One object that changes shape: its content swaps by `contentKey` (cross-fade) while the
// outer box springs from the old size to the new one. Enter/exit use the motion specs.
export function Surface({ open, pos, grow = 'down', contentKey, children, material, motion, fx, glow, onExited, className = '', style }) {
  const outer = useRef(null);
  const current = useRef(null);
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState([]);
  const prev = useRef({ key: contentKey, node: children });
  const size = useRef(null);
  const filterId = `lq${useId().replace(/:/g, '')}`;
  const [liquidSize, setLiquidSize] = useState(null);

  // Mount on open; exit animation, then unmount.
  useEffect(() => {
    if (open) { setMounted(true); return; }
    if (!mounted || !outer.current) return;
    let cancelled = false;
    const m = motion;
    const s = m.fromScale + (1 - m.fromScale) / 2;
    animate(outer.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `scale(${s})` }], m.exit).then(() => {
      if (cancelled) return;
      setMounted(false); size.current = null; setLeaving([]); onExited?.();
    });
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter animation when mounted.
  useLayoutEffect(() => {
    if (!mounted || !open || !outer.current) return;
    const m = motion;
    const dy = grow === 'up' ? m.travel : -m.travel;
    outer.current.getAnimations().forEach(a => { if (a.effect?.getKeyframes?.().some(k => 'opacity' in k)) a.cancel(); });
    animate(outer.current, [{ opacity: 0, transform: `translateY(${dy}px) scale(${m.fromScale})` }, { opacity: 1, transform: 'none' }], m.enter);
  }, [mounted, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Content swap: the previous content fades out on its own layer.
  useLayoutEffect(() => {
    if (prev.current.key === contentKey) { prev.current.node = children; return; }
    const old = prev.current;
    prev.current = { key: contentKey, node: children };
    if (!mounted) return;
    const id = `${old.key}-${performance.now()}`;
    setLeaving(list => [...list.slice(-1), { id, key: old.key, node: old.node }]);
    if (current.current) {
      const c = resolve(motion.content);
      animate(current.current, [{ opacity: 0 }, { opacity: 1 }], { easing: c.easing, duration: c.duration }, { delay: Math.min(90, c.duration / 2) });
    }
  }, [contentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The outer box follows the current layer's natural size with the morph spec.
  useLayoutEffect(() => {
    const el = current.current, box = outer.current;
    if (!mounted || !el || !box) return;
    const lockRadius = material.lockRadius;
    const radiusFor = h => lockRadius ? material.radius : (h <= 44 ? h / 2 : material.radius);
    const apply = () => {
      const w = Math.ceil(el.offsetWidth), h = Math.ceil(el.offsetHeight);
      if (!w || !h) return;
      const target = { width: `${w}px`, height: `${h}px`, borderRadius: `${radiusFor(h)}px` };
      // Keep the whole surface inside its container (menus can be wider than expected).
      const parent = box.offsetParent;
      if (parent && pos && typeof pos.left === 'number') {
        const left = Math.max(8, Math.min(pos.left, parent.clientWidth - w - 10));
        box.style.left = `${left}px`;
      }
      if (!size.current) {
        Object.assign(box.style, target);
        size.current = { w, h };
        setLiquidSize({ w, h });
        return;
      }
      if (size.current.w === w && size.current.h === h) return;
      const from = { width: `${box.offsetWidth}px`, height: `${box.offsetHeight}px`, borderRadius: getComputedStyle(box).borderRadius };
      box.getAnimations().forEach(a => { if (a.effect?.getKeyframes?.().some(k => 'width' in k)) a.cancel(); });
      Object.assign(box.style, target);
      size.current = { w, h };
      animate(box, [from, target], motion.morph, { fill: 'none' }).then(() => setLiquidSize({ w, h }));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, contentKey, material.radius, material.lockRadius]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  const vars = materialVars(material);
  if (material.liquid) vars['--s-backdrop'] = vars['--s-backdrop'].replace('#ft-liquid', `#${filterId}`);
  const cls = `surface ${material.dark ? 'is-dark' : ''} ${grow === 'up' ? 'grow-up' : ''} ${className}`;
  return <div ref={outer} className={cls} style={{ ...vars, ...pos, ...style }} data-surface>
    {material.liquid && liquidSize && <LiquidDefs id={filterId} w={liquidSize.w} h={liquidSize.h} />}
    <div className="s-bg" />
    <div className="s-noise" />
    <div className="s-fx">{glow}{fx}</div>
    <div className="s-clip">
      {leaving.map(l => <Leaving key={l.id} node={l.node} spec={motion.content} onDone={() => setLeaving(list => list.filter(x => x.id !== l.id))} />)}
      <div ref={current} className="layer" key={contentKey}>{children}</div>
    </div>
  </div>;
}

function Leaving({ node, spec, onDone }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const c = resolve(spec);
    animate(ref.current, [{ opacity: 1 }, { opacity: 0 }], { easing: 'cubic-bezier(.4,0,1,1)', duration: Math.max(1, Math.round(c.duration * 0.6)) }).then(onDone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className="layer is-leaving" aria-hidden="true">{node}</div>;
}

// Liquid-glass displacement map for a w×h rounded box (adapted from Shu Ding, MIT).
const mapCache = new Map();
function buildMap(W, H, bevel = 0.15, minZoom = 0.8) {
  const key = `${W}x${H}`;
  if (mapCache.has(key)) return mapCache.get(key);
  const ss = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
  const sdf = (x, y, w, h, r) => { const qx = Math.abs(x) - w + r, qy = Math.abs(y) - h + r; return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r; };
  const a = W / H, raw = new Float32Array(W * H * 2);
  let max = 0;
  for (let y = 0, j = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ix = (x + .5) / W - .5, iy = (y + .5) / H - .5;
    const s = ss(0, 1, ss(bevel, 0, -sdf(ix * a, iy, .5 * a, .5, .5)));
    const k = minZoom + (1 - minZoom) * s;
    const dx = (ix * k + .5) * W - (x + .5), dy = (iy * k + .5) * H - (y + .5);
    max = Math.max(max, Math.abs(dx), Math.abs(dy));
    raw[j++] = dx; raw[j++] = dy;
  }
  max = Math.max(max, 1e-3);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), im = g.createImageData(W, H);
  for (let i = 0, j = 0; i < im.data.length; i += 4) { im.data[i] = (raw[j++] / max / 2 + .5) * 255; im.data[i + 1] = (raw[j++] / max / 2 + .5) * 255; im.data[i + 2] = 128; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  const out = { url: c.toDataURL(), scale: max * 2 };
  mapCache.set(key, out);
  return out;
}
function LiquidDefs({ id, w, h }) {
  const { url, scale } = buildMap(Math.max(8, Math.round(w)), Math.max(8, Math.round(h)));
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <filter id={id} filterUnits="userSpaceOnUse" x="0" y="0" width={w} height={h} colorInterpolationFilters="sRGB">
      <feImage href={url} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>;
}

// A static glass chip for galleries (no morph).
export function GlassChip({ material, children, style, className = '', fx }) {
  const filterId = `lq${useId().replace(/:/g, '')}`;
  const ref = useRef(null);
  const [sz, setSz] = useState(null);
  useLayoutEffect(() => { if (material.liquid && ref.current) setSz({ w: ref.current.offsetWidth, h: ref.current.offsetHeight }); }, [material.liquid]);
  const vars = materialVars(material);
  if (material.liquid) vars['--s-backdrop'] = vars['--s-backdrop'].replace('#ft-liquid', `#${filterId}`);
  const h = style?.height ?? 28;
  const radius = material.lockRadius ? material.radius : (typeof h === 'number' && h <= 44 ? h / 2 : material.radius);
  return <div ref={ref} className={`surface ${material.dark ? 'is-dark' : ''} ${className}`} style={{ position: 'relative', borderRadius: radius, ...vars, ...style }}>
    {material.liquid && sz && <LiquidDefs id={filterId} w={sz.w} h={sz.h} />}
    <div className="s-bg" /><div className="s-noise" />
    <div className="s-fx">{fx}</div>
    <div style={{ position: 'relative' }}>{children}</div>
  </div>;
}

export { clock };
