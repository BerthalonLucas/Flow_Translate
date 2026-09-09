import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { bridge } from './bridge';
import { initialTranslationState, translationReducer } from './reducer';
import type { Capture, HistoryEntry, Language, Mode, Settings, StreamEvent } from './types';

const defaultCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 820, y: 410, width: 350, height: 24 } };
const clipboardCapture: Capture = { id: 'demo-clipboard', text: 'Je vous envoie la proposition mise à jour.', source: 'clipboard', canReplace: false, anchor: null };
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

function dragSurface(event: PointerEvent<HTMLDivElement>) {
  if (!bridge.native || event.button !== 0 || !event.isPrimary) return;
  const target = event.target as HTMLElement;
  if (target.closest('button, input, select, a, [role="menu"]')) return;
  // Leave native scrollbar gestures alone, including on overflowing source text.
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight && event.clientX >= node.getBoundingClientRect().right - 12) return;
    if (node === event.currentTarget) break;
  }
  event.preventDefault();
  void bridge.startDrag().catch(() => undefined);
}

function Icon({ name }: { name: 'copy' | 'more' | 'close' | 'clipboard' | 'check' | 'chevron' }) {
  const paths = {
    copy: <><rect x="8" y="7" width="10" height="12" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m7 10 5 5 5-5"/>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button className="icon-button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

function useTranslation(readyOnMount = false) {
  const [state, dispatch] = useReducer(translationReducer, initialTranslationState);
  const [settings, setSettings] = useState<Settings | null>(null);
  const requestRef = useRef<string | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const settingsReadyRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const handledCaptureRef = useRef<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    settingsReadyRef.current = bridge.getSettings().then(next => { settingsRef.current = next; setSettings(next); return true; }).catch(() => false);
  }, []);
  useEffect(() => { captureRef.current = state.capture; }, [state.capture]);

  const start = useCallback((capture: Capture, forced?: { mode?: Mode; targetLanguage?: Language }) => {
    const mode = forced?.mode ?? settingsRef.current?.mode ?? 'quality';
    const targetLanguage = forced?.targetLanguage ?? settingsRef.current?.targetLanguage ?? 'fr';
    const id = uid(); requestRef.current = id;
    dispatch({ type: 'START', requestId: id, mode, targetLanguage });
    void bridge.translate({ id, captureId: capture.id, text: capture.text, targetLanguage, mode }).catch(() => {
      dispatch({ type: 'STREAM', event: { requestId: id, kind: 'error', message: 'La traduction n’a pas pu démarrer.' } });
    });
  }, []);

  const receiveCapture = useCallback((capture: Capture) => {
    if (handledCaptureRef.current === capture.id) return;
    handledCaptureRef.current = capture.id;
    captureRef.current = capture;
    dispatch({ type: 'CAPTURE', capture });
    if (capture.source === 'selection') start(capture);
  }, [start]);

  useEffect(() => {
    let off: Array<() => void> = [];
    let disposed = false;
    void Promise.all([
      bridge.on<Capture>('capture', capture => receiveCapture(capture)),
      bridge.on<StreamEvent>('translation', event => dispatch({ type: 'STREAM', event })),
      bridge.on<Settings>('settings-changed', next => { settingsRef.current = next; setSettings(next); }),
      bridge.on<{ captureId: string; anchorLost: boolean; message: string }>('target-invalidated', invalidation => {
        if (invalidation.captureId === captureRef.current?.id) dispatch({ type: 'INVALIDATE', message: invalidation.message });
      })
    ]).then(async listeners => {
      if (disposed) listeners.forEach(unlisten => unlisten());
      else {
        off = listeners;
        if (readyOnMount) {
          try { if (!await settingsReadyRef.current) throw new Error('settings unavailable'); const pending = await bridge.frontendReady(); if (pending && !disposed) receiveCapture(pending); }
          catch { if (!disposed) setInitError('La connexion à FlowTranslate est indisponible.'); }
        }
      }
    });
    return () => { disposed = true; off.forEach(unlisten => unlisten()); };
  }, [readyOnMount, receiveCapture]);

  const cancelAndDismiss = useCallback(() => {
    if (requestRef.current) { void bridge.cancel(requestRef.current); dispatch({ type: 'CANCEL' }); }
    void bridge.dismiss();
  }, []);

  return { state, settings, dispatch, receiveCapture, start, cancelAndDismiss, initError };
}

