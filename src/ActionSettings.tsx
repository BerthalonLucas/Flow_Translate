import { Icon, SettingSwitch } from './ui';
import { isCurrentDefault, newActionTemplate, promptError, shippedInstruction } from './actionDefaults';
import { t as tNow, useT } from './i18n';
import { MenuGrid } from './settings/MenuGrid';
import { deleteAction } from './settings/grid';
import { ShortcutRecorder } from './settings/ShortcutRecorder';
import type { Registrations } from './settings/registrations';
import type { ActionDefinition, Settings, ShortcutBinding } from './types';

type Props = {
  settings: Settings;
  persist: (settings: Settings, immediate: boolean) => void;
  record: (id: string | null, shortcut: string) => Promise<string | null>;
  busy: boolean;
  // What Windows answered for each binding (src/settings/registrations.ts).
  registrations?: Registrations;
};
// « Actions »: the Îlot's grid (order, letters, which ones), each action's instruction, and
// the direct shortcuts that run one action without the menu. Action names are user data.
export function ActionSettings({ settings, persist, record, busy, registrations }: Props) {
  const t = useT();
  const ilot = settings.uiVersion === 'ilot';
  const edit = (id: string, patch: (action: ActionDefinition) => ActionDefinition, immediate: boolean) => persist({ ...settings, actions: settings.actions.map(a => a.id === id ? patch(a) : a) }, immediate);
  const binding = (id: string, patch: Partial<ShortcutBinding>) => persist({ ...settings, shortcutBindings: settings.shortcutBindings.map(b => b.id === id ? { ...b, ...patch } : b) }, true);
  // The menu's own binding lives in « Menu »; any other one is a direct shortcut here.
  const menuBinding = settings.shortcutBindings.find(b => b.kind === 'menu');
  const direct = settings.shortcutBindings.filter(b => b !== menuBinding);
  return <section className="actions-settings">
    <h2>{t('actions.title')}</h2>
    {ilot && <MenuGrid settings={settings} persist={persist} />}
    <div className="subsection-heading"><div><h3>{t('actions.instructions')}</h3><p>{t('actions.intro')}</p></div>
      <button className="text-button" disabled={settings.actions.length >= 24} onClick={() => persist({ ...settings, actions: [...settings.actions, { id: crypto.randomUUID(), name: tNow('actions.newName'), promptTemplate: newActionTemplate }] }, true)}>{t('actions.add')}</button></div>
    <div className="action-list">{settings.actions.map(action => {
      // Built-in: shipped by FlowTranslate, now or in 0.4 (translate-fr…). Restore puts back
      // the shipped instruction only; the name, the letter and the tile label stay the user's.
      const shipped = shippedInstruction(action.id);
      const error = promptError(action.promptTemplate) ? t('actions.promptInvalid') : null;
      const used = settings.defaultActionId === action.id || settings.shortcutBindings.some(b => b.actionId === action.id);
      return <details className="action-card" key={action.id}>
        <summary><span>{action.name || t('actions.untitled')}</span><small>{t(shipped ? 'actions.builtIn' : 'actions.custom')}</small><Icon name="chevron" size={14} /></summary>
        <div className="action-editor">
          <label>{t('actions.name')}<input value={action.name} maxLength={60} onChange={e => edit(action.id, a => ({ ...a, name: e.target.value }), false)} /></label>
          {/* The tile's label in the Îlot (1 to 16 characters); empty, the tile shows the name. */}
          {ilot && <label>{t('actions.shortName')}<input value={action.shortName ?? ''} maxLength={16} placeholder={action.name} onChange={e => edit(action.id, ({ shortName: _old, ...a }) => e.target.value.trim() ? { ...a, shortName: e.target.value } : a, false)} /></label>}
          <label>{t('actions.instruction')}<textarea aria-label={t('actions.instructionFor', { name: action.name })} rows={6} value={action.promptTemplate} spellCheck={false} aria-invalid={Boolean(error)} onChange={e => edit(action.id, a => ({ ...a, promptTemplate: e.target.value }), false)} /></label>
          <small>{t('actions.instructionHelp')}</small>
          {error && <p className="row-warning" role="alert">{error}</p>}
          <div className="action-buttons">
            {shipped !== undefined && <button className="text-button" disabled={action.promptTemplate === shipped} onClick={() => edit(action.id, a => ({ ...a, promptTemplate: shipped }), true)}>{t('actions.restore')}</button>}
            {!isCurrentDefault(action.id) && <button className="text-button" disabled={used} title={used ? t('actions.inUseHint') : undefined} onClick={() => persist(deleteAction(settings, action.id), true)}>{t('actions.delete')}{used ? t('actions.inUse') : ''}</button>}
          </div>
        </div>
      </details>;
    })}</div>
    <p className="settings-help">{t('actions.help')}</p>
    <div className="subsection-heading"><div><h3>{t('shortcuts.title')}</h3><p>{t('shortcuts.intro')}</p></div>
      <button className="text-button" disabled={settings.shortcutBindings.length >= 12 || busy} onClick={() => persist({ ...settings, shortcutBindings: [...settings.shortcutBindings, { id: crypto.randomUUID(), kind: 'action', shortcut: '', actionId: settings.defaultActionId, outputMode: 'display', enabled: false }] }, true)}>{t('shortcuts.add')}</button></div>
    {direct.length ? <div className="shortcut-list">{direct.map(b => <article className="shortcut-card" key={b.id}>
      <div className="shortcut-card-heading"><SettingSwitch label={t('shortcuts.enable')} checked={b.enabled} onCheckedChange={enabled => binding(b.id, { enabled })} /><span>{t(b.enabled ? 'shortcuts.on' : 'shortcuts.off')}</span>
        {settings.shortcutBindings.length > 1 && <button className="icon-button" aria-label={t('shortcuts.delete')} disabled={busy} onClick={() => persist({ ...settings, shortcutBindings: settings.shortcutBindings.filter(v => v.id !== b.id) }, true)}><Icon name="close" size={14} /></button>}</div>
      <ShortcutRecorder shortcut={b.shortcut} enabled={b.enabled} label={t('shortcuts.field')} busy={busy} record={shortcut => record(b.id, shortcut)} registration={registrations?.(b)} />
      {/* A second menu binding (rare) opens the menu too: no action, no destination to pick. */}
      {b.kind === 'menu' ? <p className="settings-help">{t('shortcuts.opensMenu')}</p> : <div className="shortcut-options"><label>{t('shortcuts.action')}<select value={b.actionId} disabled={busy} onChange={e => binding(b.id, { actionId: e.target.value })}>{settings.actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>{t('shortcuts.result')}<select value={b.outputMode} disabled={busy} onChange={e => binding(b.id, { outputMode: e.target.value as 'display' | 'replace' })}><option value="display">{t('shortcuts.display')}</option><option value="replace">{t('shortcuts.replace')}</option></select></label></div>}
    </article>)}</div> : <p className="settings-help">{t('shortcuts.none')}</p>}
    <p className="settings-help">{t('shortcuts.help')}</p>
  </section>;
}
