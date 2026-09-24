import React, { useId } from 'react';

// Every loader: id, name, family, verdict (from the research), params (sliders), and a
// render. `kind: 'inner'` sits inside the pill; `kind: 'effect'` paints on the pill itself.
// Params map to CSS custom properties (value + unit).
const P = (key, label, min, max, step, def, unit = '') => ({ key, label, min, max, step, def, unit });

export const LOADERS = [
  { id: 'souffle', name: 'Souffle', family: 'Points', kind: 'inner', note: 'Ta première préférence (avant Perle et Nébuleuse) : les points gonflent et s’allument tour à tour.',
    params: [P('--size', 'Taille des points', 3, 7, .5, 5, 'px'), P('--gap', 'Écart', 2, 7, .5, 4, 'px'), P('--dur', 'Durée du cycle', .6, 2.6, .1, 1.4, 's'), P('--stagger', 'Décalage', 60, 400, 10, 200, 'ms'), P('--min-scale', 'Taille au repos', .3, .95, .01, .62), P('--min-op', 'Opacité au repos', .1, .8, .01, .35)],
    render: () => <span className="ldr souffle"><i /><i /><i /></span> },
  { id: 'vague', name: 'Vague', family: 'Points', kind: 'inner', note: 'Les points montent de 2,5 px et s’éclairent. Propre, familier.',
    params: [P('--amp', 'Amplitude', 1, 5, .5, 2.5, 'px'), P('--size', 'Taille', 3, 6, .5, 4, 'px'), P('--dur', 'Durée', .6, 2.4, .1, 1.2, 's'), P('--stagger', 'Décalage', 60, 300, 10, 150, 'ms')],
    render: () => <span className="ldr vague"><i /><i /><i /></span> },
  { id: 'relais', name: 'Relais', family: 'Points', kind: 'inner', note: 'Une gélule s’étire d’un point à l’autre, comme les pastilles de pages d’iOS.',
    params: [P('--dur', 'Durée', 1.2, 4.5, .1, 2.6, 's'), P('--track', 'Visibilité des points fixes', 0, .4, .01, .16)],
    render: () => <span className="ldr relais"><i /><i /><i /><b /></span> },
  { id: 'duo', name: 'Duo', family: 'Points', kind: 'inner', note: 'Deux points tournent l’un autour de l’autre en 3D. Vivant, discret.',
    params: [P('--r', 'Rayon', 3, 8, .5, 5, 'px'), P('--dur', 'Durée (demi-tour)', .4, 1.6, .05, .8, 's'), P('--depth', 'Profondeur', .4, .9, .01, .6)],
    render: () => <span className="ldr duo"><i /><i /></span> },
  { id: 'quad', name: 'Quadrille', family: 'Points', kind: 'inner', note: 'Quatre points en carré, la lumière tourne. Un peu « tech ».',
    params: [P('--dur', 'Durée', .8, 3, .1, 1.6, 's'), P('--floor', 'Opacité au repos', .05, .5, .01, .2), P('--gap', 'Écart', 2, 5, .5, 3, 'px')],
    render: () => <span className="ldr quad"><i /><i /><i /><i /></span> },
  { id: 'gel', name: 'Gélules', family: 'Points', kind: 'inner', note: 'Les points s’étirent en gélules (mode vocal de ChatGPT). Évolution du Souffle.',
    params: [P('--peak', 'Hauteur max', 6, 12, .5, 11, 'px'), P('--stagger', 'Décalage', 40, 250, 10, 120, 'ms'), P('--dur', 'Durée', .6, 2, .05, 1.1, 's')],
    render: () => <span className="ldr gel"><i /><i /><i /></span> },
  { id: 'bulle', name: 'Bulle', family: 'Points', kind: 'inner', note: 'iMessage : les points ne bougent pas, seule leur teinte passe.',
    params: [P('--dur', 'Durée', .6, 2, .05, 1, 's'), P('--bulge', 'Gonflement', 1, 1.1, .005, 1.04)],
    render: () => <span className="ldr bulle"><i /><i /><i /></span> },
  { id: 'perle', name: 'Perle', family: 'Orbe', kind: 'inner', note: 'Une perle aux couleurs Apple Intelligence qui tourne lentement et respire.',
    params: [P('--size', 'Taille', 8, 20, 1, 14, 'px'), P('--rot', 'Tour complet', 1.2, 6, .1, 3, 's'), P('--blur', 'Flou interne', 0, 5, .5, 2.5, 'px'), P('--breathe', 'Respiration', .75, 1, .01, .9), P('--glow', 'Lueur', 0, .8, .05, .45)],
    render: () => <span className="ldr perle" /> },
  { id: 'neb', name: 'Nébuleuse', family: 'Orbe', kind: 'inner', note: 'Trois taches colorées dérivent dans un disque laiteux, façon Siri. Ne se répète jamais.',
    params: [P('--size', 'Taille', 10, 22, 1, 16, 'px'), P('--amp', 'Dérive', 1, 5, .5, 3, 'px'), P('--blur', 'Flou', 0, 4, .5, 2, 'px')],
    render: () => <span className="ldr neb"><i /><i /><i /></span> },
  { id: 'goutte', name: 'Goutte', family: 'Orbe', kind: 'inner', note: 'Une goutte d’encre lance et rattrape des gouttelettes (filtre « gooey »). Le plus ludique.',
    params: [P('--throw', 'Distance du lancer', 5, 12, .5, 10, 'px'), P('blur', 'Fusion (flou)', 1, 2.6, .1, 1.8), P('gain', 'Netteté des bords', 8, 20, 1, 14)],
    render: p => <Goutte blur={p.blur} gain={p.gain} /> },
  { id: 'etin', name: 'Étincelle', family: 'Symbole', kind: 'inner', note: 'L’étincelle Apple Intelligence traversée d’une bande de couleur. Le plus proche de « l’IA réécrit ».',
    params: [P('--size', 'Taille', 10, 20, 1, 14, 'px'), P('--dur', 'Durée', 1, 3.5, .1, 2, 's'), P('--tilt', 'Inclinaison', 0, 30, 1, 15, 'deg'), P('--floor', 'Taille au repos', .75, 1, .01, .88)],
    render: () => <span className="ldr etin" /> },
  { id: 'morph', name: 'Morphose', family: 'Symbole', kind: 'inner', note: 'Une forme qui se transforme avec un ressort (Material 3 Expressive). Plus Google qu’Apple.',
    params: [P('--size', 'Taille', 10, 18, 1, 14, 'px'), P('color', 'En couleur', 0, 1, 1, 0)],
    render: p => <span className={`ldr morph ${p.color ? 'is-color' : ''}`} /> },
  { id: 'iris', name: 'Iris', family: 'Anneau', kind: 'inner', note: 'Un anneau fin aux couleurs Apple avec un halo. Encore un anneau, mais la couleur porte le sens.',
    params: [P('--size', 'Taille', 10, 20, 1, 14, 'px'), P('--dur', 'Tour complet', 1.2, 6, .1, 2.4, 's'), P('--halo', 'Halo', 0, 5, .5, 2, 'px'), P('--halo-op', 'Opacité du halo', 0, 1, .05, .7)],
    render: () => <span className="ldr iris"><i className="core" /><span className="glow"><i className="core" /></span></span> },
  { id: 'comete', name: 'Comète', family: 'Anneau', kind: 'inner', note: 'Témoin : le plus proche du spinner rejeté.',
    params: [P('--thick', 'Épaisseur', 1, 3, .25, 2, 'px'), P('--tail', 'Traîne vide', 0, 180, 5, 60, 'deg'), P('--dur', 'Tour complet', .6, 2.4, .05, 1.1, 's')],
    render: () => <span className="ldr comete" /> },
  { id: 'onde', name: 'Onde', family: 'Pulsation', kind: 'inner', note: 'Un point et deux cercles qui s’élargissent, comme un sonar. Dit plutôt « en direct ».',
    params: [P('--size', 'Rayon max', 10, 20, 1, 14, 'px'), P('--dur', 'Durée', 1, 3.5, .1, 2, 's'), P('--ring', 'Opacité des cercles', .15, .8, .05, .45)],
    render: () => <span className="ldr onde"><i /></span> },
  { id: 'eq', name: 'Égaliseur', family: 'Barres', kind: 'inner', note: 'Quatre barres qui respirent. Évoque l’audio ou la dictée.',
    params: [P('--min', 'Hauteur mini', .1, .6, .01, .25), P('--w', 'Largeur', 1.5, 3, .25, 2, 'px')],
    render: () => <span className="ldr eq"><i /><i /><i /><i /></span> },
  { id: 'sinus', name: 'Sinus', family: 'Ligne', kind: 'inner', note: 'Une fine onde qui défile, comme l’ancien Siri en miniature.',
    params: [P('--floor', 'Amplitude au repos', .15, .9, .05, .35), P('--dur', 'Durée', .6, 2.4, .1, 1.2, 's')],
    render: () => <Sinus /> },
  { id: 'ruban', name: 'Ruban', family: 'Ligne', kind: 'inner', note: 'Trois ondes colorées (bleu, corail, ambre) qui se croisent. La version « IA » du Sinus.',
    params: [P('--floor', 'Amplitude au repos', .15, .9, .05, .35), P('--dur', 'Durée', .6, 2.4, .1, 1.2, 's')],
    render: () => <Sinus ribbon /> },
  { id: 'reflet', name: 'Reflet', family: 'Effet de pilule', kind: 'effect', note: 'Trois points fixes ; un reflet traverse la pilule toutes les 2 s.',
    params: [P('--dur', 'Période', 1.2, 4, .1, 2.2, 's'), P('--int', 'Intensité', .2, 1, .05, .8), P('--angle', 'Angle', 80, 130, 1, 100, 'deg')],
    inner: () => <span className="static-dots"><i /><i /><i /></span>, fx: () => <span className="fx-reflet" /> },
  { id: 'lisere', name: 'Liseré', family: 'Effet de pilule', kind: 'effect', note: 'Une lumière glisse le long du contour. Très discret.',
    params: [P('--dur', 'Tour complet', 1.2, 5, .1, 2.4, 's'), P('--arc', 'Longueur de la lumière', 40, 180, 5, 100, 'deg'), P('--peak', 'Intensité', .2, .9, .05, .55), P('--bw', 'Épaisseur', .75, 2, .25, 1, 'px')],
    inner: () => <span className="static-dots"><i /><i /><i /></span>, fx: () => <span className="fx-lisere" /> },
  { id: 'faisceau', name: 'Faisceau', family: 'Effet de pilule', kind: 'effect', note: 'Une comète colorée fait le tour du bord. Façon Vercel ou Linear.',
    params: [P('--dur', 'Tour complet', 1.2, 5, .1, 2.6, 's'), P('--len', 'Longueur', 8, 28, 1, 16, 'px'), P('--bw', 'Épaisseur', 1, 2.5, .25, 1.25, 'px')],
    inner: () => <span className="static-dots"><i /><i /><i /></span>, fx: () => <span className="fx-beam"><i /></span> },
  { id: 'aurore', name: 'Aurore', family: 'Effet de pilule', kind: 'effect', note: 'Le contour prend les couleurs Apple Intelligence avec un halo qui respire. Le plus « Apple ».',
    params: [P('--dur', 'Tour complet', 1.5, 8, .1, 3, 's'), P('--bw', 'Épaisseur', 1, 3, .25, 1.5, 'px'), P('--halo', 'Halo', 0, 10, .5, 4, 'px')],
    inner: () => <span className="static-dots"><i /><i /><i /></span>, fx: () => <span className="fx-aurore"><i /><span className="soft"><i /></span></span> },
  { id: 'actuel', name: 'Actuel (rejeté)', family: 'Témoin', kind: 'inner', note: 'Le spinner de la 0.4.0, pour comparer.',
    params: [], render: () => <span className="ldr actuel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg></span> },
];

export const LOADER_BY_ID = Object.fromEntries(LOADERS.map(l => [l.id, l]));
export const FAMILIES = [...new Set(LOADERS.map(l => l.family))];

export function defaultParams(loader) {
  return Object.fromEntries(loader.params.map(p => [p.key, p.def]));
}

// CSS custom properties for a loader's params (non "--" keys are passed as props).
export function paramStyle(loader, values = {}) {
  const style = {};
  for (const p of loader.params) {
    if (!p.key.startsWith('--')) continue;
    const v = values[p.key] ?? p.def;
    style[p.key] = `${v}${p.unit}`;
  }
  return style;
}

function Goutte({ blur = 1.8, gain = 14, style }) {
  const id = `goo-${useId().replace(/:/g, '')}`;
  return <svg style={style} className="ldr goutte" width="36" height="14" viewBox="0 0 36 14" aria-hidden="true">
    <defs><filter id={id} filterUnits="userSpaceOnUse" x="-4" y="0" width="44" height="14" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
      <feColorMatrix in="b" type="matrix" values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${gain} ${-(gain * 0.43).toFixed(2)}`} result="g" />
      <feComposite in="SourceGraphic" in2="g" operator="atop" />
    </filter></defs>
    <g filter={`url(#${id})`}><circle className="g0" cx="18" cy="7" r="3.2" /><circle className="g1" cx="18" cy="7" r="2.4" /><circle className="g2" cx="18" cy="7" r="2.4" /></g>
  </svg>;
}

function Sinus({ ribbon, style }) {
  const id = `sin-${useId().replace(/:/g, '')}`;
  const wave = half => { let d = `M-${half * 4} 6`; for (let i = 0; i < 12; i++) d += ` q${half / 2} ${i % 2 ? 5 : -5} ${half} 0`; return d; };
  return <svg style={style} className={`ldr sinus ${ribbon ? 'ruban' : ''}`} width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-f`} x1="0" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".25" stopColor="#fff" /><stop offset=".75" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <mask id={`${id}-m`}><rect width="28" height="12" fill={`url(#${id}-f)`} /></mask>
    </defs>
    <g mask={`url(#${id}-m)`}><g className="amp">
      <path className="s1" d={wave(6)} />
      {ribbon && <path className="s2" d={wave(8)} />}
      {ribbon && <path className="s3" d={wave(10)} />}
    </g></g>
  </svg>;
}

// Morphose keyframes: seven polar shapes with the same 72 points, so CSS can interpolate.
export function injectMorphKeyframes() {
  if (document.getElementById('ft-morph-kf')) return;
  const SHAPES = [[8, .14], [9, .08], [5, .035], [2, .30], [12, .05], [4, .10], [2, .12]];
  const SPRING = 'linear(0, .054, .185, .352, .527, .69, .827, .934, 1.011, 1.06, 1.086, 1.095, 1.091, 1.079, 1.063, 1.047, 1.031, 1.018, 1.007, 1, .995, .992, .991, .991, .992, .994, 1)';
  const poly = (k, a, n = 72) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / n * 2 * Math.PI, r = 50 * (1 + a * Math.cos(k * t)) / (1 + a);
      pts.push(`${(50 + r * Math.cos(t)).toFixed(2)}% ${(50 + r * Math.sin(t)).toFixed(2)}%`);
    }
    return `polygon(${pts.join(',')})`;
  };
  let css = '@keyframes ft-morph{';
  SHAPES.forEach(([k, a], i) => { css += `${(i * 100 / SHAPES.length).toFixed(3)}%{clip-path:${poly(k, a)};rotate:${(i * 720 / SHAPES.length).toFixed(2)}deg;animation-timing-function:${SPRING}}`; });
  css += `100%{clip-path:${poly(...SHAPES[0])};rotate:720deg}}`;
  const style = document.createElement('style');
  style.id = 'ft-morph-kf';
  style.textContent = css;
  document.head.appendChild(style);
}

// A loader rendered with its params, for a pill (the effect layer is returned separately).
export function LoaderInner({ id, params }) {
  const l = LOADER_BY_ID[id] || LOADERS[0];
  const style = { ...paramStyle(l, params) };
  const values = { ...defaultParams(l), ...params };
  const node = l.kind === 'effect' ? l.inner(values) : l.render(values);
  // Params go on the loader element itself: its class declares the defaults.
  return <span className="ldr-host">{React.cloneElement(node, { style })}</span>;
}
export function LoaderFx({ id, params }) {
  const l = LOADER_BY_ID[id];
  if (!l || l.kind !== 'effect') return null;
  return <span className="ldr-fx-host" style={paramStyle(l, params)}>{l.fx()}</span>;
}
