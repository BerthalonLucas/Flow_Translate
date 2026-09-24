import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, SettingSwitch } from './ui';
import { defaultActions, newActionTemplate, promptError } from './actionDefaults';
import { t as tNow, useT, type MessageKey } from './i18n';
import type { Settings, ShortcutBinding } from './types';

type Props = {
  settings: Settings;
  persist: (settings: Settings, immediate: boolean) => void;
  record: (id: string, shortcut: string) => Promise<string | null>;
};
function fromKey(event: KeyboardEvent): { value?: string; error?: MessageKey } {
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'NumLock'].includes(event.key)) return {};
  if (event.metaKey) return { error: 'shortcuts.windowsKey' };
  if (event.getModifierState('AltGraph')) return { error: 'shortcuts.altGr' };
  if (!event.ctrlKey && !event.altKey) return { error: 'shortcuts.needModifier' };
  if (event.key === 'F12') return { error: 'shortcuts.f12' };
  if ((event.ctrlKey && event.altKey && event.key === 'Delete') || (event.altKey && ['Tab', 'F4', 'Escape'].includes(event.key))) return { error: 'shortcuts.system' };
  const { code, key } = event;
  // Windows registers virtual letter keys: respect the active layout (AZERTY too).
  const main = /^[a-z]$/i.test(key) ? key.toUpperCase() : /^Digit\d$/.test(code) ? code.slice(5)
    : /^F([1-9]|1[01]|2[0-4]|1[3-9])$/.test(key) ? key : code === 'Space' ? 'Space'
    : ['Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(key) ? key
    : key.startsWith('Arrow') ? key.slice(5) : null;
  if (!main) return { error: 'shortcuts.badKey' };
  return { value: [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', main].filter(Boolean).join('+') };
}
// A notice is one of ours (a message key, shown in the current language) or Rust's refusal as sent.
type Notice = { key: MessageKey } | { text: string } | null;
export function ActionSettings({ settings, persist, record }: Props) {
  const t = useT();
  const [capturing, setCapturing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const noticeText = notice === null ? '' : 'key' in notice ? t(notice.key) : notice.text;
  const noticeOk = notice !== null && 'key' in notice && notice.key === 'shortcuts.saved';
  const recorder = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (capturing) recorder.current?.focus(); }, [capturing]);
  const binding = (id: string, patch: Partial<ShortcutBinding>) => persist({ ...settings, shortcutBindings: settings.shortcutBindings.map(b => b.id === id ? { ...b, ...patch } : b) }, true);
  const captureKey = async (id: string, event: KeyboardEvent<HTMLSpanElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { setCapturing(null); return; }
    if (event.repeat || busy) return;
    const candidate = fromKey(event);
    if (candidate.error) { setNotice({ key: candidate.error }); return; }
    if (!candidate.value) return;
    setBusy(true); setCapturing(null); setNotice(null);
    const error = await record(id, candidate.value);
    setNotice(error === null ? { key: 'shortcuts.saved' } : { text: error }); setBusy(false);
  };
  return <>
    <section className="actions-settings">
      <div className="section-heading"><div><h2>{t('actions.title')}</h2><p>{t('actions.intro')}</p></div>
        <button className="text-button" disabled={settings.actions.length >= 24} onClick={() => persist({ ...settings, actions: [...settings.actions, { id: crypto.randomUUID(), name: tNow('actions.newName'), promptTemplate: newActionTemplate }] }, true)}>{t('actions.add')}</button></div>
      <label className="default-action">{t('actions.default')}<select value={settings.defaultActionId} onChange={e => persist({ ...settings, defaultActionId: e.target.value }, true)}>{settings.actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <div className="action-list">{settings.actions.map(action => {
        const original = defaultActions.find(a => a.id === action.id);
        const error = promptError(action.promptTemplate) ? t('actions.promptInvalid') : null;
        const used = settings.defaultActionId === action.id || settings.shortcutBindings.some(b => b.actionId === action.id);
        return <details className="action-card" key={action.id}>
          <summary><span>{action.name || t('actions.untitled')}</span><small>{t(original ? 'actions.builtIn' : 'actions.custom')}</small><Icon name="chevron" size={14} /></summary>
          <div className="action-editor">
            <label>{t('actions.name')}<input value={action.name} maxLength={60} onChange={e => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...a, name: e.target.value } : a) }, false)} /></label>
            <label>{t('actions.instruction')}<textarea aria-label={t('actions.instructionFor', { name: action.name })} rows={6} value={action.promptTemplate} spellCheck={false} aria-invalid={Boolean(error)} onChange={e => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...a, promptTemplate: e.target.value } : a) }, false)} /></label>
            <small>{t('actions.instructionHelp')}</small>
            {error && <p className="row-warning" role="alert">{error}</p>}
            {original ? <button className="text-button" onClick={() => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...original } : a) }, true)}>{t('actions.restore')}</button> : <button className="text-button" disabled={used} title={used ? t('actions.inUseHint') : undefined} onClick={() => persist({ ...settings, actions: settings.actions.filter(a => a.id !== action.id) }, true)}>{t('actions.delete')}{used ? t('actions.inUse') : ''}</button>}
          </div>
        </details>;
      })}</div>
      <p className="settings-help">{t('actions.help')}</p>
    </section>
    <section className="shortcuts-settings">
      <div className="section-heading"><div><h2>{t('shortcuts.title')}</h2><p>{t('shortcuts.intro')}</p></div>
        <button className="text-button" disabled={settings.shortcutBindings.length >= 12 || busy} onClick={() => persist({ ...settings, shortcutBindings: [...settings.shortcutBindings, { id: crypto.randomUUID(), shortcut: '', actionId: settings.defaultActionId, outputMode: 'display', enabled: false }] }, true)}>{t('shortcuts.add')}</button></div>
      <fieldset className="shortcut-list" disabled={busy}>{settings.shortcutBindings.map(b => <article className="shortcut-card" key={b.id}>
        <div className="shortcut-card-heading"><SettingSwitch label={t('shortcuts.enable')} checked={b.enabled} onCheckedChange={enabled => binding(b.id, { enabled })} /><span>{t(b.enabled ? 'shortcuts.on' : 'shortcuts.off')}</span>
          {settings.shortcutBindings.length > 1 && <button className="icon-button" aria-label={t('shortcuts.delete')} onClick={() => persist({ ...settings, shortcutBindings: settings.shortcutBindings.filter(v => v.id !== b.id) }, true)}><Icon name="close" size={14} /></button>}</div>
        <div className="shortcut-control">
          <span ref={capturing === b.id ? recorder : undefined} className="keycaps" data-capturing={capturing === b.id || undefined} role="textbox" aria-label={t('shortcuts.field')} aria-readonly="true" tabIndex={capturing === b.id ? 0 : -1} onKeyDown={e => void captureKey(b.id, e)} onBlur={() => setCapturing(null)}>
            {capturing === b.id ? <em>{t('shortcuts.press')}</em> : b.shortcut ? b.shortcut.split('+').map((key, n) => <kbd key={n}>{key}</kbd>) : <em>{t('shortcuts.unset')}</em>}
          </span><button className="text-button" onClick={() => { setNotice(null); setCapturing(current => current === b.id ? null : b.id); }}>{t(capturing === b.id ? 'shortcuts.cancel' : 'shortcuts.change')}</button>
        </div>
        <div className="shortcut-options"><label>{t('shortcuts.action')}<select value={b.actionId} onChange={e => binding(b.id, { actionId: e.target.value })}>{settings.actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>{t('shortcuts.result')}<select value={b.outputMode} onChange={e => binding(b.id, { outputMode: e.target.value as 'display' | 'replace' })}><option value="display">{t('shortcuts.display')}</option><option value="replace">{t('shortcuts.replace')}</option></select></label></div>
      </article>)}</fieldset>
      {noticeText && <p className="row-warning" role={noticeOk ? 'status' : 'alert'}>{noticeText}</p>}
      <p className="settings-help">{t('shortcuts.help')}</p>
    </section>
  </>;
}
