import * as ScrollArea from '@radix-ui/react-scroll-area';
import { ActionSettings } from './ActionSettings';
import { promptError } from './actionDefaults';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, Segmented, SettingSwitch, useFade } from './ui';
import { bridge } from './bridge';
import { GlassOverlay, dragSurface } from './GlassOverlay';
import { useTranslation } from './useTranslation';
import type { AutoClose, Capture, HistoryEntry, Language, Mode, Settings, TextSize } from './types';

const defaultCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 820, y: 410, width: 350, height: 24 } };
const longCapture: Capture = { ...defaultCapture, id: 'demo-long', text: 'Hi Alex,\n\nThank you for your feedback. The updated proposal includes the delivery timeline, responsibilities, and payment terms. Could you confirm these details before Thursday?\n\nWe have kept the total budget unchanged and clarified the review process. Please check the dates and amounts before we share the final version with the team.\n\nBest regards,\nMarie' };
const clipboardCapture: Capture = { id: 'demo-clipboard', text: 'Je vous envoie la proposition mise à jour.', source: 'clipboard', canReplace: false, anchor: null };
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

export function Capsule() {
  const fade = useFade();
  const [target, setTarget] = useState<Language>('fr');
  useEffect(() => {
    let off: (() => void) | undefined;
    void bridge.getSettings().then(settings => setTarget(settings.targetLanguage)).catch(() => undefined);
    void bridge.on<Settings>('settings-changed', settings => setTarget(settings.targetLanguage)).then(listener => off = listener);
    return () => off?.();
  }, []);
  return <motion.div {...fade} className="capsule" onPointerDown={event => dragSurface(event)}>
    <button className="capsule-main" onClick={() => void bridge.focusOverlay()} aria-label="Afficher la traduction"><Icon name="clipboard" /><span>{target === 'fr' ? 'Français' : 'English'}</span></button>
    <span className="capsule-rule" aria-hidden="true" /><button className="icon-button capsule-settings" onClick={() => void bridge.openSettings()} aria-label="Ouvrir les réglages"><Icon name="more" /></button><button className="icon-button capsule-close" onClick={() => void bridge.dismiss()} aria-label="Fermer"><Icon name="close" /></button>
  </motion.div>;
}

