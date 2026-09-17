import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, useFade } from './settings/controls';
import { bridge } from './bridge';
import { GlassOverlay, dragSurface } from './GlassOverlay';
import { SettingsWindow } from './settings/SettingsWindow';
import { useTranslation } from './useTranslation';
import type { Capture, Settings } from './types';

// The lab and the tests import the settings window through this path: keep the re-export.
export { SettingsWindow };

const defaultCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 820, y: 410, width: 350, height: 24 } };
const longCapture: Capture = { ...defaultCapture, id: 'demo-long', text: 'Hi Alex,\n\nThank you for your feedback. The updated proposal includes the delivery timeline, responsibilities, and payment terms. Could you confirm these details before Thursday?\n\nWe have kept the total budget unchanged and clarified the review process. Please check the dates and amounts before we share the final version with the team.\n\nBest regards,\nMarie' };
const clipboardCapture: Capture = { id: 'demo-clipboard', text: 'Je vous envoie la proposition mise à jour.', source: 'clipboard', canReplace: false, anchor: null };
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

// Still wired, no longer shown since 2026-09-10: minimal graphite, ported out with 0.6.0.
export function Capsule() {
  const fade = useFade();
  const [label, setLabel] = useState('FlowTranslate');
  const actionLabel = (settings: Settings) => settings.actions.find(action => action.id === settings.defaultActionId)?.name ?? 'FlowTranslate';
  useEffect(() => {
    let off: (() => void) | undefined;
    void bridge.getSettings().then(settings => setLabel(actionLabel(settings))).catch(() => undefined);
    void bridge.on<Settings>('settings-changed', settings => setLabel(actionLabel(settings))).then(listener => off = listener);
    return () => off?.();
  }, []);
  return <motion.div {...fade} className="capsule" onPointerDown={event => dragSurface(event)}>
    <button className="capsule-main" onClick={() => void bridge.focusOverlay()} aria-label="Revoir le dernier résultat"><Icon name="clipboard-paste" size={15} /><span>{label}</span></button>
    <span className="capsule-rule" aria-hidden="true" />
    <button className="icon-button capsule-settings" onClick={() => void bridge.openSettings({ page: 'actions' })} aria-label="Ouvrir les réglages"><Icon name="ellipsis" size={15} /></button>
    <button className="icon-button capsule-close" onClick={() => void bridge.dismiss()} aria-label="Fermer"><Icon name="x" size={15} /></button>
  </motion.div>;
}

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'long' | 'very-long' | 'error'>('selection');
  const capture = scenario === 'clipboard' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
  const begin = () => { const next = { ...capture, id: uid() }; bridge.setDemoCapture(next, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal'); controller.receiveCapture(next); };
  return <main className="demo-desktop">
    <aside className="demo-sidebar"><span className="demo-logo">FT</span><span>Courrier</span><span>Messages</span><span>Réglages</span></aside>
    <section className="demo-mail"><div className="demo-toolbar"><span>✉ Nouveau message</span><span className="demo-search">Rechercher</span><span>Envoyer</span></div><div className="demo-recipient"><span>À</span><b>alex.martin@exemple.com</b></div><div className="mail-copy"><p>Bonjour Alex,</p><p>Je vous envoie la proposition mise à jour.</p><p>Bonne journée,<br/>Marie</p></div></section>
    <aside className="demo-panel"><span className="demo-badge">Aperçu navigateur</span><h1>FlowTranslate</h1><p>Réponses simulées. Cet aperçu vérifie les composants ; le rendu Windows, le focus et le déplacement se testent dans l’application.</p><fieldset><legend>Scénario</legend><label><input type="radio" checked={scenario === 'selection'} onChange={() => setScenario('selection')} /> Sélection</label><label><input type="radio" checked={scenario === 'clipboard'} onChange={() => setScenario('clipboard')} /> Presse-papiers</label><label><input type="radio" checked={scenario === 'long'} onChange={() => setScenario('long')} /> Texte long</label><label><input type="radio" checked={scenario === 'very-long'} onChange={() => setScenario('very-long')} /> Texte très long</label><label><input type="radio" checked={scenario === 'error'} onChange={() => setScenario('error')} /> Erreur réseau</label></fieldset><button className="primary-action demo-start" onClick={begin}>Simuler Ctrl + Alt + T</button><button className="text-button settings-link" onClick={() => void bridge.openSettings({ page: 'actions' })}>Voir les réglages</button></aside>
    <div className="demo-selection">Could you send the updated proposal before Thursday?</div>
    <GlassOverlay controller={controller} />
  </main>;
}

function OverlayWindow({ standaloneDemo }: { standaloneDemo: boolean }) {
  const controller = useTranslation(true);
  const [background, setBackground] = useState(() => {
    const requested = new URLSearchParams(location.search).get('background');
    return requested === 'light' || requested === 'dark' ? requested : 'color';
  });
  const { receiveCapture, initError } = controller;
  const demoStarted = useRef(false);
  useEffect(() => {
    if (!demoStarted.current && standaloneDemo) {
      demoStarted.current = true;
      const scenario = new URLSearchParams(location.search).get('scenario');
      const capture = scenario === 'confirmation' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
      bridge.setDemoCapture(capture, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal');
      receiveCapture(capture);
    }
  }, [standaloneDemo, receiveCapture]);
  return <div className={standaloneDemo ? 'standalone-demo' : 'native-overlay'} data-preview-background={standaloneDemo ? background : undefined}>{initError && <div className="initialization-error"><p role="alert">{initError} Relancez l’application si le problème persiste.</p><button className="quiet-action" onClick={() => location.reload()}>Réessayer</button> <button className="quiet-action" onClick={() => void bridge.openSettings({ page: 'actions' })}>Réglages</button> <button className="quiet-action" onClick={() => void bridge.dismiss()}>Fermer</button></div>}{standaloneDemo && <>
    <span className="preview-label">Aperçu navigateur · réponse simulée</span>
    <div className="preview-backgrounds" role="group" aria-label="Fond de l’aperçu">
      {([['light', 'Clair'], ['dark', 'Sombre'], ['color', 'Coloré']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={background === value} onClick={() => setBackground(value)}>{label}</button>)}
    </div>
  </>}<GlassOverlay controller={controller} /></div>;
}

function DemoWindow() { return <DemoDesktop controller={useTranslation(false)} />; }

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const windowName = params.get('window') ?? (bridge.native ? 'overlay' : 'demo');
  const standaloneDemo = params.get('demo') === '1';
  // Neutral body classes: the rename must then fit in one small commit.
  useEffect(() => { document.body.className = `app-window app-window-${windowName}`; return () => { document.body.className = ''; }; }, [windowName]);
  if (windowName === 'settings') return <SettingsWindow />;
  if (windowName === 'capsule') return <Capsule />;
  if (windowName === 'overlay' && (bridge.native || standaloneDemo)) return <OverlayWindow standaloneDemo={standaloneDemo} />;
  return <DemoWindow />;
}
