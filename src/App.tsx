import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BubbleMenu, BubbleMenuTrigger, Icon, IconButton, SettingSwitch, useFade } from './ui';
import { bridge } from './bridge';
import { initialTranslationState, translationReducer } from './reducer';
import type { Capture, HistoryEntry, Language, Mode, Settings, StreamEvent } from './types';

const defaultCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 820, y: 410, width: 350, height: 24 } };
const clipboardCapture: Capture = { id: 'demo-clipboard', text: 'Je vous envoie la proposition mise à jour.', source: 'clipboard', canReplace: false, anchor: null };
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

function dragSurface(event: PointerEvent<HTMLDivElement>, onError?: () => void) {
  if (!bridge.native || event.button !== 0 || !event.isPrimary) return;
  const target = event.target as HTMLElement;
  if (target.closest('button, input, select, a, [role="menu"]')) return;
  // Leave native scrollbar gestures alone, including on overflowing source text.
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight && event.clientX >= node.getBoundingClientRect().right - 12) return;
    if (node === event.currentTarget) break;
  }
  event.preventDefault();
  void bridge.startDrag(event.clientX, event.clientY).catch(() => onError?.());
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
    requestRef.current = null;
    dispatch({ type: 'DISMISS' });
    void bridge.dismiss();
  }, []);

  return { state, settings, dispatch, receiveCapture, start, cancelAndDismiss, initError };
}

function TranslationBubble({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const { state, dispatch, start, cancelAndDismiss } = controller;
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const fade = useFade();
  const textRoot = useRef<HTMLSpanElement>(null);
  const [longResult, setLongResult] = useState(false);
  const visible = state.capture !== null;
  const activeRequest = useRef(state.requestId);
  useLayoutEffect(() => { activeRequest.current = state.requestId; }, [state.requestId]);
  const ready = state.phase === 'complete';
  useLayoutEffect(() => {
    const text = textRoot.current;
    setLongResult(Boolean(text && Math.max(text.scrollHeight, text.getBoundingClientRect().height) > (state.enlarged ? 385 : 192)));
  }, [state.result, state.phase, state.enlarged]);
  useEffect(() => { setMenuOpen(false); setFeedback(null); }, [state.capture?.id, state.requestId]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

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
  }, [visible, state.enlarged, state.capture?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); cancelAndDismiss(); }
      if (event.key === 'Enter' && state.phase === 'confirming' && state.capture) start(state.capture);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [cancelAndDismiss, start, state.capture, state.phase]);

  if (!visible) return null;
  const translating = state.phase === 'streaming';
  const sourceIsClipboard = state.capture?.source === 'clipboard';
  const invokeResult = async (action: 'copy' | 'replace') => {
    if (!ready || !state.requestId) return;
    const requestId = state.requestId;
    try {
      await (action === 'copy' ? bridge.copy(requestId) : bridge.replace(requestId));
      if (activeRequest.current === requestId) setFeedback(action === 'copy' ? 'Copié.' : 'Remplacement effectué.');
    }
    catch (error) {
      if (activeRequest.current !== requestId) return;
      const nativeMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
      const sanitizedMessage = nativeMessage.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
      setFeedback(action === 'copy' ? 'La copie a été refusée.' : sanitizedMessage || 'Remplacement indisponible. Utilisez Copier.');
    }
  };
  return <motion.div key={state.capture?.id} {...fade} ref={root} onPointerDown={event => dragSurface(event, () => setFeedback('Déplacement indisponible. Réessayez.'))} className={`translation-bubble ${state.enlarged ? 'is-enlarged' : ''} ${sourceIsClipboard ? 'is-clipboard-result' : ''}`} data-menu-open={menuOpen || undefined}>
    <BubbleMenu open={menuOpen} onOpenChange={setMenuOpen} actions={[
      { label: state.enlarged ? 'Réduire' : 'Agrandir', run: () => dispatch({ type: 'TOGGLE_ENLARGE' }) },
      { label: state.comparing ? 'Masquer l’original' : 'Afficher l’original', disabled: !ready, run: () => dispatch({ type: 'TOGGLE_COMPARE' }) },
      ...(state.replacementValid ? [{ label: 'Remplacer', run: () => void invokeResult('replace') }] : []),
      { label: `Relancer en ${state.mode === 'quality' ? 'Rapide' : 'Qualité'}`, disabled: translating || state.phase === 'confirming', run: () => { if (state.capture) start(state.capture, { mode: state.mode === 'quality' ? 'fast' : 'quality' }); } },
      { label: 'Réglages', run: () => void bridge.openSettings() },
      { label: 'Fermer', run: cancelAndDismiss, close: true },
    ]}>
      {state.phase === 'confirming' ? <motion.div key="confirmation" {...fade} className="confirmation">
        <p>Traduire le texte du presse-papiers&nbsp;?</p>
        <div className="source-preview">{state.capture?.text}</div>
        <div className="confirmation-actions"><button className="quiet-action" onClick={cancelAndDismiss}>Annuler</button><button className="primary-action" onClick={() => state.capture && start(state.capture)}>Traduire</button></div>
      </motion.div> : <>
        <AnimatePresence>{state.comparing && <motion.div key="original" {...fade} className="original-copy"><span>Original</span>{state.capture?.text}</motion.div>}</AnimatePresence>
        <motion.div key={state.phase === 'error' ? 'error' : 'result'} {...fade} className="translation-result">
          <div className={`translation-copy ${translating ? 'is-streaming' : ''} ${longResult ? 'is-long' : ''}`}>
            <span ref={textRoot} className="translation-text" role="status" aria-live="polite">{state.error && !state.result ? <span className="error-copy">{state.error}</span> : state.result || 'Traduction en cours…'}</span>
            <span className="bubble-actions" aria-label="Actions de traduction">
              <IconButton label="Copier la traduction" disabled={!ready} onClick={() => void invokeResult('copy')}>
                <motion.span key={feedback === 'Copié.' ? 'copied' : 'copy'} {...fade} className="action-glyph"><Icon name={feedback === 'Copié.' ? 'check' : 'copy'} /></motion.span>
              </IconButton>
              <BubbleMenuTrigger onClick={() => setMenuOpen(value => !value)} />
            </span>
          </div>
        </motion.div>
        {state.error && state.result ? <p className="subtle-warning">{state.error}</p> : null}
      </>}
    </BubbleMenu>
    <AnimatePresence>{feedback && <motion.p key={feedback} {...fade} className="compact-feedback" role="status">{feedback}</motion.p>}</AnimatePresence>
  </motion.div>;
}

