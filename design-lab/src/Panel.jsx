import React, { useState } from 'react';
import { LOADERS, LOADER_BY_ID, defaultParams, LoaderInner, LoaderFx } from './loaders.jsx';
import { MENUS } from './menus.jsx';
import { MOTION_PRESETS, MATERIAL_PRESETS, OUTCOMES } from './data.js';
import { CURVES, progressFn, resolve } from './motion.js';
import { GlassChip } from './Surface.jsx';

// `real`: can be drawn over another app's selection (UI Automation gives the line boxes),
// without touching its glyphs. The others only exist inside a browser page.
export const TEXT_FX = [
  { id: 'none', name: 'Aucun', real: true, note: 'Le texte ne bouge pas.' },
  { id: 'sweep', name: 'Balayage de lumière', real: true, note: 'Une bande de lumière aux couleurs Apple passe sur la sélection, sans toucher aux lettres.', params: [['--dur', 'Durée', .8, 4, .1, 1.6, 's'], ['--alpha', 'Intensité', .1, .6, .02, .32, '']] },
  { id: 'glow', name: 'Lueur colorée', real: true, note: 'Un léger fond irisé glisse derrière la sélection.', params: [['--dur', 'Durée', 1, 6, .1, 3, 's'], ['--alpha', 'Intensité', .08, .4, .01, .22, '']] },
  { id: 'edge', name: 'Contour lumineux', real: true, note: 'Un liseré coloré entoure les lignes sélectionnées et change doucement de teinte.', params: [['--dur', 'Durée', 1, 6, .1, 2.4, 's']] },
  { id: 'scan', name: 'Soulignement qui balaie', real: true, note: 'Un trait coloré parcourt le bas des lignes (« Proofread » d’Apple).', params: [['--dur', 'Durée', .6, 3, .1, 1.4, 's']] },
  { id: 'veil', name: 'Voile qui respire', real: true, note: 'Un voile blanc pâlit le texte puis se retire (comme si le texte respirait).', params: [['--dur', 'Durée', .8, 3, .1, 1.6, 's'], ['--floor', 'Opacité mini', .2, .8, .05, .45, '']] },
  { id: 'color', name: 'Lettres aux couleurs Apple', real: false, note: 'Les lettres elles-mêmes prennent la couleur. Impossible dans une autre application.', params: [['--dur', 'Durée', .8, 4, .1, 1.8, 's'], ['--base', 'Opacité du texte', .2, .8, .05, .5, '']] },
  { id: 'shimmer', name: 'Lettres qui scintillent', real: false, note: 'Façon ChatGPT. Impossible dans une autre application.', params: [['--dur', 'Durée', .8, 4, .1, 1.8, 's'], ['--base', 'Opacité du texte', .2, .8, .05, .45, '']] },
  { id: 'words', name: 'Vague de mots', real: false, note: 'Mot par mot. Impossible dans une autre application.', params: [['--dur', 'Durée', .8, 3, .1, 1.6, 's']] },
];
export const Badge = ({ real }) => <span className={`badge ${real ? 'ok' : 'demo'}`}>{real ? 'faisable' : 'démo seulement'}</span>;

