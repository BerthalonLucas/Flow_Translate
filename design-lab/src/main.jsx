import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulator } from './Simulator.jsx';
import { Panel, Seg, TEXT_FX } from './Panel.jsx';
import { LoaderGallery, TextFxGallery, MenuGallery, MotionGallery, MaterialGallery, IconGallery } from './Galleries.jsx';
import { DEFAULTS, PARAGRAPHS, MOTION_PRESETS, MATERIAL_PRESETS, OUTCOME_BY_ID } from './data.js';
import { MENU_BY_ID } from './menus.jsx';
import { LOADER_BY_ID, injectMorphKeyframes } from './loaders.jsx';
import { setClock, resolve } from './motion.js';

const STORE = 'flowtranslate-labo-v1';
function load() {
  try { const raw = localStorage.getItem(STORE); if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }; } catch { /* storage unavailable */ }
  return DEFAULTS;
}
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
const SHORTCUT = { 'ctrl-alt-space': 'Ctrl+Alt+Espace', 'ctrl-alt': 'Ctrl+Alt', 'double-shift': 'Maj Maj' };

function App() {
  const [cfg, setCfg] = useState(load);
  const set = patch => setCfg(c => ({ ...c, ...patch }));
  const [tab, setTab] = useState('parcours');
  const [rate, setRate] = useState(1);
  const [animMode, setAnimMode] = useState('system');
  const [sysReduced, setSysReduced] = useState(mq.matches);
  const [status, setStatus] = useState('Sélectionne un paragraphe du mail, puis fais le raccourci.');
  const [phase, setPhase] = useState('idle');
  const [exported, setExported] = useState(null);
  const api = useRef({});
  const stageRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch { /* ignore */ } }, [cfg]);
  useEffect(() => { injectMorphKeyframes(); const on = () => setSysReduced(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener?.('change', on); }, []);
  const reduced = animMode === 'reduced' || (animMode === 'system' && sysReduced);
  useEffect(() => { setClock({ rate, reduced }); }, [rate, reduced]);

  const tryMenu = id => {
    set({ menu: id });
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { api.current.select?.(['p1']); setTimeout(() => api.current.open?.(), 60); }, 380);
  };

  const exportCfg = async () => {
    const text = summary(cfg);
    try { await navigator.clipboard.writeText(text); setExported({ text, copied: true }); }
    catch { setExported({ text, copied: false }); }
  };

  return <div className="lab">
    <header className="lab-head">
      <div>
        <span className="eyebrow">FlowTranslate · labo d’interface</span>
        <h1>Labo FlowTranslate</h1>
        <p className="muted">Un faux bureau avec un mail : sélectionne un paragraphe, fais le raccourci, choisis une action. Tout est simulé (aucun modèle), et tout se règle à droite. En bas : chaque indicateur, menu, courbe et matière côte à côte.</p>
      </div>
    </header>

    <div className="toolbar" role="toolbar" aria-label="Lecture">
      <div className="grp"><span>Vitesse</span><Seg label="Vitesse" value={rate} options={[[1, '1×'], [0.5, '½×'], [0.25, '¼×'], [0.1, '⅒×']]} onChange={setRate} /></div>
      <div className="grp"><span>Animations</span><Seg label="Animations" value={animMode} options={[['system', 'Comme Windows'], ['full', 'Toujours'], ['reduced', 'Réduites']]} onChange={setAnimMode} /></div>
      <span className="spacer" />
      <button className="btn primary" onClick={exportCfg}>Copier ma config</button>
      <button className="btn" onClick={() => { setCfg(DEFAULTS); api.current.resetText?.(); }}>Tout remettre à zéro</button>
    </div>

    {sysReduced && animMode === 'system' && <div className="banner" role="status">
      <b>Les animations de Windows sont coupées sur cet appareil.</b> La page les coupe aussi, comme le fait l’app. <button className="btn" onClick={() => setAnimMode('full')}>Afficher les animations quand même</button>
    </div>}

    {exported && <div className="note" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span><b>{exported.copied ? 'Config copiée.' : 'Copie refusée par l’app : sélectionne le texte ci-dessous.'}</b> Colle-la moi telle quelle.</span>
      <textarea readOnly value={exported.text} rows={8} onFocus={e => e.target.select()} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setExported(null)}>Fermer</button>
    </div>}

    <div className="lab-main">
      <div className="stage-col" ref={stageRef}>
        <div className="stage-bar">
          <button className="btn primary" onClick={() => api.current.open?.()}>Ouvrir le menu <kbd style={{ background: 'rgba(255,255,255,.2)', borderColor: 'transparent', color: '#fff' }}>{SHORTCUT[cfg.shortcut]}</kbd></button>
          <div className="seg" aria-label="Sélection">
            {PARAGRAPHS.map((p, i) => <button key={p.id} onClick={() => api.current.select?.([p.id])}>¶{i + 1}</button>)}
            <button onClick={() => api.current.select?.(PARAGRAPHS.map(p => p.id))}>Tout</button>
          </div>
          {phase === 'working' && cfg.hold && <button className="btn" onClick={() => api.current.finish?.()}>Terminer le chargement</button>}
          <button className="btn ghost" onClick={() => api.current.resetText?.()}>Remettre le texte</button>
          <span className="status" aria-live="polite">{status}</span>
        </div>
        <Simulator cfg={cfg} set={set} onStatus={setStatus} onPhase={setPhase} api={api} />
        <p className="hint">Astuces : clique un paragraphe (ou glisse la souris) pour le sélectionner, Maj+clic pour en ajouter. Au clavier dans les menus : Entrée relance la dernière action, F T P S E choisissent, Espace ouvre la consigne libre, Échap ferme. Après remplacement : Ctrl+Z annule.</p>
      </div>
      <Panel cfg={cfg} set={set} tab={tab} setTab={setTab} />
    </div>

    <MenuGallery cfg={cfg} set={set} tryMenu={tryMenu} />
    <LoaderGallery cfg={cfg} set={set} />
    <TextFxGallery cfg={cfg} set={set} />
    <MotionGallery cfg={cfg} />
    <MaterialGallery cfg={cfg} set={set} />
    <IconGallery cfg={cfg} set={set} />
  </div>;
}

