import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSettings } from '../ActionSettings';
import { promptError } from '../actionDefaults';
import { bridge } from '../bridge';
import { Button, Callout, Icon, type IconName } from './controls';
import { EnginesPage } from './EnginesPage';
import { PrivacyPage } from './PrivacyPage';
import { ReadingPage } from './ReadingPage';
import type { HistoryEntry, Mode, Settings, SettingsPage, SettingsTarget } from '../types';

export type SaveState = 'saved' | 'just-saved' | 'saving' | 'error';
export type Connection = { state: 'ok' | 'unknown' | 'error' | 'checking'; latencyMs?: number; message?: string };
export const modeLabel = (mode: Mode) => mode === 'quality' ? 'Qualité' : 'Rapide';

const pages: Array<{ id: SettingsPage; label: string; icon: IconName }> = [
  { id: 'actions', label: 'Actions', icon: 'keyboard' },
  { id: 'reading', label: 'Lecture', icon: 'type' },
  { id: 'engines', label: 'Moteurs', icon: 'server' },
  { id: 'privacy', label: 'Confidentialité', icon: 'shield-check' },
];
const isPage = (value: string | null): value is SettingsPage => pages.some(page => page.id === value);
// The browser preview reaches a page through the URL; the packaged app through `take_settings_target`.
function targetFromUrl(): SettingsTarget {
  const params = new URLSearchParams(location.search);
  const page = params.get('page');
  const engine = params.get('engine');
  return {
    page: isPage(page) ? page : 'actions',
    ...(params.get('actionId') ? { actionId: params.get('actionId')! } : {}),
    ...(engine === 'fast' || engine === 'quality' ? { engine } : {}),
  };
}

