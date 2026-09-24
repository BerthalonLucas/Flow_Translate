import { useT } from '../i18n';
import type { Settings } from '../types';
import { ShortcutRecorder } from './ShortcutRecorder';
import type { Registrations } from './registrations';

type Props = {
  settings: Settings;
  persist: (settings: Settings, immediate: boolean) => void;
  // Saves a chord on a binding (null: the menu has none yet, one is created).
  record: (id: string | null, shortcut: string) => Promise<string | null>;
  busy: boolean;
  // What Windows answered for each binding (src/settings/registrations.ts).
  registrations?: Registrations;
};
// « Menu »: the shortcut that opens the Îlot, and the action it starts on. Rust remembers the
// last action per application (menu-memory.json, never any text); the default action is the
// fallback there, and under uiVersion « v4 » what the shortcut runs directly.
export function MenuSettings({ settings, persist, record, busy, registrations }: Props) {
  const t = useT();
  const ilot = settings.uiVersion === 'ilot';
  const binding = settings.shortcutBindings.find(item => item.kind === 'menu');
  const help = binding && !binding.enabled ? t('settings.menuShortcutOff') : t(ilot ? 'settings.menuShortcutHelp' : 'settings.menuShortcutHelpV4');
  return <section className="menu-settings">
    <h2>{t('settings.menu')}</h2>
    <div className="setting-row shortcut-row" data-field="menuShortcut">
      <div className="setting-copy"><strong>{t('settings.menuShortcut')}</strong><small>{help}</small></div>
      <ShortcutRecorder shortcut={binding?.shortcut ?? ''} enabled={binding?.enabled ?? false} label={t('settings.menuShortcutField')} busy={busy} record={shortcut => record(binding?.id ?? null, shortcut)}
        registration={binding && registrations?.(binding)} />
    </div>
    <div className="setting-row">
      <div className="setting-copy"><strong>{t('settings.defaultAction')}</strong><small>{t(ilot ? 'settings.defaultActionHelp' : 'settings.defaultActionHelpV4')}</small></div>
      <select className="setting-select" aria-label={t('settings.defaultAction')} value={settings.defaultActionId} onChange={event => persist({ ...settings, defaultActionId: event.target.value }, true)}>
        {settings.actions.map(action => <option key={action.id} value={action.id}>{action.name}</option>)}
      </select>
    </div>
  </section>;
}