function TranslationBubble({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const { state, dispatch, start, cancelAndDismiss } = controller;
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const visible = state.capture !== null;
  const ready = state.phase === 'complete';
  useEffect(() => { setMenuOpen(false); setFeedback(null); }, [state.capture?.id]);

  useLayoutEffect(() => {
    if (!bridge.native || !root.current || !visible) return;
    let frame = 0; let previous = '';
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      if (!root.current) return;
      const bounds = root.current.getBoundingClientRect();
      const width = Math.min(state.enlarged ? 420 : 280, Math.max(200, Math.ceil(bounds.width)));
      const height = Math.min(state.enlarged ? 440 : 220, Math.max(36, Math.ceil(bounds.height)));
      const next = `${width}x${height}`;
      if (next !== previous) { previous = next; void bridge.resize(width, height); }
      });
    });
    observer.observe(root.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [visible, state.enlarged]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelAndDismiss(); }
      if (event.key === 'Enter' && state.phase === 'confirming' && state.capture) start(state.capture);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [cancelAndDismiss, start, state.capture, state.phase]);

  if (!visible) return null;
  const translating = state.phase === 'streaming';
  const sourceIsClipboard = state.capture?.source === 'clipboard';
  const invokeResult = async (action: 'copy' | 'replace') => {
    if (!state.requestId) return;
    try { await (action === 'copy' ? bridge.copy(state.requestId) : bridge.replace(state.requestId)); setFeedback(action === 'copy' ? 'Copié.' : 'Remplacement effectué.'); }
    catch (error) {
      const nativeMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
      const sanitizedMessage = nativeMessage.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
      setFeedback(action === 'copy' ? 'La copie a été refusée.' : sanitizedMessage || 'Remplacement indisponible. Utilisez Copier.');
    }
  };
  return <div ref={root} onPointerDown={dragSurface} className={`translation-bubble ${state.enlarged ? 'is-enlarged' : ''} ${sourceIsClipboard ? 'is-clipboard-result' : ''}`} role="status" aria-live="polite">
    {state.phase === 'confirming' ? <div className="confirmation">
      <p>Traduire le texte du presse-papiers&nbsp;?</p>
      <div className="source-preview">{state.capture?.text}</div>
      <div className="confirmation-actions"><button className="quiet-action" onClick={cancelAndDismiss}>Annuler</button><button className="primary-action" onClick={() => state.capture && start(state.capture)}>Traduire</button></div>
    </div> : <>
      {state.comparing && <div className="original-copy"><span>Original</span>{state.capture?.text}</div>}
      <div className="translation-result">
        <div className={`translation-copy ${translating ? 'is-streaming' : ''}`}>
          <span className="translation-text">{state.error && !state.result ? <span className="error-copy">{state.error}</span> : state.result || 'Traduction en cours…'}</span>
        <span className="bubble-actions" aria-label="Actions de traduction">
          <IconButton label="Copier la traduction" disabled={!ready} onClick={() => void invokeResult('copy')}><Icon name="copy" /></IconButton>
          <span className="more-wrap">
            <IconButton label="Plus d’options" disabled={!ready} onClick={() => setMenuOpen(value => !value)}><Icon name="more" /></IconButton>
          </span>
        </span>
        </div>
      </div>
      {state.error && state.result ? <p className="subtle-warning">{state.error}</p> : null}
      {feedback ? <p className="compact-feedback">{feedback}</p> : null}
      {menuOpen && <div className="more-menu" role="menu">
            <button role="menuitem" onClick={() => { dispatch({ type: 'TOGGLE_ENLARGE' }); setMenuOpen(false); }}><span>{state.enlarged ? 'Réduire' : 'Agrandir'}</span></button>
            <button role="menuitem" onClick={() => { dispatch({ type: 'TOGGLE_COMPARE' }); setMenuOpen(false); }}><span>{state.comparing ? 'Masquer l’original' : 'Afficher l’original'}</span></button>
            {state.replacementValid && <button role="menuitem" onClick={() => { void invokeResult('replace'); setMenuOpen(false); }}><span>Remplacer</span></button>}
            <button role="menuitem" onClick={() => { if (state.capture) start(state.capture, { mode: state.mode === 'quality' ? 'fast' : 'quality' }); setMenuOpen(false); }}><span>Relancer en {state.mode === 'quality' ? 'Rapide' : 'Qualité'}</span></button>
            <button role="menuitem" onClick={() => { void bridge.openSettings(); setMenuOpen(false); }}><span>Réglages</span></button>
      </div>}
    </>}
  </div>;
}

