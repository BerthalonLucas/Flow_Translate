import React, { useEffect, useRef, useState } from 'react';
import { LOADERS, FAMILIES, LoaderInner, LoaderFx } from './loaders.jsx';
import { MENUS } from './menus.jsx';
import { GlassChip, Icon } from './Surface.jsx';
import { TEXT_FX, CurvePlot } from './Panel.jsx';
import { MOTION_PRESETS, MATERIAL_PRESETS } from './data.js';
import { CURVES, resolve, animate, progressFn, wait } from './motion.js';
import DATA from './icons-data.js';

const WALL = { bloom: 'radial-gradient(90% 80% at 70% 20%, #CFE2FF 0%, #A9C8F5 28%, #7FA6E6 55%, #5C80C9 100%)', pastel: 'radial-gradient(70% 60% at 15% 10%, #FFE3D3 0%, transparent 60%), radial-gradient(60% 60% at 90% 30%, #E6DCFF 0%, transparent 60%), linear-gradient(160deg, #F7F1EA, #E9EEF7)', photo: 'radial-gradient(120% 90% at 10% 0%, #F2B880 0%, #C86B85 38%, #4B5FA8 75%, #1F2A55 100%)', white: '#F3F3F3', dark: 'radial-gradient(90% 90% at 30% 10%, #2C3345, #151821 70%)' };
const DOC_BG = 'linear-gradient(#fff, #fff)';

function Section({ id, eyebrow, title, desc, right, children }) {
  return <section className="section" id={id} aria-labelledby={`${id}-t`}>
    <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h2 id={`${id}-t`}>{title}</h2>{desc && <p className="muted">{desc}</p>}</div>{right}</div>
    {children}
  </section>;
}

export function LoaderGallery({ cfg, set }) {
  const [fam, setFam] = useState('Tous');
  const [bg, setBg] = useState('doc');
  const list = LOADERS.filter(l => fam === 'Tous' || l.family === fam);
  const background = bg === 'doc' ? DOC_BG : WALL[bg];
  return <Section id="chargements" eyebrow="Indicateurs" title={`${LOADERS.length} indicateurs de chargement`} desc="Tous animés en direct, dans la matière choisie. Clique une carte pour l’utiliser dans le simulateur ; ses réglages fins sont dans l’onglet Chargement."
    right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <div className="seg">{['Tous', ...FAMILIES].map(f => <button key={f} aria-pressed={fam === f} onClick={() => setFam(f)}>{f}</button>)}</div>
      <div className="seg">{[['doc', 'Page blanche'], ['bloom', 'Bleu'], ['photo', 'Coucher'], ['dark', 'Sombre']].map(([k, l]) => <button key={k} aria-pressed={bg === k} onClick={() => setBg(k)}>{l}</button>)}</div>
    </div>}>
    <div className="gallery">{list.map(l => <div key={l.id} className={`card ${cfg.loader === l.id ? 'is-on' : ''}`}>
      <div className="demo" style={{ background }}>
        <GlassChip material={cfg.material} style={{ height: 28, padding: '0 12px', minWidth: 48, display: 'grid', placeItems: 'center' }} fx={<LoaderFx id={l.id} params={cfg.loaderParams[l.id]} />}><LoaderInner id={l.id} params={cfg.loaderParams[l.id]} /></GlassChip>
      </div>
      <div className="meta"><h3>{l.name}<span className="fam">{l.family}</span></h3><p>{l.note}</p>
        <div className="row"><button className="btn" onClick={() => set({ loader: l.id, placement: cfg.placement === 'text' ? 'both' : cfg.placement })}>{cfg.loader === l.id ? 'Utilisé' : 'Utiliser'}</button></div></div>
    </div>)}</div>
  </Section>;
}

export function TextFxGallery({ cfg, set }) {
  return <Section id="texte" eyebrow="Sans bulle" title="Le texte sélectionné montre le travail" desc="La piste façon Writing Tools : aucune pilule, c’est la sélection elle-même qui scintille. Chaque carte tourne en boucle.">
    <div className="gallery">{TEXT_FX.filter(t => t.id !== 'none').map(t => <div key={t.id} className={`card fx-card ${cfg.textFx === t.id ? 'is-on' : ''}`}>
      <div className="demo"><p className="sample-text"><span className="para is-sel"><span className={`tfx-${t.id} ${t.id === 'words' ? 'tfx-words' : ''}`} style={cfg.textFxParams[t.id]}>{t.id === 'words' ? 'Thanks for your notes on the draft; I read them all.'.split(/(\s+)/).map((w, i) => /\s/.test(w) ? w : <span key={i} className="w" style={{ '--i': i / 2 }}>{w}</span>) : 'Thanks for your notes on the draft; I read them all.'}</span></span></p></div>
      <div className="meta"><h3>{t.name}</h3><p>{t.note}</p><div className="row"><button className="btn" onClick={() => set({ textFx: t.id, placement: cfg.placement === 'pill' ? 'text' : cfg.placement })}>Utiliser</button></div></div>
    </div>)}</div>
  </Section>;
}