function Capsule() {
  const fade = useFade();
  const [target, setTarget] = useState<Language>('fr');
  useEffect(() => {
    let off: (() => void) | undefined;
    void bridge.getSettings().then(settings => setTarget(settings.targetLanguage)).catch(() => undefined);
    void bridge.on<Settings>('settings-changed', settings => setTarget(settings.targetLanguage)).then(listener => off = listener);
    return () => off?.();
  }, []);
  return <motion.div {...fade} className="capsule" onPointerDown={event => dragSurface(event)}>
    <button className="capsule-main" onClick={() => void bridge.focusOverlay()} aria-label="Afficher la traduction"><Icon name="clipboard" /><span>{target === 'fr' ? 'Français' : 'English'}</span><Icon name="chevron" /></button>
    <span className="capsule-rule" /><button className="capsule-settings" onClick={() => void bridge.openSettings()} aria-label="Ouvrir les réglages"><Icon name="more" /></button><button className="capsule-close" onClick={() => void bridge.dismiss()} aria-label="Fermer"><Icon name="close" /></button>
  </motion.div>;
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
    <section><h2>Sur cet appareil</h2><SettingSwitch label="Conserver l’historique chiffré" checked={settings.historyEnabled} onCheckedChange={checked => update('historyEnabled', checked)} detail={`${history.length} entrée${history.length > 1 ? 's' : ''}`} /><SettingSwitch label="Lancer à l’ouverture de session" checked={settings.autostart} onCheckedChange={checked => update('autostart', checked)} />{settings.historyEnabled && <div className="history"><div className="history-heading"><strong>Historique</strong><button className="text-button" onClick={() => void removeHistory(null)} disabled={!history.length}>Tout supprimer</button></div>{history.length ? history.map(item => <article key={item.id}><div><p>{item.translatedText}</p><small>{item.mode === 'quality' ? 'Qualité' : 'Rapide'} · {new Date(item.createdAt).toLocaleDateString('fr-FR')}</small></div><button className="icon-button dark-icon" onClick={() => void removeHistory(item.id)} aria-label="Supprimer cette entrée"><Icon name="close" /></button></article>) : <p className="empty-history">Aucune traduction enregistrée.</p>}</div>}</section>
    <section className="advanced"><button className="advanced-toggle" onClick={() => setAdvanced(value => !value)} aria-expanded={advanced}>Connexion avancée <Icon name="chevron" /></button>{advanced && <div className="advanced-content">{(['quality', 'fast'] as Mode[]).map(mode => <div className="profile" key={mode}><div className="profile-heading"><strong>{mode === 'quality' ? 'Qualité' : 'Rapide'}</strong><button className="text-button" onClick={() => void check(mode)} disabled={checking === mode}>{checking === mode ? 'Vérification…' : 'Enregistrer et vérifier'}</button></div><label>Adresse<input type="url" placeholder="https://serveur.exemple/v1" value={settings.profiles[mode].endpoint} onChange={e => profile(mode, 'endpoint', e.target.value)} /></label><label>Modèle<input value={settings.profiles[mode].model} onChange={e => profile(mode, 'model', e.target.value)} /></label><label>Clé API<input type="password" autoComplete="new-password" placeholder="Conservée uniquement par Windows" value={settings.profiles[mode].apiKey} onChange={e => profile(mode, 'apiKey', e.target.value)} /></label></div>)}</div>}</section>
    <footer><span aria-live="polite">{notice}</span><button className="primary-action" onClick={() => void save()}>Enregistrer</button></footer>
  </main>;
}

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'long' | 'error'>('selection');
  const capture = scenario === 'clipboard' ? clipboardCapture : defaultCapture;
  const begin = () => { const next = { ...capture, id: uid() }; bridge.setDemoCapture(next, scenario === 'error' ? 'error' : scenario === 'long' ? 'long' : 'normal'); controller.receiveCapture(next); };
  return <main className="demo-desktop">
    <aside className="demo-sidebar"><span className="demo-logo">FT</span><span>Courrier</span><span>Messages</span><span>Réglages</span></aside>
    <section className="demo-mail"><div className="demo-toolbar"><span>✉ Nouveau message</span><span className="demo-search">Rechercher</span><span>Envoyer</span></div><div className="demo-recipient"><span>À</span><b>alex.martin@exemple.com</b></div><div className="mail-copy"><p>Bonjour Alex,</p><p>Je vous envoie la proposition mise à jour.</p><p>Bonne journée,<br/>Marie</p></div></section>
    <aside className="demo-panel"><span className="demo-badge">Aperçu navigateur</span><h1>FlowTranslate</h1><p>Réponses simulées. Cet aperçu vérifie les composants ; le rendu Windows, le focus et le déplacement se testent dans l’application.</p><fieldset><legend>Scénario</legend><label><input type="radio" checked={scenario === 'selection'} onChange={() => setScenario('selection')} /> Sélection</label><label><input type="radio" checked={scenario === 'clipboard'} onChange={() => setScenario('clipboard')} /> Presse-papiers</label><label><input type="radio" checked={scenario === 'long'} onChange={() => setScenario('long')} /> Texte long</label><label><input type="radio" checked={scenario === 'error'} onChange={() => setScenario('error')} /> Erreur réseau</label></fieldset><button className="primary-action demo-start" onClick={begin}>Simuler Ctrl + Alt + T</button><button className="text-button settings-link" onClick={() => location.assign('?window=settings&demo=1')}>Voir les réglages</button></aside>
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
      const scenario = new URLSearchParams(location.search).get('scenario');
      const capture = scenario === 'confirmation' ? clipboardCapture : defaultCapture;
      bridge.setDemoCapture(capture, scenario === 'error' ? 'error' : scenario === 'long' ? 'long' : 'normal');
      receiveCapture(capture);
    }
  }, [standaloneDemo, receiveCapture]);
  return <div className={standaloneDemo ? 'standalone-demo' : 'native-overlay'}>{initError && <div className="initialization-error"><p>{initError}</p><button className="quiet-action" onClick={() => void bridge.dismiss()}>Fermer</button></div>}{standaloneDemo && <span className="preview-label">Aperçu navigateur · réponse simulée</span>}<TranslationBubble controller={controller} /></div>;
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