function spec(s) { const r = resolve(s); return s.type === 'spring' ? `ressort ${s.duration}s rebond ${s.bounce} (${r.duration} ms)` : `${s.curve} ${s.ms} ms`; }
function summary(cfg) {
  const menu = MENU_BY_ID[cfg.menu];
  const loader = LOADER_BY_ID[cfg.loader];
  const tfx = TEXT_FX.find(t => t.id === cfg.textFx);
  const lines = [
    'FlowTranslate · config du labo',
    `Menu : ${menu?.name} · raccourci ${SHORTCUT[cfg.shortcut]} · déclenchement ${cfg.trigger === 'shortcut' ? 'raccourci' : 'point à chaque sélection'} · position ${cfg.anchor === 'below' ? 'sous' : 'au-dessus'} · dernière action ${cfg.rememberLast ? 'oui' : 'non'}`,
    `Langue ${cfg.lang} · icônes ${cfg.iconSet}${cfg.showIcons ? '' : ' (masquées)'} · touches ${cfg.showKeys ? 'affichées' : 'masquées'}`,
    `Chargement : ${cfg.placement} · indicateur ${loader?.name} ${JSON.stringify(cfg.loaderParams[cfg.loader] || {})} · effet texte ${tfx?.name} ${JSON.stringify(cfg.textFxParams[cfg.textFx] || {})} · délai ${cfg.loaderDelay} ms · si long : ${cfg.slowLabel}`,
    `Résultat : ${cfg.replaceFx} ${JSON.stringify(cfg.replaceParams)} · mots changés ${cfg.diff} (${cfg.diffHold}/${cfg.diffFade} ms) · coche ${cfg.check ? 'oui' : 'non'} · annuler ${cfg.undo ? cfg.undoSeconds + ' s' : 'non'} · erreurs ${cfg.errorStyle}`,
    `Mouvement : ${MOTION_PRESETS[cfg.motionPreset]?.label || 'personnalisé'} · apparition ${spec(cfg.motion.enter)} · transformation ${spec(cfg.motion.morph)} · disparition ${spec(cfg.motion.exit)} · contenu ${spec(cfg.motion.content)} · échelle ${cfg.motion.fromScale} · glissement ${cfg.motion.travel}px`,
    `Matière : ${MATERIAL_PRESETS[cfg.materialPreset]?.label || 'personnalisée'} ${JSON.stringify(cfg.material)}`,
    `Simulation : ${cfg.latency} ms · issue ${OUTCOME_BY_ID[cfg.outcome]?.label}`,
    '',
    JSON.stringify(cfg),
  ];
  return lines.join('\n');
}

createRoot(document.getElementById('root')).render(<App />);
