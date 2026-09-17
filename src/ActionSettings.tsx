import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { actionIcon, Badge, Button, Callout, Field, Icon, IconButton, Segmented, SettingSwitch } from './settings/controls';
import { defaultActions, newActionTemplate, promptError } from './actionDefaults';
import type { OutputMode, Settings, SettingsTarget, ShortcutBinding } from './types';

type Props = {
  settings: Settings;
  persist: (settings: Settings, immediate: boolean) => void;
  record: (id: string, shortcut: string) => Promise<string | null>;
  target: SettingsTarget | null;
};

const promptHint = 'Écrivez la langue voulue dans la consigne\u00A0; le texte sélectionné suit.';
const promptCount = (template: string) => `${[...template].length} / 8\u00A0000`;
const engineHelp = 'Les modèles Hy-MT ne savent que traduire. Pour corriger ou reformuler, choisissez un moteur généraliste dans Moteurs.';

function fromKey(event: KeyboardEvent): { value?: string; error?: string } {
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'NumLock'].includes(event.key)) return {};
  if (event.metaKey) return { error: 'La touche Windows est réservée au système.' };
  if (event.getModifierState('AltGraph')) return { error: 'AltGr ne peut pas servir de raccourci global.' };
  if (!event.ctrlKey && !event.altKey) return { error: 'Ajoutez Ctrl ou Alt à la combinaison.' };
  if (event.key === 'F12') return { error: 'F12 est réservée par Windows.' };
  if ((event.ctrlKey && event.altKey && event.key === 'Delete') || (event.altKey && ['Tab', 'F4', 'Escape'].includes(event.key))) return { error: 'Cette combinaison est réservée à Windows.' };
  const { code, key } = event;
  // Windows registers virtual letter keys: respect the active layout (AZERTY too).
  const main = /^[a-z]$/i.test(key) ? key.toUpperCase() : /^Digit\d$/.test(code) ? code.slice(5)
    : /^F([1-9]|1[01]|2[0-4]|1[3-9])$/.test(key) ? key : code === 'Space' ? 'Space'
    : ['Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(key) ? key
    : key.startsWith('Arrow') ? key.slice(5) : null;
  if (!main) return { error: 'Cette touche ne peut pas servir de raccourci global.' };
  return { value: [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', main].filter(Boolean).join('+') };
}

// Actions and shortcuts merged: a shortcut lives in the card of the action it launches, so the
// « Action » selector is gone. The data model (`shortcutBindings[].actionId`) does not change.
export function ActionSettings({ settings, persist, record, target }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ bindingId: string; message: string; tone: 'status' | 'alert' } | null>(null);
  const recorder = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (capturing) recorder.current?.focus(); }, [capturing]);
  // A refused shortcut at startup opens the settings on its action, with the reason under the line.
  useEffect(() => { if (target?.actionId) setOpen(target.actionId); }, [target]);

  const binding = (id: string, patch: Partial<ShortcutBinding>) => persist({ ...settings, shortcutBindings: settings.shortcutBindings.map(b => b.id === id ? { ...b, ...patch } : b) }, true);
  const captureKey = async (id: string, event: KeyboardEvent<HTMLSpanElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { setCapturing(null); return; }
    if (event.repeat || busy) return;
    const candidate = fromKey(event);
    if (candidate.error) { setNotice({ bindingId: id, message: candidate.error, tone: 'alert' }); return; }
    if (!candidate.value) return;
    setBusy(true); setCapturing(null); setNotice(null);
    const error = await record(id, candidate.value);
    setNotice({ bindingId: id, message: error ?? 'Raccourci enregistré.', tone: error ? 'alert' : 'status' });
    setBusy(false);
  };
  const addAction = () => {
    const id = crypto.randomUUID();
    persist({ ...settings, actions: [...settings.actions, { id, name: 'Nouvelle action', promptTemplate: newActionTemplate }] }, true);
    setOpen(id);
  };

  return <>
    <header className="page-head">
      <div><h1 className="page-title">Actions</h1><p className="page-desc">Un raccourci lance une action sur le texte sélectionné.</p></div>
      <Button variant="primary" icon="plus" disabled={settings.actions.length >= 24} onClick={addAction}>Nouvelle action</Button>
    </header>
    <div className="action-list">
      {settings.actions.map(action => {
        const original = defaultActions.find(a => a.id === action.id);
        const error = promptError(action.promptTemplate);
        const bindings = settings.shortcutBindings.filter(b => b.actionId === action.id);
        const active = bindings.filter(b => b.enabled && b.shortcut);
        const isDefault = settings.defaultActionId === action.id;
        const used = isDefault || bindings.length > 0;
        const expanded = open === action.id;
        return <section className="action-card" key={action.id} data-open={expanded || undefined} data-action-id={action.id}
          data-highlighted={target?.actionId === action.id || undefined}>
          <button type="button" className="action-head" aria-expanded={expanded} onClick={() => setOpen(current => current === action.id ? null : action.id)}>
            <span className="action-icon" aria-hidden="true"><Icon name={actionIcon(action.id)} size={16} /></span>
            <span className="action-copy">
              <span className="action-name"><span>{action.name || 'Action sans nom'}</span>{isDefault && <Badge tone="signal">Par défaut</Badge>}</span>
              <span className="action-meta">{original ? 'Prédéfinie' : 'Personnalisée'} · {active.length ? (active[0].outputMode === 'replace' ? 'Remplace la sélection' : 'Affiche le résultat') : 'Aucun raccourci actif'}</span>
            </span>
            <Keys shortcut={active[0]?.shortcut} extra={Math.max(0, active.length - 1)} />
            <Icon name="chevron-down" size={16} />
          </button>
          {expanded && <div className="action-body">
            <Field label="Nom">
              <input className="settings-input" value={action.name} maxLength={60}
                onChange={event => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...a, name: event.target.value } : a) }, false)} />
            </Field>
            <div className="binding-group">
              <span className="setting-group-title">Raccourcis</span>
              <div className="binding-list">
                {bindings.map(b => <article className="binding-row" key={b.id}>
                  <SettingSwitch label="Activer ce raccourci" checked={b.enabled} disabled={busy} onCheckedChange={enabled => binding(b.id, { enabled })} />
                  <span className="binding-keys">
                    <span ref={capturing === b.id ? recorder : undefined} className="keycaps" data-state={capturing === b.id ? 'recording' : b.shortcut ? 'idle' : 'empty'}
                      role="textbox" aria-label="Raccourci" aria-readonly="true" tabIndex={capturing === b.id ? 0 : -1}
                      onKeyDown={event => void captureKey(b.id, event)} onBlur={() => setCapturing(null)}>
                      {capturing === b.id ? 'Pressez la combinaison…' : b.shortcut ? b.shortcut.split('+').map((key, n) => <kbd key={n}>{key}</kbd>) : 'Sans raccourci'}
                    </span>
                    <Button size="sm" disabled={busy} onClick={() => { setNotice(null); setCapturing(current => current === b.id ? null : b.id); }}>{capturing === b.id ? 'Annuler' : 'Modifier'}</Button>
                  </span>
                  <Segmented<OutputMode> label="Résultat" size="sm" value={b.outputMode}
                    options={[{ value: 'display', label: 'Afficher' }, { value: 'replace', label: 'Remplacer' }]}
                    onChange={value => binding(b.id, { outputMode: value })} />
                  {/* The bin is only barred when this is the last shortcut of the whole configuration:
                      read per action it would make any single-shortcut action indestructible. */}
                  <IconButton label="Supprimer ce raccourci" variant="danger" disabled={settings.shortcutBindings.length <= 1}
                    onClick={() => persist({ ...settings, shortcutBindings: settings.shortcutBindings.filter(v => v.id !== b.id) }, true)}><Icon name="trash-2" size={16} /></IconButton>
                  {notice?.bindingId === b.id && <p className="row-warning" role={notice.tone}>{notice.message}</p>}
                  {target?.actionId === action.id && target.reason && b.id === bindings[0]?.id && <p className="row-warning" role="alert">{target.reason}</p>}
                </article>)}
              </div>
              <Button size="sm" icon="plus" disabled={settings.shortcutBindings.length >= 12 || busy}
                onClick={() => persist({ ...settings, shortcutBindings: [...settings.shortcutBindings, { id: crypto.randomUUID(), shortcut: '', actionId: action.id, outputMode: 'display', enabled: false }] }, true)}>Ajouter un raccourci</Button>
            </div>
            <Field label="Consigne" hint={promptHint} error={error ?? undefined} count={promptCount(action.promptTemplate)}>
              <textarea className="settings-textarea" aria-label={`Consigne ${action.name}`} rows={8} value={action.promptTemplate} spellCheck={false}
                aria-invalid={Boolean(error) || undefined}
                onChange={event => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...a, promptTemplate: event.target.value } : a) }, false)} />
            </Field>
            <div className="action-foot">
              {original && <Button size="sm" icon="rotate-ccw" onClick={() => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...original } : a) }, true)}>Rétablir la consigne</Button>}
              {!isDefault && <Button size="sm" onClick={() => persist({ ...settings, defaultActionId: action.id }, true)}>Définir par défaut</Button>}
              <Button size="sm" variant="danger" icon="trash-2" disabled={used}
                title={used ? 'Changez d’abord les raccourcis qui l’utilisent.' : undefined}
                onClick={() => persist({ ...settings, actions: settings.actions.filter(a => a.id !== action.id) }, true)}>Supprimer l’action</Button>
            </div>
          </div>}
        </section>;
      })}
    </div>
    <div className="action-note"><Callout>{engineHelp}</Callout></div>
  </>;
}

function Keys({ shortcut, extra }: { shortcut?: string; extra: number }) {
  if (!shortcut) return <span className="keycaps" data-state="empty">Sans raccourci</span>;
  return <span className="keycaps" data-state="idle">
    {shortcut.split('+').map((key, n) => <kbd key={n}>{key}</kbd>)}
    {extra > 0 && <span className="keycaps-plus">+{extra}</span>}
  </span>;
}
