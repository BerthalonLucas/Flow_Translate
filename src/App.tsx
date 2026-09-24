import * as ScrollArea from '@radix-ui/react-scroll-area';
import { ActionSettings } from './ActionSettings';
import { AnimationsSetting } from './AnimationsSetting';
import { promptError } from './actionDefaults';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, Segmented, SettingSwitch } from './ui';
import { bridge } from './bridge';
import { GlassOverlay } from './GlassOverlay';
import { HaloWindow } from './halo/HaloWindow';
import { NativeMenuProbe } from './menu/NativeMenuProbe'; // PROVISIONAL (lots 3–4), replaced by the Îlot of lot 7
import { useTranslation } from './useTranslation';
import { shareSettings, useSettings } from './useSettings';
import { useDocumentPreferences } from './preferences';
import { locales, t as tNow, useLanguage, useT, type MessageKey } from './i18n';
import { MotionPreferences } from './motion/MotionPreferences';
import type { AutoClose, Capture, HistoryEntry, Language, Mode, Settings, TextSize, Theme } from './types';

const defaultCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 820, y: 410, width: 350, height: 24 } };
const longCapture: Capture = { ...defaultCapture, id: 'demo-long', text: 'Hi Alex,\n\nThank you for your feedback. The updated proposal includes the delivery timeline, responsibilities, and payment terms. Could you confirm these details before Thursday?\n\nWe have kept the total budget unchanged and clarified the review process. Please check the dates and amounts before we share the final version with the team.\n\nBest regards,\nMarie' };
const clipboardCapture: Capture = { id: 'demo-clipboard', text: 'Je vous envoie la proposition mise à jour.', source: 'clipboard', canReplace: false, anchor: null };
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

