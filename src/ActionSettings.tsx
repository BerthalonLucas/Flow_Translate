import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, SettingSwitch } from './settings/controls';
import { defaultActions, newActionTemplate, promptError } from './actionDefaults';
import type { Settings, ShortcutBinding } from './types';

type Props = {
  settings: Settings;
  persist: (settings: Settings, immediate: boolean) => void;
  record: (id: string, shortcut: string) => Promise<string | null>;
};
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
export function ActionSettings({ settings, persist, record }: Props) {
  const [capturing, setCapturing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const recorder = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (capturing) recorder.current?.focus(); }, [capturing]);
  const binding = (id: string, patch: Partial<ShortcutBinding>) => persist({ ...settings, shortcutBindings: settings.shortcutBindings.map(b => b.id === id ? { ...b, ...patch } : b) }, true);
  const captureKey = async (id: string, event: KeyboardEvent<HTMLSpanElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { setCapturing(null); return; }
    if (event.repeat || busy) return;
    const candidate = fromKey(event);
    if (candidate.error) { setNotice(candidate.error); return; }
    if (!candidate.value) return;
    setBusy(true); setCapturing(null); setNotice('');
    const error = await record(id, candidate.value);
    setNotice(error ?? 'Raccourci enregistré.'); setBusy(false);
  };
  return <>
    <section className="actions-settings">
      <div className="section-heading"><div><h2>Actions et consignes</h2><p>La consigne seule ; le texte sélectionné est envoyé après elle.</p></div>
        <button className="text-button" disabled={settings.actions.length >= 24} onClick={() => persist({ ...settings, actions: [...settings.actions, { id: crypto.randomUUID(), name: 'Nouvelle action', promptTemplate: newActionTemplate }] }, true)}>Ajouter une action</button></div>
      <label className="default-action">Action par défaut<select value={settings.defaultActionId} onChange={e => persist({ ...settings, defaultActionId: e.target.value }, true)}>{settings.actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <div className="action-list">{settings.actions.map(action => {
        const original = defaultActions.find(a => a.id === action.id);
        const error = promptError(action.promptTemplate);
        const used = settings.defaultActionId === action.id || settings.shortcutBindings.some(b => b.actionId === action.id);
        return <details className="action-card" key={action.id}>
          <summary><span>{action.name || 'Action sans nom'}</span><small>{original ? 'Prédéfinie' : 'Personnalisée'}</small><Icon name="chevron-down" size={14} /></summary>
          <div className="action-editor">
            <label>Nom de l’action<input value={action.name} maxLength={60} onChange={e => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...a, name: e.target.value } : a) }, false)} /></label>
            <label>Consigne<textarea aria-label={`Consigne ${action.name}`} rows={6} value={action.promptTemplate} spellCheck={false} aria-invalid={Boolean(error)} onChange={e => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...a, promptTemplate: e.target.value } : a) }, false)} /></label>
            <small>Écrivez la langue voulue dans la consigne. Les règles de sortie à la fin gardent les petits modèles au texte seul.</small>
            {error && <p className="row-warning" role="alert">{error}</p>}
            {original ? <button className="text-button" onClick={() => persist({ ...settings, actions: settings.actions.map(a => a.id === action.id ? { ...original } : a) }, true)}>Rétablir la consigne</button> : <button className="text-button" disabled={used} title={used ? 'Changez d’abord les raccourcis et l’action par défaut qui l’utilisent.' : undefined} onClick={() => persist({ ...settings, actions: settings.actions.filter(a => a.id !== action.id) }, true)}>Supprimer l’action{used ? ' · utilisée' : ''}</button>}
          </div>
        </details>;
      })}</div>
      <p className="settings-help">Les modèles Hy-MT ne savent que traduire. Pour corriger ou reformuler, pointez un profil de Connexion vers un modèle généraliste (le profil « general » du serveur livré, ou tout serveur compatible OpenAI).</p>
    </section>
    <section className="shortcuts-settings">
      <div className="section-heading"><div><h2>Raccourcis</h2><p>Une combinaison, une action, une destination.</p></div>
        <button className="text-button" disabled={settings.shortcutBindings.length >= 12 || busy} onClick={() => persist({ ...settings, shortcutBindings: [...settings.shortcutBindings, { id: crypto.randomUUID(), shortcut: '', actionId: settings.defaultActionId, outputMode: 'display', enabled: false }] }, true)}>Ajouter un raccourci</button></div>
      <fieldset className="shortcut-list" disabled={busy}>{settings.shortcutBindings.map(b => <article className="shortcut-card" key={b.id}>
        <div className="shortcut-card-heading"><SettingSwitch label="Activer ce raccourci" checked={b.enabled} onCheckedChange={enabled => binding(b.id, { enabled })} /><span>{b.enabled ? 'Actif' : 'Désactivé'}</span>
          {settings.shortcutBindings.length > 1 && <button className="icon-button" aria-label="Supprimer ce raccourci" onClick={() => persist({ ...settings, shortcutBindings: settings.shortcutBindings.filter(v => v.id !== b.id) }, true)}><Icon name="x" size={13} /></button>}</div>
        <div className="shortcut-control">
          <span ref={capturing === b.id ? recorder : undefined} className="keycaps" data-capturing={capturing === b.id || undefined} role="textbox" aria-label="Raccourci" aria-readonly="true" tabIndex={capturing === b.id ? 0 : -1} onKeyDown={e => void captureKey(b.id, e)} onBlur={() => setCapturing(null)}>
            {capturing === b.id ? <em>Pressez la combinaison…</em> : b.shortcut ? b.shortcut.split('+').map((key, n) => <kbd key={n}>{key}</kbd>) : <em>À définir</em>}
          </span><button className="text-button" onClick={() => { setNotice(''); setCapturing(current => current === b.id ? null : b.id); }}>{capturing === b.id ? 'Annuler' : 'Modifier'}</button>
        </div>
        <div className="shortcut-options"><label>Action<select value={b.actionId} onChange={e => binding(b.id, { actionId: e.target.value })}>{settings.actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>Résultat<select value={b.outputMode} onChange={e => binding(b.id, { outputMode: e.target.value as 'display' | 'replace' })}><option value="display">Afficher dans la bulle</option><option value="replace">Remplacer la sélection</option></select></label></div>
      </article>)}</fieldset>
      {notice && <p className="row-warning" role={notice === 'Raccourci enregistré.' ? 'status' : 'alert'}>{notice}</p>}
      <p className="settings-help">Ctrl ou Alt requis. Windows, F12 et les combinaisons système sont refusés. Une nouvelle combinaison valide est activée dès son enregistrement. « Remplacer la sélection » colle le résultat à la place du texte sélectionné, dans n’importe quel champ ; si le collage échoue, le résultat reste dans la bulle.</p>
    </section>
  </>;
}