type SaveStatus = 'saved' | 'just-saved' | 'saving' | 'error';
type Connection = { state: 'ok' | 'unknown' | 'error' | 'checking'; latencyMs?: number; message?: string };
const modeLabel = (mode: Mode) => mode === 'quality' ? 'Qualité' : 'Rapide';
export function SettingsWindow() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState('');
  const [connections, setConnections] = useState<Record<Mode, Connection>>({ fast: { state: 'unknown' }, quality: { state: 'unknown' } });
  const latest = useRef<Settings | null>(null);
  const saveTimer = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastError = useRef('');
  const settledTimer = useRef(0);
  const loadSettings = () => { setLoadError(false); void bridge.getSettings().then(next => { latest.current = next; setSettings(next); }).catch(() => setLoadError(true)); };
  useEffect(() => { loadSettings(); void bridge.getHistory().then(setHistory).catch(() => undefined); }, []);
  useEffect(() => () => { window.clearTimeout(saveTimer.current); window.clearTimeout(settledTimer.current); }, []);
  const commit = async (next: Settings): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      for (const action of next.actions) {
        const error = promptError(action.promptTemplate);
        if (error) throw error;
      }
      const pending = saveQueue.current.then(() => bridge.saveSettings(next));
      saveQueue.current = pending.catch(() => undefined);
      await pending;
      if (latest.current !== next) return true;
      setSaveStatus('just-saved');
      window.clearTimeout(settledTimer.current);
      settledTimer.current = window.setTimeout(() => setSaveStatus(status => status === 'just-saved' ? 'saved' : status), 3000);
      return true;
    } catch (error) {
      lastError.current = typeof error === 'string' ? error : 'Les réglages n’ont pas été enregistrés.';
      if (latest.current === next) { setSaveError(typeof error === 'string' ? error : 'Les réglages n’ont pas été enregistrés.'); setSaveStatus('error'); }
      return false;
    }
  };
  // Every change is saved: immediately for switches and segments, 300 ms after typing.
  const persist = (next: Settings, immediate: boolean) => {
    latest.current = next;
    setSettings(next);
    window.clearTimeout(saveTimer.current);
    if (immediate) void commit(next);
    else saveTimer.current = window.setTimeout(() => { if (latest.current) void commit(latest.current); }, 300);
  };
  const retry = () => { if (latest.current) void commit(latest.current); };

  if (!settings) return <main className="settings-window settings-loading"><h1>Réglages</h1><p role={loadError ? 'alert' : 'status'}>{loadError ? 'Les réglages sont indisponibles. Réessayez ou redémarrez FlowTranslate.' : 'Chargement des réglages…'}</p>{loadError && <button className="primary-action" onClick={loadSettings}>Réessayer</button>} <button className="quiet-action" onClick={() => void bridge.closeSettings()}>Fermer</button></main>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K], immediate = true) => persist({ ...settings, [key]: value }, immediate);
  const profile = (mode: Mode, key: 'endpoint' | 'model' | 'apiKey', value: string) => {
    setConnections(previous => ({ ...previous, [mode]: { state: 'unknown' } }));
    persist({ ...settings, profiles: { ...settings.profiles, [mode]: { ...settings.profiles[mode], [key]: value } } }, false);
  };
  const recordShortcut = async (id: string, shortcut: string): Promise<string | null> => {
    window.clearTimeout(saveTimer.current);
    const previous = latest.current!;
    const next = { ...previous, shortcutBindings: previous.shortcutBindings.map(b => b.id === id ? { ...b, shortcut, enabled: true } : b) };
    latest.current = next; setSettings(next);
    if (await commit(next)) return null;
    if (latest.current === next) { latest.current = previous; setSettings(previous); setSaveStatus('saved'); }
    return lastError.current;
  };
  const closeSettings = async () => {
    window.clearTimeout(saveTimer.current);
    if (latest.current && !await commit(latest.current)) return;
    await bridge.closeSettings();
  };
  const check = async (mode: Mode) => {
    setConnections(previous => ({ ...previous, [mode]: { state: 'checking' } }));
    const started = performance.now();
    try {
      const result = await bridge.checkConnection(mode);
      setConnections(previous => ({ ...previous, [mode]: { state: result.connected ? 'ok' : 'error', latencyMs: Math.max(1, Math.round(performance.now() - started)), message: result.message } }));
    } catch {
      setConnections(previous => ({ ...previous, [mode]: { state: 'error', message: 'Vérification impossible. Démarrez le serveur puis réessayez.' } }));
    }
  };
  const removeHistory = async (id: string | null) => { try { await bridge.deleteHistory(id); setHistory(await bridge.getHistory()); } catch { setSaveError('La suppression a échoué.'); setSaveStatus('error'); } };
  // Absolute, locale-stable dates: the lab references must not drift day to day.
  const historyDate = (value: string) => {
    const date = new Date(value);
    return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };
  const statusLine = (mode: Mode) => {
    const connection = connections[mode];
    if (connection.state === 'checking') return 'Vérification…';
    if (connection.state === 'ok') return `Connecté · ${connection.latencyMs} ms`;
    if (connection.state === 'error') return 'Échec de connexion';
    return 'Non vérifié';
  };
  return <main className="settings-window" onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); void closeSettings(); } }}>
    <header className="settings-titlebar" onPointerDown={event => { if (bridge.native && event.button === 0 && !(event.target as HTMLElement).closest('button')) void bridge.dragSettings().catch(() => undefined); }}>
      <span className="settings-mark" aria-hidden="true"><svg viewBox="0 0 512 512" width="18" height="18"><rect width="512" height="512" rx="160" fill="#f2f5fa" /><path d="M140 182h208M140 254h144M140 326h84" fill="none" stroke="#1d1f24" strokeWidth="36" strokeLinecap="round" /><path d="m298 298 42 42 62-78" fill="none" stroke="#3b6fc4" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      <span className="settings-brand">FlowTranslate</span><h1>Réglages</h1>
      <button className="close-settings" onClick={() => void closeSettings()} aria-label="Fermer"><Icon name="close" /></button>
    </header>
    <ScrollArea.Root className="settings-scroll" type="always"><ScrollArea.Viewport className="settings-scroll-viewport"><div className="settings-body">
      <section>
        <h2>Traduction</h2>
        <div className="setting-row"><div className="setting-copy"><strong>Langue cible</strong><small>La source est détectée automatiquement.</small></div>
          <Segmented<Language> label="Langue cible" value={settings.targetLanguage} options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} onChange={value => update('targetLanguage', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>Profil par défaut</strong><small>Qualité : plus lent, meilleures tournures. Changeable depuis le menu de la bulle.</small></div>
          <Segmented<Mode> label="Profil par défaut" value={settings.mode} options={[{ value: 'quality', label: 'Qualité' }, { value: 'fast', label: 'Rapide' }]} onChange={value => update('mode', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>Taille du texte</strong><small>Verre court 16, 18 ou 20 px ; lecteur 22, 24 ou 26 px. Le lecteur occupe la moitié de l’écran.</small></div>
          <Segmented<TextSize> label="Taille du texte" value={settings.textSize} options={[{ value: 'normal', label: 'Normale' }, { value: 'large', label: 'Grande' }, { value: 'xlarge', label: 'Très grande' }]} onChange={value => update('textSize', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>Fermeture automatique</strong><small>Le temps de lecture estimé, puis un fondu. Survoler, faire défiler ou épingler la retient.</small></div>
          <Segmented<AutoClose> label="Fermeture automatique" value={settings.autoClose} options={[{ value: 'fast', label: 'Rapide' }, { value: 'normal', label: 'Normale' }, { value: 'slow', label: 'Lente' }, { value: 'never', label: 'Jamais' }]} onChange={value => update('autoClose', value)} /></div>
      </section>
      <ActionSettings settings={settings} persist={persist} record={recordShortcut} />
      <section>
        <h2>Sur cet appareil</h2>
        <div className="setting-row"><div className="setting-copy"><strong>Conserver l’historique chiffré</strong><small>7 jours, 100 entrées, protégé par Windows (DPAPI). Rien ne quitte l’appareil.</small></div>
          <SettingSwitch label="Conserver l’historique chiffré" checked={settings.historyEnabled} onCheckedChange={checked => update('historyEnabled', checked)} /></div>
        {settings.historyEnabled && <div className="history">
          {history.length ? history.map(item => <article key={item.id}><div><p>{item.translatedText}</p><small>{modeLabel(item.mode)} · {historyDate(item.createdAt)}</small></div><button className="icon-button history-remove" onClick={() => void removeHistory(item.id)} aria-label="Supprimer cette entrée"><Icon name="close" size={13} /></button></article>) : <p className="empty-history">Aucune traduction enregistrée.</p>}
          <div className="history-foot"><small>{history.length} entrée{history.length > 1 ? 's' : ''}</small><button className="text-button" onClick={() => void removeHistory(null)} disabled={!history.length}>Tout supprimer</button></div>
        </div>}
        <div className="setting-row"><div className="setting-copy"><strong>Lancer à l’ouverture de session</strong><small>Seule l’icône de notification est visible au repos.</small></div>
          <SettingSwitch label="Lancer à l’ouverture de session" checked={settings.autostart} onCheckedChange={checked => update('autostart', checked)} /></div>
      </section>
      <section className="connection">
        <button className="section-toggle" onClick={() => update('connectionExpanded', !settings.connectionExpanded)} aria-expanded={settings.connectionExpanded}><h2>Connexion</h2><Icon name="chevron" size={14} /></button>
        {settings.connectionExpanded && (['quality', 'fast'] as Mode[]).map(mode => <div className="profile" key={mode}>
          <div className="profile-heading"><strong>{modeLabel(mode)}</strong><span className="connection-state" data-state={connections[mode].state} role="status"><i aria-hidden="true" />{statusLine(mode)}</span><button className="text-button" onClick={() => void check(mode)} disabled={connections[mode].state === 'checking'}>Vérifier</button></div>
          <div className="field-grid"><label>Adresse<input type="url" placeholder={mode === 'quality' ? 'http://127.0.0.1:8002/v1' : 'http://127.0.0.1:8001/v1'} value={settings.profiles[mode].endpoint} onChange={e => profile(mode, 'endpoint', e.target.value)} /></label><label>Modèle<input value={settings.profiles[mode].model} onChange={e => profile(mode, 'model', e.target.value)} /></label></div>
          <div className="secret"><label>Clé API<input type="password" autoComplete="new-password" placeholder="Facultative pour un serveur local" value={settings.profiles[mode].apiKey} onChange={e => profile(mode, 'apiKey', e.target.value)} /></label><small aria-hidden="true">Protégée par Windows</small></div>
          {connections[mode].state === 'error' && connections[mode].message && <p className="row-warning">{connections[mode].message}</p>}
        </div>)}
        {!bridge.native && settings.connectionExpanded && <small className="preview-note">Aperçu navigateur · connexion simulée</small>}
      </section>
    </div></ScrollArea.Viewport><ScrollArea.Scrollbar className="settings-scrollbar" orientation="vertical"><ScrollArea.Thumb className="settings-scroll-thumb" /></ScrollArea.Scrollbar></ScrollArea.Root>
    <footer>
      <span className="save-status" data-status={saveStatus} aria-live="polite">
        {saveStatus === 'error' ? <button className="text-button retry" onClick={retry} title={saveError}>Non enregistré — réessayer</button> : <><Icon name="check" size={13} />{saveStatus === 'just-saved' ? 'Enregistré à l’instant' : saveStatus === 'saving' ? 'Enregistrement…' : 'Enregistré'}</>}
      </span>
      <span className="settings-meta">{__APP_VERSION__} · <button className="text-button" onClick={() => void bridge.quit()}>Quitter FlowTranslate</button></span>
    </footer>
    {saveStatus === 'error' && <p className="save-error-detail" role="alert">{saveError}</p>}
    {bridge.native && <button className="settings-resize-grip" aria-label="Redimensionner les réglages" title="Glisser pour redimensionner" onPointerDown={event => { if (event.button === 0) { event.preventDefault(); void bridge.resizeSettingsCorner().catch(() => { setSaveError('Redimensionnement indisponible. Utilisez les bords de la fenêtre.'); setSaveStatus('error'); }); } }}>◢</button>}
  </main>;
}

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'long' | 'very-long' | 'error'>('selection');
  const capture = scenario === 'clipboard' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
  const begin = () => { const next = { ...capture, id: uid() }; bridge.setDemoCapture(next, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal'); controller.receiveCapture(next); };
  return <main className="demo-desktop">
    <aside className="demo-sidebar"><span className="demo-logo">FT</span><span>Courrier</span><span>Messages</span><span>Réglages</span></aside>
    <section className="demo-mail"><div className="demo-toolbar"><span>✉ Nouveau message</span><span className="demo-search">Rechercher</span><span>Envoyer</span></div><div className="demo-recipient"><span>À</span><b>alex.martin@exemple.com</b></div><div className="mail-copy"><p>Bonjour Alex,</p><p>Je vous envoie la proposition mise à jour.</p><p>Bonne journée,<br/>Marie</p></div></section>
    <aside className="demo-panel"><span className="demo-badge">Aperçu navigateur</span><h1>FlowTranslate</h1><p>Réponses simulées. Cet aperçu vérifie les composants ; le rendu Windows, le focus et le déplacement se testent dans l’application.</p><fieldset><legend>Scénario</legend><label><input type="radio" checked={scenario === 'selection'} onChange={() => setScenario('selection')} /> Sélection</label><label><input type="radio" checked={scenario === 'clipboard'} onChange={() => setScenario('clipboard')} /> Presse-papiers</label><label><input type="radio" checked={scenario === 'long'} onChange={() => setScenario('long')} /> Texte long</label><label><input type="radio" checked={scenario === 'very-long'} onChange={() => setScenario('very-long')} /> Texte très long</label><label><input type="radio" checked={scenario === 'error'} onChange={() => setScenario('error')} /> Erreur réseau</label></fieldset><button className="primary-action demo-start" onClick={begin}>Simuler Ctrl + Alt + T</button><button className="text-button settings-link" onClick={() => location.assign('?window=settings&demo=1')}>Voir les réglages</button></aside>
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
  return <div className={standaloneDemo ? 'standalone-demo' : 'native-overlay'} data-preview-background={standaloneDemo ? background : undefined}>{initError && <div className="initialization-error"><p role="alert">{initError} Relancez l’application si le problème persiste.</p><button className="quiet-action" onClick={() => location.reload()}>Réessayer</button> <button className="quiet-action" onClick={() => void bridge.openSettings()}>Réglages</button> <button className="quiet-action" onClick={() => void bridge.dismiss()}>Fermer</button></div>}{standaloneDemo && <>
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
  useEffect(() => { document.body.className = `flowtranslate-window flowtranslate-${windowName}`; return () => { document.body.className = ''; }; }, [windowName]);
  if (windowName === 'settings') return <SettingsWindow />;
  if (windowName === 'capsule') return <Capsule />;
  if (windowName === 'overlay' && (bridge.native || standaloneDemo)) return <OverlayWindow standaloneDemo={standaloneDemo} />;
  return <DemoWindow />;
}