export function Seg({ value, options, onChange, label }) {
  return <div className="seg" role="group" aria-label={label}>{options.map(([v, l]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
export function Slider({ label, value, min, max, step, unit = '', onChange, fmt }) {
  const shown = fmt ? fmt(value) : `${+(+value).toFixed(3)}${unit}`;
  return <div className="field"><div className="label"><span>{label}</span></div>
    <div className="slider"><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} aria-label={label} /><output>{shown}</output></div></div>;
}
export function Check({ label, checked, onChange }) {
  return <label className="check"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
export function Field({ label, desc, children }) {
  return <div className="field"><div className="label"><span>{label}</span></div>{children}{desc && <span className="desc">{desc}</span>}</div>;
}

export function CurvePlot({ spec, h = 64 }) {
  const f = progressFn(spec);
  const pts = [];
  let lo = 0, hi = 1;
  const vals = Array.from({ length: 61 }, (_, i) => f(i / 60));
  vals.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
  const pad = 0.08, span = hi - lo || 1;
  vals.forEach((v, i) => pts.push(`${(i / 60 * 100).toFixed(2)},${(100 - ((v - lo) / span * (1 - 2 * pad) + pad) * 100).toFixed(2)}`));
  const y1 = 100 - ((1 - lo) / span * (1 - 2 * pad) + pad) * 100;
  const y0 = 100 - ((0 - lo) / span * (1 - 2 * pad) + pad) * 100;
  return <svg className="curve-plot" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: h }} aria-hidden="true">
    <line x1="0" x2="100" y1={y1} y2={y1} /><line x1="0" x2="100" y1={y0} y2={y0} /><polyline points={pts.join(' ')} />
  </svg>;
}

function MotionEditor({ title, desc, spec, onChange }) {
  const r = resolve(spec);
  return <div className="field" style={{ gap: 8 }}>
    <div className="label"><b>{title}</b><span style={{ fontFamily: 'var(--mono)' }}>{r.duration} ms</span></div>
    {desc && <span className="desc">{desc}</span>}
    <Seg value={spec.type} options={[['spring', 'Ressort'], ['curve', 'Courbe']]} onChange={t => onChange(t === 'spring' ? { type: 'spring', duration: 0.35, bounce: 0.15 } : { type: 'curve', curve: 'emil-out', ms: 180 })} />
    {spec.type === 'spring' ? <>
      <Slider label="Durée perçue" value={spec.duration} min={0.1} max={1.2} step={0.01} unit=" s" onChange={v => onChange({ ...spec, duration: v })} />
      <Slider label="Rebond (0 = aucun)" value={spec.bounce} min={-0.4} max={0.6} step={0.01} onChange={v => onChange({ ...spec, bounce: v })} />
    </> : <>
      <select value={spec.curve} onChange={e => onChange({ ...spec, curve: e.target.value })} aria-label="Courbe">{Object.entries(CURVES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
      <Slider label="Durée" value={spec.ms} min={1} max={900} step={1} unit=" ms" onChange={v => onChange({ ...spec, ms: v })} />
    </>}
    <CurvePlot spec={spec} h={52} />
  </div>;
}

const TABS = [['parcours', 'Parcours'], ['menu', 'Menu'], ['chargement', 'Chargement'], ['resultat', 'Résultat'], ['mouvement', 'Mouvement'], ['matiere', 'Matière'], ['simulation', 'Simulation']];

export function Panel({ cfg, set, tab, setTab }) {
  const loader = LOADER_BY_ID[cfg.loader] || LOADERS[0];
  const lp = { ...defaultParams(loader), ...(cfg.loaderParams[cfg.loader] || {}) };
  const setLP = (k, v) => set({ loaderParams: { ...cfg.loaderParams, [cfg.loader]: { ...lp, [k]: v } } });
  const tfx = TEXT_FX.find(t => t.id === cfg.textFx) || TEXT_FX[0];
  const tp = cfg.textFxParams[cfg.textFx] || {};
  const setMotion = patch => set({ motion: { ...cfg.motion, ...patch }, motionPreset: 'custom' });
  const setMat = patch => set({ material: { ...cfg.material, ...patch }, materialPreset: 'custom' });
  const menu = MENUS.find(m => m.id === cfg.menu);

  return <aside className="panel" aria-label="Réglages du labo">
    <div className="tabs" role="tablist">{TABS.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{l}</button>)}</div>
    <div className="panel-body">
      {tab === 'parcours' && <>
        <div className="group">
          <Field label="Déclenchement" desc="Par défaut, rien n’apparaît tant que tu ne fais pas le raccourci. L’autre mode affiche un petit point après chaque sélection à la souris.">
            <Seg value={cfg.trigger} options={[['shortcut', 'Raccourci seulement'], ['selection', 'Point à chaque sélection']]} onChange={v => set({ trigger: v })} />
          </Field>
          <Field label="Raccourci" desc="Sur un clavier AZERTY, Ctrl+Alt équivaut à AltGr : Ctrl+Alt seul se déclenche en tapant @, €, #… Ctrl+Alt+Espace n’a pas ce problème.">
            <Seg value={cfg.shortcut} options={[['ctrl-alt-space', 'Ctrl+Alt+Espace'], ['ctrl-alt', 'Ctrl+Alt seul'], ['double-shift', 'Maj deux fois']]} onChange={v => set({ shortcut: v })} />
          </Field>
          <Field label="Position">
            <Seg value={cfg.anchor} options={[['below', 'Sous la sélection'], ['above', 'Au-dessus'], ['margin', 'Dans la marge']]} onChange={v => set({ anchor: v })} />
          </Field>
          <Check label="Proposer d’abord la dernière action utilisée (Entrée la relance)" checked={cfg.rememberLast} onChange={v => set({ rememberLast: v })} />
        </div>
        <div className="group">
          <h3>Langue et icônes</h3>
          <Field label="Langue de l’app"><Seg value={cfg.lang} options={[['en', 'Anglais'], ['fr', 'Français']]} onChange={v => set({ lang: v })} /></Field>
          <Field label="Jeu d’icônes" desc="Iconoir (trait fin 1,5), Lucide (plus lisible), Phosphor (plein). Toutes récupérées depuis leurs paquets officiels.">
            <Seg value={cfg.iconSet} options={[['iconoir', 'Iconoir'], ['lucide', 'Lucide'], ['phosphor', 'Phosphor'], ['none', 'Aucune']]} onChange={v => set({ iconSet: v })} />
          </Field>
          <Check label="Afficher les icônes dans les menus" checked={cfg.showIcons} onChange={v => set({ showIcons: v })} />
          <Check label="Afficher les touches (↵, lettres)" checked={cfg.showKeys} onChange={v => set({ showKeys: v })} />
        </div>
      </>}

      {tab === 'menu' && <>
        <div className="group">
          <Field label="Forme du menu">
            <select value={cfg.menu} onChange={e => set({ menu: e.target.value })}>{MENUS.map((m, i) => <option key={m.id} value={m.id}>{i + 1}. {m.name}</option>)}</select>
          </Field>
          {menu && <div className="note"><b>{menu.name}.</b> {menu.idea}<br /><br /><b>Touches :</b> {menu.keys}<br /><b>Inspiré de :</b> {menu.from}</div>}
          <p className="small muted">Toutes les formes sont aussi présentées côte à côte plus bas, dans « Les 10 menus ».</p>
        </div>
      </>}

      {tab === 'chargement' && <>
        <div className="group">
          <Field label="Où se voit le travail" desc="« Texte » : pas de pilule, c’est le texte sélectionné qui montre que ça travaille (façon Writing Tools).">
            <Seg value={cfg.placement} options={[['pill', 'Pilule'], ['text', 'Texte'], ['both', 'Les deux'], ['none', 'Rien']]} onChange={v => set({ placement: v })} />
          </Field>
          <Slider label="Délai avant d’afficher l’indicateur" value={cfg.loaderDelay} min={0} max={800} step={10} unit=" ms" onChange={v => set({ loaderDelay: v })} />
          <p className="small muted">Une réponse plus rapide que ce délai n’affiche aucun indicateur, donc aucun clignotement (recommandé : 250 à 500 ms).</p>
          <Field label="Si c’est long (plus de 2,5 s)"><Seg value={cfg.slowLabel} options={[['none', 'Ne rien ajouter'], ['label', 'Ajouter « Working… » qui scintille']]} onChange={v => set({ slowLabel: v })} /></Field>
        </div>
        {(cfg.placement === 'pill' || cfg.placement === 'both') && <div className="group">
          <h3>Indicateur dans la pilule</h3>
          <Field label="Tes favoris"><div className="chips">{['perle', 'neb', 'ruban'].map(id => <button key={id} className="chip" aria-pressed={cfg.loader === id} onClick={() => set({ loader: id })}>{LOADER_BY_ID[id].name}</button>)}</div></Field>
          <div className="picker">{LOADERS.map(l => <button key={l.id} aria-pressed={cfg.loader === l.id} onClick={() => set({ loader: l.id })}>
            <span className="swatch"><GlassChip material={cfg.material} style={{ height: 26, padding: '0 10px', display: 'grid', placeItems: 'center', minWidth: 44 }} fx={<LoaderFx id={l.id} params={cfg.loaderParams[l.id]} />}><LoaderInner id={l.id} params={cfg.loaderParams[l.id]} /></GlassChip></span>{l.name}</button>)}</div>
          <div className="note"><b>{loader.name}.</b> {loader.note}</div>
          {loader.params.map(p => <Slider key={p.key} label={p.label} value={lp[p.key]} min={p.min} max={p.max} step={p.step} unit={p.unit} onChange={v => setLP(p.key, v)} />)}
          {loader.params.length > 0 && <button className="btn" onClick={() => set({ loaderParams: { ...cfg.loaderParams, [cfg.loader]: defaultParams(loader) } })}>Valeurs d’origine</button>}
        </div>}
        {(cfg.placement === 'text' || cfg.placement === 'both') && <div className="group">
          <h3>Effet sur le texte sélectionné</h3>
          <div className="chips">{TEXT_FX.map(t => <button key={t.id} className="chip" aria-pressed={cfg.textFx === t.id} onClick={() => set({ textFx: t.id })}>{t.name}{!t.real && ' ✱'}</button>)}</div>
          <div className="note"><Badge real={tfx.real} /> {tfx.note}</div>
          <Check label="Garder aussi le surlignage bleu de la sélection" checked={cfg.keepSelection} onChange={v => set({ keepSelection: v })} />
          <p className="small muted">✱ Impossible hors du navigateur : FlowTranslate ne peut pas redessiner les lettres d’une autre application. Il peut seulement dessiner par-dessus les lignes sélectionnées.</p>
          {(tfx.params || []).map(([k, l, min, max, step, def, unit]) => <Slider key={k} label={l} value={parseFloat(tp[k] ?? def)} min={min} max={max} step={step} unit={unit} onChange={v => set({ textFxParams: { ...cfg.textFxParams, [cfg.textFx]: { ...tp, [k]: `${v}${unit}` } } })} />)}
        </div>}
      </>}

      {tab === 'resultat' && <>
        <div className="group">
          <Field label="Arrivée du nouveau texte">
            <Seg value={cfg.replaceFx} options={[['instant', 'Net'], ['fade', 'Fondu'], ['crossblur', 'Flou → net ✱'], ['blur', 'Mot à mot flou ✱'], ['rise', 'Mot à mot qui monte ✱'], ['type', 'Machine à écrire ✱']]} onChange={v => set({ replaceFx: v })} />
            <span className="desc">✱ Démo seulement : le texte est collé d’un coup dans l’autre application. « Fondu » reste faisable avec un voile qui s’efface par-dessus.</span>
          </Field>
          {['blur', 'rise', 'type'].includes(cfg.replaceFx) && <Slider label="Décalage entre les mots" value={cfg.replaceParams.stagger} min={5} max={80} step={1} unit=" ms" onChange={v => set({ replaceParams: { ...cfg.replaceParams, stagger: v } })} />}
          {['blur', 'crossblur'].includes(cfg.replaceFx) && <Slider label="Flou de départ" value={cfg.replaceParams.blur} min={1} max={14} step={.5} unit=" px" onChange={v => set({ replaceParams: { ...cfg.replaceParams, blur: v } })} />}
          {cfg.replaceFx !== 'instant' && cfg.replaceFx !== 'type' && <Slider label="Durée" value={cfg.replaceParams.dur} min={80} max={900} step={10} unit=" ms" onChange={v => set({ replaceParams: { ...cfg.replaceParams, dur: v } })} />}
        </div>
        <div className="group">
          <Field label="Mots changés" desc="Traduction, mail et consigne libre changent tout : c’est alors tout le bloc qui est marqué. Faisable par-dessus les mots dans les applications qui exposent leur texte (Word, Outlook, Edge, Chrome…).">
            <Seg value={cfg.diff} options={[['undo', 'Surligné tant qu’on peut annuler'], ['fade', 'Surligné puis s’efface'], ['persist', 'Surligné jusqu’au clic'], ['underline', 'Souligné coloré'], ['off', 'Rien']]} onChange={v => set({ diff: v })} />
          </Field>
          {cfg.diff === 'fade' && <>
            <Slider label="Reste visible" value={cfg.diffHold} min={0} max={3000} step={50} unit=" ms" onChange={v => set({ diffHold: v })} />
            <Slider label="Puis s’efface en" value={cfg.diffFade} min={200} max={4000} step={50} unit=" ms" onChange={v => set({ diffFade: v })} />
          </>}
        </div>
        <div className="group">
          <Check label="Coche de confirmation" checked={cfg.check} onChange={v => set({ check: v })} />
          <Check label="Bouton Annuler (et Ctrl+Z)" checked={cfg.undo} onChange={v => set({ undo: v })} />
          {cfg.undo && <Slider label="Annulation possible pendant" value={cfg.undoSeconds} min={2} max={20} step={1} unit=" s" onChange={v => set({ undoSeconds: v })} />}
          <p className="small muted">Le compte à rebours se met en pause quand la souris est sur la pilule. Sans coche ni Annuler, la pilule disparaît dès le remplacement.</p>
        </div>
        <div className="group">
          <Field label="Style des erreurs"><Seg value={cfg.errorStyle} options={[['pill', 'Pilule compacte'], ['card', 'Petite carte détaillée']]} onChange={v => set({ errorStyle: v })} /></Field>
          <p className="small muted">Déclenche une erreur dans l’onglet « Simulation ».</p>
        </div>
      </>}

      {tab === 'mouvement' && <>
        <div className="group">
          <Field label="Préréglage">
            <div className="chips">{Object.entries(MOTION_PRESETS).map(([k, m]) => <button key={k} className="chip" aria-pressed={cfg.motionPreset === k} onClick={() => set({ motion: m, motionPreset: k })}>{m.label}</button>)}</div>
          </Field>
          {MOTION_PRESETS[cfg.motionPreset] && <div className="note">{MOTION_PRESETS[cfg.motionPreset].desc}</div>}
          {cfg.motionPreset === 'custom' && <div className="note">Réglages personnels.</div>}
        </div>
        <div className="group">
          <MotionEditor title="Apparition" desc="Le menu ou la pilule qui arrive." spec={cfg.motion.enter} onChange={s => setMotion({ enter: s })} />
          <Slider label="Taille de départ" value={cfg.motion.fromScale} min={0.8} max={1} step={0.01} onChange={v => setMotion({ fromScale: v })} />
          <Slider label="Glissement de départ" value={cfg.motion.travel} min={0} max={16} step={1} unit=" px" onChange={v => setMotion({ travel: v })} />
        </div>
        <div className="group"><MotionEditor title="Transformation" desc="Le menu qui devient pilule, la pilule qui devient résultat." spec={cfg.motion.morph} onChange={s => setMotion({ morph: s })} /></div>
        <div className="group"><MotionEditor title="Disparition" spec={cfg.motion.exit} onChange={s => setMotion({ exit: s })} /></div>
        <div className="group"><MotionEditor title="Fondu du contenu" desc="Le contenu qui change à l’intérieur." spec={cfg.motion.content} onChange={s => setMotion({ content: s })} /></div>
      </>}

      {tab === 'matiere' && <>
        <div className="group">
          <Field label="Thème" desc="Comme l’app : suit le thème de l’appareil, ou forcé.">
            <Seg value={cfg.theme} options={[['system', 'Suivre l’appareil'], ['light', 'Clair'], ['dark', 'Sombre']]} onChange={v => set({ theme: v })} />
          </Field>
          <Field label="Matière du thème clair">
            <div className="chips">{Object.entries(MATERIAL_PRESETS).filter(([, m]) => !m.dark).map(([k, m]) => <button key={k} className="chip" aria-pressed={cfg.materialLightPreset === k} onClick={() => set({ material: m, materialPreset: k })}>{m.label}</button>)}</div>
          </Field>
          <Field label="Matière du thème sombre">
            <div className="chips">{Object.entries(MATERIAL_PRESETS).filter(([, m]) => m.dark).map(([k, m]) => <button key={k} className="chip" aria-pressed={cfg.materialDarkPreset === k} onClick={() => set({ material: m, materialPreset: k })}>{m.label}</button>)}</div>
          </Field>
          {MATERIAL_PRESETS[cfg.materialPreset] && <div className="note">{MATERIAL_PRESETS[cfg.materialPreset].desc}</div>}
          <Field label="Fond d’écran du faux bureau"><Seg value={cfg.wall} options={[['bloom', 'Bleu'], ['pastel', 'Pastel'], ['photo', 'Coucher'], ['white', 'Blanc'], ['dark', 'Sombre']]} onChange={v => set({ wall: v })} /></Field>
        </div>
        <div className="group">
          <p className="small muted">Les réglages ci-dessous modifient la matière du thème <b>{cfg.material.dark ? 'sombre' : 'clair'}</b>.</p>
          <Slider label="Opacité du fond" value={cfg.material.bgAlpha} min={0.05} max={1} step={0.01} onChange={v => setMat({ bgAlpha: v })} />
          <Slider label="Flou derrière" value={cfg.material.blur} min={0} max={60} step={1} unit=" px" onChange={v => setMat({ blur: v })} />
          <Slider label="Saturation derrière" value={cfg.material.saturate} min={100} max={220} step={5} unit=" %" onChange={v => setMat({ saturate: v })} />
          <Slider label="Teinte (gris → blanc)" value={cfg.material.tint} min={cfg.material.dark ? 10 : 225} max={cfg.material.dark ? 60 : 255} step={1} onChange={v => setMat({ tint: v })} />
          <Slider label="Contour" value={cfg.material.hairline} min={0} max={0.3} step={0.01} onChange={v => setMat({ hairline: v })} />
          <Slider label="Reflet du haut" value={cfg.material.rim} min={0} max={1} step={0.05} onChange={v => setMat({ rim: v })} />
          <Slider label="Éclat en diagonale" value={cfg.material.sheen} min={0} max={0.7} step={0.05} onChange={v => setMat({ sheen: v })} />
          <Slider label="Grain" value={cfg.material.noise} min={0} max={0.2} step={0.01} onChange={v => setMat({ noise: v })} />
          <Slider label="Ombre (intensité)" value={cfg.material.shadow} min={0} max={0.45} step={0.01} onChange={v => setMat({ shadow: v })} />
          <Slider label="Ombre (flou)" value={cfg.material.shadowBlur} min={4} max={60} step={1} unit=" px" onChange={v => setMat({ shadowBlur: v })} />
          <Slider label="Ombre (décalage)" value={cfg.material.shadowY} min={0} max={24} step={1} unit=" px" onChange={v => setMat({ shadowY: v })} />
          {!cfg.material.lockRadius && <Slider label="Arrondi des grandes surfaces" value={cfg.material.radius} min={6} max={28} step={1} unit=" px" onChange={v => setMat({ radius: v })} />}
          {cfg.material.lockRadius && <p className="small muted">Avec l’Acrylic de Windows, les coins sont imposés à 8 px (ou 4 px). La pilule ne peut plus être parfaitement ronde.</p>}
        </div>
        <div className="note"><b>Important.</b> Ici, le flou fonctionne parce que le bureau est dessiné dans la page. Dans l’app, la fenêtre de FlowTranslate ne voit pas ce qu’il y a derrière elle : il faut l’Acrylic de Windows (coins 8 px, pas de fondu) ou une capture de l’écran. Sans cela, seuls les préréglages « Clair sans transparence » et « Graphite » sont fidèles.</div>
      </>}

      {tab === 'simulation' && <>
        <div className="group">
          <Slider label="Temps de réponse du modèle" value={cfg.latency} min={150} max={6000} step={50} unit=" ms" onChange={v => set({ latency: v })} fmt={v => `${(v / 1000).toFixed(2).replace('.', ',')} s`} />
          <div className="chips">{[[400, '0,4 s'], [900, '0,9 s'], [1400, '1,4 s'], [2500, '2,5 s'], [4000, '4 s']].map(([v, l]) => <button key={v} className="chip" aria-pressed={cfg.latency === v} onClick={() => set({ latency: v })}>{l}</button>)}</div>
          <Check label="Tenir le chargement jusqu’à ce que je clique « Terminer »" checked={cfg.hold} onChange={v => set({ hold: v })} />
        </div>
        <div className="group">
          <Field label="Issue de la prochaine action">
            <select value={cfg.outcome} onChange={e => set({ outcome: e.target.value })}>{OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          </Field>
          <p className="small muted">Les erreurs de configuration (serveur, clé, modèle) ont un bouton qui ouvre les Réglages directement sur le bon champ. Les autres n’en ont pas : tu n’y peux rien.</p>
        </div>
      </>}
    </div>
  </aside>;
}