export function MenuGallery({ cfg, set, tryMenu }) {
  const props = { lang: cfg.lang, iconSet: cfg.iconSet, showIcons: cfg.showIcons && cfg.iconSet !== 'none', showKeys: cfg.showKeys, defaultId: 'fix', onRun: () => {}, onClose: () => {}, preview: true };
  const expandable = ['ilot', 'eventail', 'boussole', 'touches', 'tonalite', 'recette'];
  return <Section id="menus" eyebrow="Ctrl+Alt" title="Les 10 menus" desc="Chaque forme au repos, puis dépliée. « Essayer » la charge dans le simulateur et l’ouvre sur le premier paragraphe : tout se pilote au clavier comme à la souris.">
    <div className="gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>{MENUS.map((m, i) => <div key={m.id} className={`card menu-card ${cfg.menu === m.id ? 'is-on' : ''}`}>
      <div className="demo" style={{ background: WALL[cfg.wall] || WALL.bloom, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: 10 }}>
        <GlassChip material={cfg.material} style={{ height: 'auto', borderRadius: 16 }}><m.C {...props} /></GlassChip>
        {expandable.includes(m.id) && <GlassChip material={cfg.material} style={{ height: 'auto', borderRadius: 16 }}><m.C {...props} initialMode="grid" /></GlassChip>}
      </div>
      <div className="meta"><h3>{i + 1}. {m.name}<span className="fam">{m.from}</span></h3><p>{m.idea}</p>
        <div className="pros"><div><b>Pour</b>{m.pros}</div><div><b>Contre</b>{m.cons}</div></div>
        <p className="small muted" style={{ marginTop: 4 }}><b>Touches :</b> {m.keys}</p>
        <div className="row"><button className="btn primary" onClick={() => tryMenu(m.id)}>Essayer</button><button className="btn" onClick={() => set({ menu: m.id })}>{cfg.menu === m.id ? 'Utilisé' : 'Utiliser'}</button></div></div>
    </div>)}</div>
  </Section>;
}