// The window is hidden, never closed: it stays mounted between two openings. Settings and history are
// read again on `settings-target` (each opening) and on window focus (Alt-Tab to a visible window).
export function SettingsWindow() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<SettingsPage>('actions');
  const [target, setTarget] = useState<SettingsTarget | null>(null);
  const [startupNotice, setStartupNotice] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState('');
  const [connections, setConnections] = useState<Record<Mode, Connection>>({ fast: { state: 'unknown' }, quality: { state: 'unknown' } });
  const latest = useRef<Settings | null>(null);
  const saveTimer = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastError = useRef('');
  const settledTimer = useRef(0);
  const lastReload = useRef(0);

  const loadSettings = useCallback(() => {
    setLoadError(false);
    return bridge.getSettings().then(next => { latest.current = next; setSettings(next); }).catch(() => setLoadError(true));
  }, []);
  // `data-settings-ready` is posed once both are in: it is what the lab and the tests wait on.
  const reload = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastReload.current < 250) return;
    lastReload.current = now;
    void Promise.all([loadSettings(), bridge.getHistory().then(setHistory).catch(() => undefined)]).then(() => setReady(true));
  }, [loadSettings]);

  const applyTarget = useCallback((next: SettingsTarget) => {
    setTarget(next);
    setPage(next.page);
    if (next.engine) setConnections(previous => ({ ...previous, [next.engine!]: { state: 'unknown' } }));
  }, []);

  useEffect(() => {
    let off: (() => void) | undefined;
    void (async () => {
      const native = await bridge.takeSettingsTarget().catch(() => null);
      applyTarget(native ?? targetFromUrl());
      const notice = await bridge.takeStartupNotice().catch(() => null);
      if (notice) setStartupNotice(notice);
      reload(true);
    })();
    void bridge.on<SettingsTarget>('settings-target', next => { applyTarget(next); reload(true); }).then(listener => off = listener);
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => { off?.(); window.removeEventListener('focus', onFocus); };
  }, [applyTarget, reload]);
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
      setSaveError('');
      window.clearTimeout(settledTimer.current);
      settledTimer.current = window.setTimeout(() => setSaveStatus(status => status === 'just-saved' ? 'saved' : status), 3000);
      return true;
    } catch (error) {
      lastError.current = typeof error === 'string' ? error : 'Les réglages n’ont pas été enregistrés.';
      if (latest.current === next) { setSaveError(lastError.current); setSaveStatus('error'); }
      return false;
    }
  };
  // Every change is saved on its own: switches and segments at once, typing 300 ms after the last key.
  const persist = (next: Settings, immediate: boolean) => {
    latest.current = next;
    setSettings(next);
    window.clearTimeout(saveTimer.current);
    if (immediate) void commit(next);
    else saveTimer.current = window.setTimeout(() => { if (latest.current) void commit(latest.current); }, 300);
  };
  // An address only reaches the disk once `validate_endpoint` has accepted it, and never mid-keystroke.
  const persistNow = async (next: Settings): Promise<boolean> => {
    window.clearTimeout(saveTimer.current);
    latest.current = next;
    setSettings(next);
    return commit(next);
  };
  const retry = () => { if (latest.current) void commit(latest.current); };
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
  // `check_connection` reads the *saved* settings: it waits for the queue rather than racing it.
  const check = async (mode: Mode) => {
    setConnections(previous => ({ ...previous, [mode]: { state: 'checking' } }));
    await saveQueue.current;
    const started = performance.now();
    try {
      const result = await bridge.checkConnection(mode);
      setConnections(previous => ({ ...previous, [mode]: { state: result.connected ? 'ok' : 'error', latencyMs: Math.max(1, Math.round(performance.now() - started)), message: result.message } }));
    } catch {
      setConnections(previous => ({ ...previous, [mode]: { state: 'error', message: 'Vérification impossible. Démarrez le serveur puis réessayez.' } }));
    }
  };
  const forgetConnection = (mode: Mode) => setConnections(previous => ({ ...previous, [mode]: { state: 'unknown' } }));
  const removeHistory = async (id: string | null) => {
    try { await bridge.deleteHistory(id); setHistory(await bridge.getHistory()); }
    catch { setSaveError('La suppression a échoué.'); setSaveStatus('error'); }
  };

  if (!settings) return <main className="settings-window settings-loading" data-settings-page="actions">
    <h1>Réglages</h1>
    <p role={loadError ? 'alert' : 'status'}>{loadError ? 'Les réglages sont indisponibles. Réessayez ou redémarrez FlowTranslate.' : 'Chargement des réglages…'}</p>
    {loadError && <button className="primary-action" onClick={() => reload(true)}>Réessayer</button>}
    <button className="quiet-action" onClick={() => void bridge.closeSettings()}>Fermer</button>
  </main>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K], immediate = true) => persist({ ...settings, [key]: value }, immediate);
  const notice = startupNotice && page === 'actions'
    ? <Callout tone="danger">{startupNotice}</Callout>
    : saveStatus === 'error' && saveError ? <Callout tone="danger">{saveError}</Callout> : null;

  return <main className="settings-window" data-settings-page={page} data-settings-ready={ready || undefined}
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); void closeSettings(); } }}>
    <header className="settings-titlebar" onPointerDown={event => { if (bridge.native && event.button === 0 && !(event.target as HTMLElement).closest('button')) void bridge.dragSettings().catch(() => undefined); }}>
      <Mark />
      <span className="settings-brand">FlowTranslate</span>
      <span className="settings-titlebar-page"> · Réglages</span>
      <SaveStatus status={saveStatus} reason={saveError} announced={Boolean(notice)} onRetry={retry} />
      <button className="close-settings" onClick={() => void closeSettings()} aria-label="Fermer les réglages" title="Fermer (Échap)"><Icon name="x" size={16} /></button>
    </header>
    <div className="settings-shell">
      <nav className="settings-nav" aria-label="Réglages">
        {pages.map(item => <button key={item.id} type="button" className="settings-nav-item" aria-current={page === item.id ? 'page' : undefined} onClick={() => { setPage(item.id); setTarget(null); }}>
          <Icon name={item.icon} size={16} />{item.label}
        </button>)}
        <div className="settings-nav-foot">
          <Button icon="power" onClick={() => void bridge.quit()}>Quitter</Button>
          <span className="settings-nav-version">FlowTranslate {__APP_VERSION__}</span>
        </div>
      </nav>
      <div className="settings-scroll-viewport">
        <div className="settings-page-inner">
          {notice}
          {page === 'actions' && <ActionSettings settings={settings} persist={persist} record={recordShortcut} target={target} />}
          {page === 'reading' && <ReadingPage settings={settings} update={update} />}
          {page === 'engines' && <EnginesPage settings={settings} update={update} persist={persist} persistNow={persistNow} connections={connections} check={check} forget={forgetConnection} target={target} />}
          {page === 'privacy' && <PrivacyPage settings={settings} update={update} history={history} onRemove={removeHistory} />}
        </div>
      </div>
    </div>
    {bridge.native && <button className="settings-resize-grip" aria-label="Redimensionner les réglages" title="Glisser pour redimensionner"
      onPointerDown={event => { if (event.button === 0) { event.preventDefault(); void bridge.resizeSettingsCorner().catch(() => { setSaveError('Redimensionnement indisponible. Utilisez les bords de la fenêtre.'); setSaveStatus('error'); }); } }}>◢</button>}
  </main>;
}

function SaveStatus({ status, reason, announced, onRetry }: { status: SaveState; reason: string; announced: boolean; onRetry: () => void }) {
  // The reason is shown once: as a Callout at the top of the page, or here in the tooltip.
  if (status === 'error') return <span className="save-status" data-status="error" role={announced ? undefined : 'alert'} aria-live={announced ? 'polite' : undefined} title={reason}>
    Non enregistré · <button type="button" className="settings-link" onClick={onRetry}>Réessayer</button>
  </span>;
  return <span className="save-status" data-status={status} aria-live="polite">
    {status === 'saving' ? <Icon name="loader-circle" size={13} className="spin" /> : <Icon name="check" size={13} />}
    {status === 'just-saved' ? 'Enregistré à l’instant' : status === 'saving' ? 'Enregistrement…' : 'Enregistré'}
  </span>;
}

// Three lines of text, the middle one run through a highlighter: what FlowTranslate does, in one sign.
function Mark() {
  return <span className="settings-mark" aria-hidden="true"><svg viewBox="0 0 512 512" width="16" height="16">
    <rect width="512" height="512" rx="128" fill="#16171b" />
    <rect x="88" y="228" width="296" height="60" rx="6" fill="#ffd24a" />
    <path d="M112 156h288M112 258h224M112 360h160" fill="none" stroke="#eceef1" strokeWidth="40" strokeLinecap="round" />
  </svg></span>;
}