type SaveStatus = 'saved' | 'just-saved' | 'saving' | 'error';
type Connection = { state: 'ok' | 'unknown' | 'error' | 'checking'; latencyMs?: number; message?: string };
const modeKey = (mode: Mode): MessageKey => mode === 'quality' ? 'mode.quality' : 'mode.fast';
export function SettingsWindow() {
  const t = useT();
  const language = useLanguage();
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
  // The window's own copy feeds its document preferences (language, theme) at once.
  const show = (next: Settings) => { latest.current = next; setSettings(next); shareSettings(next); };
  const loadSettings = () => { setLoadError(false); void bridge.getSettings().then(show).catch(() => setLoadError(true)); };
  useEffect(() => { loadSettings(); void bridge.getHistory().then(setHistory).catch(() => undefined); }, []);
  useEffect(() => { void bridge.setSettingsTitle(t('settings.windowTitle')).catch(() => undefined); }, [t]);
  useEffect(() => () => { window.clearTimeout(saveTimer.current); window.clearTimeout(settledTimer.current); }, []);
  const commit = async (next: Settings): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      for (const action of next.actions) {
        if (promptError(action.promptTemplate)) throw tNow('actions.promptInvalid');
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
      lastError.current = typeof error === 'string' ? error : tNow('settings.notSaved');
      if (latest.current === next) { setSaveError(lastError.current); setSaveStatus('error'); }
      return false;
    }
  };
  // Every change is saved: immediately for switches and segments, 300 ms after typing.
  const persist = (next: Settings, immediate: boolean) => {
    show(next);
    window.clearTimeout(saveTimer.current);
    if (immediate) void commit(next);
    else saveTimer.current = window.setTimeout(() => { if (latest.current) void commit(latest.current); }, 300);
  };
  const retry = () => { if (latest.current) void commit(latest.current); };

  if (!settings) return <main className="settings-window settings-loading"><h1>{t('settings.title')}</h1><p role={loadError ? 'alert' : 'status'}>{t(loadError ? 'settings.loadError' : 'settings.loading')}</p>{loadError && <button className="primary-action" onClick={loadSettings}>{t('common.retry')}</button>} <button className="quiet-action" onClick={() => void bridge.closeSettings()}>{t('common.close')}</button></main>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K], immediate = true) => persist({ ...settings, [key]: value }, immediate);
  const profile = (mode: Mode, key: 'endpoint' | 'model' | 'apiKey', value: string) => {
    setConnections(previous => ({ ...previous, [mode]: { state: 'unknown' } }));
    persist({ ...settings, profiles: { ...settings.profiles, [mode]: { ...settings.profiles[mode], [key]: value } } }, false);
  };
  const recordShortcut = async (id: string, shortcut: string): Promise<string | null> => {
    window.clearTimeout(saveTimer.current);
    const previous = latest.current!;
    const next = { ...previous, shortcutBindings: previous.shortcutBindings.map(b => b.id === id ? { ...b, shortcut, enabled: true } : b) };
    show(next);
    if (await commit(next)) return null;
    if (latest.current === next) { show(previous); setSaveStatus('saved'); }
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
      setConnections(previous => ({ ...previous, [mode]: { state: 'error', message: tNow('settings.checkImpossible') } }));
    }
  };
  const removeHistory = async (id: string | null) => { try { await bridge.deleteHistory(id); setHistory(await bridge.getHistory()); } catch { setSaveError(tNow('settings.deleteFailed')); setSaveStatus('error'); } };
  // Absolute dates in the interface's locale: the lab references must not drift day to day.
  const historyDate = (value: string) => {
    const date = new Date(value);
    return `${date.toLocaleDateString(locales[language], { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString(locales[language], { hour: '2-digit', minute: '2-digit' })}`;
  };
  const statusLine = (mode: Mode) => {
    const connection = connections[mode];
    if (connection.state === 'checking') return t('settings.checking');
    if (connection.state === 'ok') return t('settings.connected', { ms: connection.latencyMs ?? 0 });
    if (connection.state === 'error') return t('settings.connectionFailed');
    return t('settings.notChecked');
  };
  return <main className="settings-window" onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); void closeSettings(); } }}>
    <header className="settings-titlebar" onPointerDown={event => { if (bridge.native && event.button === 0 && !(event.target as HTMLElement).closest('button')) void bridge.dragSettings().catch(() => undefined); }}>
      <span className="settings-mark" aria-hidden="true"><svg viewBox="0 0 512 512" width="18" height="18"><rect width="512" height="512" rx="160" fill="#f2f5fa" stroke="rgb(29 29 31 / .16)" strokeWidth="24" /><path d="M140 182h208M140 254h144M140 326h84" fill="none" stroke="#1d1f24" strokeWidth="36" strokeLinecap="round" /><path d="m298 298 42 42 62-78" fill="none" stroke="#3b6fc4" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      <span className="settings-brand">FlowTranslate</span><h1>{t('settings.title')}</h1>
      <button className="close-settings" onClick={() => void closeSettings()} aria-label={t('settings.close')}><Icon name="close" /></button>
    </header>
    <ScrollArea.Root className="settings-scroll" type="always"><ScrollArea.Viewport className="settings-scroll-viewport"><div className="settings-body">
      <section className="appearance-settings">
        <h2>{t('settings.appearance')}</h2>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.language')}</strong><small>{t('settings.languageHelp')}</small></div>
          <Segmented<Language> label={t('settings.language')} value={settings.language} options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} onChange={value => update('language', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.theme')}</strong><small>{t('settings.themeHelp')}</small></div>
          <Segmented<Theme> label={t('settings.theme')} value={settings.theme} options={[{ value: 'system', label: t('settings.themeSystem') }, { value: 'light', label: t('settings.themeLight') }, { value: 'dark', label: t('settings.themeDark') }]} onChange={value => update('theme', value)} /></div>
        <AnimationsSetting value={settings.motion} onChange={value => update('motion', value)} />
      </section>
      <section>
        <h2>{t('settings.translation')}</h2>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.defaultProfile')}</strong><small>{t('settings.defaultProfileHelp')}</small></div>
          <Segmented<Mode> label={t('settings.defaultProfile')} value={settings.mode} options={[{ value: 'quality', label: t('mode.quality') }, { value: 'fast', label: t('mode.fast') }]} onChange={value => update('mode', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.textSize')}</strong><small>{t('settings.textSizeHelp')}</small></div>
          <Segmented<TextSize> label={t('settings.textSize')} value={settings.textSize} options={[{ value: 'normal', label: t('settings.textNormal') }, { value: 'large', label: t('settings.textLarge') }, { value: 'xlarge', label: t('settings.textXLarge') }]} onChange={value => update('textSize', value)} /></div>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.autoClose')}</strong><small>{t('settings.autoCloseHelp')}</small></div>
          <Segmented<AutoClose> label={t('settings.autoClose')} value={settings.autoClose} options={[{ value: 'fast', label: t('settings.closeFast') }, { value: 'normal', label: t('settings.closeNormal') }, { value: 'slow', label: t('settings.closeSlow') }, { value: 'never', label: t('settings.closeNever') }]} onChange={value => update('autoClose', value)} /></div>
      </section>
      <ActionSettings settings={settings} persist={persist} record={recordShortcut} />
      <section>
        <h2>{t('settings.device')}</h2>
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.history')}</strong><small>{t('settings.historyHelp')}</small></div>
          <SettingSwitch label={t('settings.history')} checked={settings.historyEnabled} onCheckedChange={checked => update('historyEnabled', checked)} /></div>
        {settings.historyEnabled && <div className="history">
          {history.length ? history.map(item => <article key={item.id}><div><p>{item.translatedText}</p><small>{item.actionName} · {t(modeKey(item.mode))} · {historyDate(item.createdAt)}</small></div><button className="icon-button history-remove" onClick={() => void removeHistory(item.id)} aria-label={t('settings.historyRemove')}><Icon name="close" size={14} /></button></article>) : <p className="empty-history">{t('settings.historyEmpty')}</p>}
          <div className="history-foot"><small>{t(new Intl.PluralRules(locales[language]).select(history.length) === 'one' ? 'settings.historyCountOne' : 'settings.historyCountOther', { count: history.length })}</small><button className="text-button" onClick={() => void removeHistory(null)} disabled={!history.length}>{t('settings.historyClear')}</button></div>
        </div>}
        <div className="setting-row"><div className="setting-copy"><strong>{t('settings.autostart')}</strong><small>{t('settings.autostartHelp')}</small></div>
          <SettingSwitch label={t('settings.autostart')} checked={settings.autostart} onCheckedChange={checked => update('autostart', checked)} /></div>
      </section>
      <section className="connection">
        <button className="section-toggle" onClick={() => update('connectionExpanded', !settings.connectionExpanded)} aria-expanded={settings.connectionExpanded}><h2>{t('settings.connection')}</h2><Icon name="chevron" size={14} /></button>
        {settings.connectionExpanded && (['quality', 'fast'] as Mode[]).map(mode => <div className="profile" key={mode}>
          <div className="profile-heading"><strong>{t(modeKey(mode))}</strong><span className="connection-state" data-state={connections[mode].state} role="status"><i aria-hidden="true" />{statusLine(mode)}</span><button className="text-button" onClick={() => void check(mode)} disabled={connections[mode].state === 'checking'}>{t('settings.check')}</button></div>
          <div className="field-grid"><label>{t('settings.endpoint')}<input type="url" placeholder={mode === 'quality' ? 'http://127.0.0.1:8002/v1' : 'http://127.0.0.1:8001/v1'} value={settings.profiles[mode].endpoint} onChange={e => profile(mode, 'endpoint', e.target.value)} /></label><label>{t('settings.model')}<input value={settings.profiles[mode].model} onChange={e => profile(mode, 'model', e.target.value)} /></label></div>
          <div className="secret"><label>{t('settings.apiKey')}<input type="password" autoComplete="new-password" placeholder={t('settings.apiKeyPlaceholder')} value={settings.profiles[mode].apiKey} onChange={e => profile(mode, 'apiKey', e.target.value)} /></label><small aria-hidden="true">{t('settings.apiKeyProtected')}</small></div>
          {connections[mode].state === 'error' && connections[mode].message && <p className="row-warning">{connections[mode].message}</p>}
        </div>)}
        {!bridge.native && settings.connectionExpanded && <small className="preview-note">{t('settings.previewConnection')}</small>}
      </section>
    </div></ScrollArea.Viewport><ScrollArea.Scrollbar className="settings-scrollbar" orientation="vertical"><ScrollArea.Thumb className="settings-scroll-thumb" /></ScrollArea.Scrollbar></ScrollArea.Root>
    <footer>
      <span className="save-status" data-status={saveStatus} aria-live="polite">
        {saveStatus === 'error' ? <button className="text-button retry" onClick={retry} title={saveError}>{t('settings.saveRetry')}</button> : <><Icon name="check" size={14} />{t(saveStatus === 'just-saved' ? 'settings.savedNow' : saveStatus === 'saving' ? 'settings.saving' : 'settings.saved')}</>}
      </span>
      <span className="settings-meta">{__APP_VERSION__} · <button className="text-button" onClick={() => void bridge.quit()}>{t('settings.quit')}</button></span>
    </footer>
    {saveStatus === 'error' && <p className="save-error-detail" role="alert">{saveError}</p>}
    {bridge.native && <button className="settings-resize-grip" aria-label={t('settings.resize')} title={t('settings.resizeHint')} onPointerDown={event => { if (event.button === 0) { event.preventDefault(); void bridge.resizeSettingsCorner().catch(() => { setSaveError(tNow('settings.resizeUnavailable')); setSaveStatus('error'); }); } }}>◢</button>}
  </main>;
}

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'long' | 'very-long' | 'error'>('selection');
  const capture = scenario === 'clipboard' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
  const t = useT();
  const begin = () => { const next = { ...capture, id: uid() }; bridge.setDemoCapture(next, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal'); controller.receiveCapture(next); };
  return <main className="demo-desktop">
    <aside className="demo-sidebar"><span className="demo-logo">FT</span><span>{t('demo.mail')}</span><span>{t('demo.messages')}</span><span>{t('demo.settings')}</span></aside>
    <section className="demo-mail"><div className="demo-toolbar"><span>{t('demo.newMessage')}</span><span className="demo-search">{t('demo.search')}</span><span>{t('demo.send')}</span></div><div className="demo-recipient"><span>{t('demo.to')}</span><b>alex.martin@exemple.com</b></div><div className="mail-copy"><p>Bonjour Alex,</p><p>Je vous envoie la proposition mise à jour.</p><p>Bonne journée,<br/>Marie</p></div></section>
    <aside className="demo-panel"><span className="demo-badge">{t('demo.badge')}</span><h1>FlowTranslate</h1><p>{t('demo.intro')}</p><fieldset><legend>{t('demo.scenario')}</legend>
      {([['selection', 'demo.selection'], ['clipboard', 'demo.clipboard'], ['long', 'demo.long'], ['very-long', 'demo.veryLong'], ['error', 'demo.error']] as const).map(([value, key]) => <label key={value}><input type="radio" checked={scenario === value} onChange={() => setScenario(value)} /> {t(key)}</label>)}
    </fieldset><button className="primary-action demo-start" onClick={begin}>{t('demo.start')}</button><button className="text-button settings-link" onClick={() => location.assign('?window=settings&demo=1')}>{t('demo.openSettings')}</button></aside>
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
  const t = useT();
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
  return <div className={standaloneDemo ? 'standalone-demo' : 'native-overlay'} data-preview-background={standaloneDemo ? background : undefined}>{initError && <div className="initialization-error"><p role="alert">{t(initError === 'close' ? 'init.close' : 'init.connection')} {t('init.restart')}</p><button className="quiet-action" onClick={() => location.reload()}>{t('common.retry')}</button> <button className="quiet-action" onClick={() => void bridge.openSettings()}>{t('common.settings')}</button> <button className="quiet-action" onClick={() => void bridge.dismiss()}>{t('common.close')}</button></div>}{standaloneDemo && <>
    <span className="preview-label">{t('preview.label')}</span>
    <div className="preview-backgrounds" role="group" aria-label={t('preview.backgrounds')}>
      {([['light', 'preview.light'], ['dark', 'preview.dark'], ['color', 'preview.color']] as const).map(([value, key]) => <button key={value} type="button" aria-pressed={background === value} onClick={() => setBackground(value)}>{t(key)}</button>)}
    </div>
  </>}<GlassOverlay controller={controller} /><NativeMenuProbe controller={controller} /></div>;
}

function DemoWindow() { return <DemoDesktop controller={useTranslation(false)} />; }

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const windowName = params.get('window') ?? (bridge.native ? 'overlay' : 'demo');
  const standaloneDemo = params.get('demo') === '1';
  const settings = useSettings();
  useDocumentPreferences(settings);
  useEffect(() => { document.body.className = `flowtranslate-window flowtranslate-${windowName}`; return () => { document.body.className = ''; }; }, [windowName]);
  const content = windowName === 'settings' ? <SettingsWindow />
    : windowName === 'halo' ? <HaloWindow />
    : windowName === 'overlay' && (bridge.native || standaloneDemo) ? <OverlayWindow standaloneDemo={standaloneDemo} />
    : <DemoWindow />;
  return <MotionPreferences motion={settings?.motion ?? 'system'} preset={settings?.motionPreset ?? 'smooth'}>{content}</MotionPreferences>;
}