// Motion lanes: every curve on the same trip, started together, goal at 80 %.
export function MotionGallery({ cfg }) {
  const lanes = [
    ...Object.entries(MOTION_PRESETS).filter(([k]) => k !== 'none').map(([k, m]) => ({ id: `p-${k}`, name: m.label, spec: m.morph, tag: 'transformation' })),
    ...['linear', 'in-quad', 'ease', 'out-back'].map(k => ({ id: `c-${k}`, name: CURVES[k].label, spec: { type: 'curve', curve: k, ms: 600 }, tag: 'courbe' })),
    { id: 'mine', name: 'Ta transformation actuelle', spec: cfg.motion.morph, tag: 'réglage courant' },
  ];
  const tracks = useRef({});
  const [auto, setAuto] = useState(true);
  const play = async () => {
    for (const l of lanes) {
      const t = tracks.current[l.id];
      if (!t) continue;
      const ball = t.querySelector('.lane-ball');
      const dist = Math.round((t.clientWidth - 24) * 0.8);
      t.style.setProperty('--goal', `${dist + 12}px`);
      ball.getAnimations().forEach(a => a.cancel());
      animate(ball, [{ transform: 'translateX(0)' }, { transform: `translateX(${dist}px)` }], l.spec);
    }
  };
  useEffect(() => {
    let alive = true;
    (async () => { while (alive) { if (auto) play(); await wait(2600); } })();
    return () => { alive = false; };
  }, [auto, cfg.motion.morph]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Section id="courbes" eyebrow="Mouvement" title="Courbes et ressorts côte à côte" desc="Même trajet, départ au même moment. La ligne verticale est l’arrivée : un ressort qui rebondit la dépasse puis revient. Passe la vitesse à ¼× pour bien voir."
    right={<div style={{ display: 'flex', gap: 8 }}><button className="btn primary" onClick={play}>Rejouer</button><button className="btn" onClick={() => setAuto(a => !a)}>{auto ? 'Arrêter la boucle' : 'Relancer la boucle'}</button></div>}>
    <div className="lanes">{lanes.map(l => { const r = resolve(l.spec); return <div key={l.id} className="lane">
      <div className="lane-label"><PlotMini spec={l.spec} /><div><b>{l.name}</b><span>{l.spec.type === 'spring' ? `ressort · ${r.duration} ms · rebond ${l.spec.bounce}` : `${l.tag} · ${r.duration} ms`}</span></div></div>
      <div className="lane-track" ref={el => { tracks.current[l.id] = el; }} style={{ '--goal': '80%' }}><span className="lane-ball" /></div>
    </div>; })}</div>
  </Section>;
}
function PlotMini({ spec }) {
  const f = progressFn(spec);
  const vals = Array.from({ length: 41 }, (_, i) => f(i / 40));
  const hi = Math.max(1, ...vals), lo = Math.min(0, ...vals), span = hi - lo;
  const pts = vals.map((v, i) => `${(4 + i / 40 * 50).toFixed(1)},${(36 - (v - lo) / span * 30).toFixed(1)}`).join(' ');
  const goal = 36 - (1 - lo) / span * 30;
  return <svg viewBox="0 0 58 40" aria-hidden="true"><line x1="4" x2="54" y1={goal} y2={goal} /><polyline points={pts} /></svg>;
}

export function MaterialGallery({ cfg, set }) {
  const [bg, setBg] = useState('photo');
  return <Section id="matieres" eyebrow="Matière" title="Matières" desc="La même pilule et le même petit menu dans chaque matière. Choisis un fond pour juger la transparence."
    right={<div className="seg">{[['photo', 'Coucher'], ['bloom', 'Bleu'], ['pastel', 'Pastel'], ['white', 'Blanc'], ['dark', 'Sombre']].map(([k, l]) => <button key={k} aria-pressed={bg === k} onClick={() => setBg(k)}>{l}</button>)}</div>}>
    <div className="gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>{Object.entries(MATERIAL_PRESETS).map(([k, m]) => <div key={k} className={`card ${cfg.materialPreset === k ? 'is-on' : ''}`}>
      <div className="material-stage" style={{ background: WALL[bg] }}>
        <div className="lines" style={{ color: bg === 'white' ? '#333' : 'rgba(255,255,255,.85)' }}>Thanks for your notes on the draft. The appendix will follow on Monday, we are still waiting for the final numbers from finance.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', position: 'relative' }}>
          <GlassChip material={m} style={{ height: 28, padding: '0 12px', display: 'grid', placeItems: 'center' }}><LoaderInner id={cfg.loader} params={cfg.loaderParams[cfg.loader]} /></GlassChip>
          <GlassChip material={m} style={{ height: 34, display: 'flex', alignItems: 'center' }}><div className="m-row"><span className="m-btn is-default">Fix <span className="k">↵</span></span><span className="m-sep" /><span className="m-btn"><span className="ai-dot" /></span></div></GlassChip>
        </div>
      </div>
      <div className="meta"><h3>{m.label}</h3><p>{m.desc}</p><div className="row"><button className="btn" onClick={() => set({ material: m, materialPreset: k })}>{cfg.materialPreset === k ? 'Utilisée' : 'Utiliser'}</button></div></div>
    </div>)}</div>
  </Section>;
}

const ICON_NAMES = { fix: 'Corriger', translate: 'Traduire', professional: 'Pro', shorten: 'Raccourcir', email: 'Mail', custom: 'Consigne', undo: 'Annuler', check: 'Fait', settings: 'Réglages', more: 'Plus', close: 'Fermer', sparkle: 'IA', copy: 'Copier', warning: 'Erreur', key: 'Clé', endpoint: 'Serveur', model: 'Modèle' };
export function IconGallery({ cfg, set }) {
  return <Section id="icones" eyebrow="Icônes" title="Trois jeux d’icônes" desc="Récupérées dans les paquets officiels (Iconoir 7.12, Lucide 1.47, Phosphor 2.1). Affichées à 15 px, leur taille dans les menus.">
    <div className="gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>{['iconoir', 'lucide', 'phosphor'].map(s => <div key={s} className={`card ${cfg.iconSet === s ? 'is-on' : ''}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, padding: 14, color: 'var(--lab-ink)' }}>{Object.keys(ICON_NAMES).map(n => <div key={n} title={ICON_NAMES[n]} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--lab-muted)' }}><span style={{ color: 'var(--lab-ink)' }}><Icon name={n} set={s} size={15} /></span>{ICON_NAMES[n]}</div>)}</div>
      <div className="meta"><h3>{s === 'iconoir' ? 'Iconoir' : s === 'lucide' ? 'Lucide' : 'Phosphor (light)'}<span className="fam">{DATA[s].style === 'fill' ? 'plein' : 'trait'}</span></h3>
        <p>{s === 'iconoir' ? 'Trait fin et régulier, le plus proche d’Apple. Clé et réglages empruntés à Lucide.' : s === 'lucide' ? 'Le plus lisible, métaphores riches ; affiché ici en trait 1,5 pour rester fin.' : 'Très fin à 15 px, peut sembler pâle.'}</p>
        <div className="row"><button className="btn" onClick={() => set({ iconSet: s })}>{cfg.iconSet === s ? 'Utilisé' : 'Utiliser'}</button></div></div>
    </div>)}</div>
  </Section>;
}