function Capsule() {
  const [target, setTarget] = useState<Language>('fr');
  useEffect(() => {
    let off: (() => void) | undefined;
    void bridge.getSettings().then(settings => setTarget(settings.targetLanguage)).catch(() => undefined);
    void bridge.on<Settings>('settings-changed', settings => setTarget(settings.targetLanguage)).then(listener => off = listener);
    return () => off?.();
  }, []);
  return <div className="capsule" onPointerDown={dragSurface}>
    <button className="capsule-main" onClick={() => void bridge.focusOverlay()} aria-label="Afficher la traduction"><Icon name="clipboard" /><span>{target === 'fr' ? 'Français' : 'English'}</span><Icon name="chevron" /></button>
    <span className="capsule-rule" /><button className="capsule-settings" onClick={() => void bridge.openSettings()} aria-label="Ouvrir les réglages"><Icon name="more" /></button><button className="capsule-close" onClick={() => void bridge.dismiss()} aria-label="Fermer"><Icon name="close" /></button>
  </div>;
}

function SettingsWindow() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState<Mode | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => { void bridge.getSettings().then(setSettings).catch(() => setNotice('Les réglages sont indisponibles.')); void bridge.getHistory().then(setHistory).catch(() => undefined); }, []);
  if (!settings) return <main className="settings-window"><p>Chargement des réglages…</p></main>;
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings({ ...settings, [key]: value });
  const profile = (mode: Mode, key: 'endpoint' | 'model' | 'apiKey', value: string) => setSettings({ ...settings, profiles: { ...settings.profiles, [mode]: { ...settings.profiles[mode], [key]: value } } });
  const save = async () => { try { await bridge.saveSettings(settings); setNotice('Réglages enregistrés sur cet appareil.'); return true; } catch { setNotice('Les réglages n’ont pas été enregistrés.'); return false; } };
  const check = async (mode: Mode) => { setChecking(mode); try { if (!await save()) return; const result = await bridge.checkConnection(mode); setNotice(result.message); } catch { setNotice('La vérification a échoué.'); } finally { setChecking(null); } };
  const removeHistory = async (id: string | null) => { try { await bridge.deleteHistory(id); setHistory(await bridge.getHistory()); } catch { setNotice('La suppression a échoué.'); } };
  return <main className="settings-window">
    <header><div><span className="product-mark">FlowTranslate</span><h1>Réglages</h1></div><button className="close-settings" onClick={() => void bridge.closeSettings()} aria-label="Fermer"><Icon name="close" /></button></header>
    <section><h2>Traduction</h2><div className="setting-grid"><label>Langue cible<select value={settings.targetLanguage} onChange={e => update('targetLanguage', e.target.value as Language)}><option value="fr">Français</option><option value="en">English</option></select></label><label>Mode par défaut<select value={settings.mode} onChange={e => update('mode', e.target.value as Mode)}><option value="quality">Qualité</option><option value="fast">Rapide</option></select></label><label className="wide">Raccourci<input value={settings.shortcut} onChange={e => update('shortcut', e.target.value)} /></label></div></section>
    <section><h2>Sur cet appareil</h2><label className="switch-row"><input type="checkbox" checked={settings.historyEnabled} onChange={e => update('historyEnabled', e.target.checked)} /><span>Conserver l’historique chiffré</span><small>{history.length} entrée{history.length > 1 ? 's' : ''}</small></label><label className="switch-row"><input type="checkbox" checked={settings.autostart} onChange={e => update('autostart', e.target.checked)} /><span>Lancer à l’ouverture de session</span></label>{settings.historyEnabled && <div className="history"><div className="history-heading"><strong>Historique</strong><button className="text-button" onClick={() => void removeHistory(null)} disabled={!history.length}>Tout supprimer</button></div>{history.length ? history.map(item => <article key={item.id}><div><p>{item.translatedText}</p><small>{item.mode === 'quality' ? 'Qualité' : 'Rapide'} · {new Date(item.createdAt).toLocaleDateString('fr-FR')}</small></div><button className="icon-button dark-icon" onClick={() => void removeHistory(item.id)} aria-label="Supprimer cette entrée"><Icon name="close" /></button></article>) : <p className="empty-history">Aucune traduction enregistrée.</p>}</div>}</section>
    <section className="advanced"><button className="advanced-toggle" onClick={() => setAdvanced(value => !value)} aria-expanded={advanced}>Connexion avancée <Icon name="chevron" /></button>{advanced && <div className="advanced-content">{(['quality', 'fast'] as Mode[]).map(mode => <div className="profile" key={mode}><div className="profile-heading"><strong>{mode === 'quality' ? 'Qualité' : 'Rapide'}</strong><button className="text-button" onClick={() => void check(mode)} disabled={checking === mode}>{checking === mode ? 'Vérification…' : 'Enregistrer et vérifier'}</button></div><label>Adresse<input type="url" placeholder="https://serveur.exemple/v1" value={settings.profiles[mode].endpoint} onChange={e => profile(mode, 'endpoint', e.target.value)} /></label><label>Modèle<input value={settings.profiles[mode].model} onChange={e => profile(mode, 'model', e.target.value)} /></label><label>Clé API<input type="password" autoComplete="new-password" placeholder="Conservée uniquement par Windows" value={settings.profiles[mode].apiKey} onChange={e => profile(mode, 'apiKey', e.target.value)} /></label></div>)}</div>}</section>
    <footer><span aria-live="polite">{notice}</span><button className="primary-action" onClick={() => void save()}>Enregistrer</button></footer>
  </main>;
}

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'error'>('selection');
  const capture = scenario === 'clipboard' ? clipboardCapture : defaultCapture;
  const begin = () => { bridge.setDemoCapture(capture, scenario === 'error' ? 'error' : 'normal'); controller.receiveCapture(capture); };
  return <main className="demo-desktop">
    <aside className="demo-sidebar"><span className="demo-logo">FT</span><span>Courrier</span><span>Messages</span><span>Réglages</span></aside>
    <section className="demo-mail"><div className="demo-toolbar"><span>✉ Nouveau message</span><span className="demo-search">Rechercher</span><span>Envoyer</span></div><div className="demo-recipient"><span>À</span><b>alex.martin@exemple.com</b></div><div className="mail-copy"><p>Bonjour Alex,</p><p>Je vous envoie la proposition mise à jour.</p><p>Bonne journée,<br/>Marie</p></div></section>
    <aside className="demo-panel"><span className="demo-badge">DÉMO UNIQUEMENT</span><h1>FlowTranslate</h1><p>Le navigateur ne contacte aucun serveur ni presse-papiers.</p><fieldset><legend>Scénario</legend><label><input type="radio" checked={scenario === 'selection'} onChange={() => setScenario('selection')} /> Sélection</label><label><input type="radio" checked={scenario === 'clipboard'} onChange={() => setScenario('clipboard')} /> Presse-papiers</label><label><input type="radio" checked={scenario === 'error'} onChange={() => setScenario('error')} /> Erreur réseau</label></fieldset><button className="primary-action demo-start" onClick={begin}>Simuler Ctrl + Alt + T</button><button className="text-button settings-link" onClick={() => location.assign('?window=settings&demo=1')}>Voir les réglages</button></aside>
    <div className="demo-selection">Could you send the updated proposal before Thursday?</div>
    <TranslationBubble controller={controller} />
  </main>;
}

function OverlayWindow({ standaloneDemo }: { standaloneDemo: boolean }) {
  const controller = useTranslation(true);
  const { receiveCapture, initError } = controller;
  const demoStarted = useRef(false);
  useEffect(() => {
    if (!demoStarted.current && standaloneDemo) {
      demoStarted.current = true;
      bridge.setDemoCapture(defaultCapture);
      receiveCapture(defaultCapture);
    }
  }, [standaloneDemo, receiveCapture]);
  return <div className={standaloneDemo ? 'standalone-demo' : 'native-overlay'}>{initError && <p className="initialization-error">{initError}</p>}<TranslationBubble controller={controller} /></div>;
}

function DemoWindow() { return <DemoDesktop controller={useTranslation(false)} />; }

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const windowName = params.get('window') ?? (bridge.native ? 'overlay' : 'demo');
  const standaloneDemo = params.get('demo') === '1';
  useEffect(() => { document.body.className = `flowtranslate-window flowtranslate-${windowName}`; return () => { document.body.className = ''; }; }, [windowName]);
  if (windowName === 'settings') return <SettingsWindow />;
  if (windowName === 'capsule') return <Capsule />;
  if (windowName === 'overlay' && (bridge.native || standaloneDemo)) return <OverlayWindow standaloneDemo={standaloneDemo} />;
  return <DemoWindow />;
}
