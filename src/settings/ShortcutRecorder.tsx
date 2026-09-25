import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { bridge } from '../bridge';
import { useT, type MessageKey } from '../i18n';
import type { BindingState, ShortcutConflict } from '../types';
import { describeRefusal } from './messages';

// The keys of a keydown the recorder reads (a React or a DOM KeyboardEvent).
export type RecordedKey = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'getModifierState'>;
export function fromKey(event: RecordedKey): { value?: string; error?: MessageKey } {
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'NumLock'].includes(event.key)) return {};
  if (event.metaKey) return { error: 'shortcuts.windowsKey' };
  if (event.getModifierState('AltGraph')) return { error: 'shortcuts.altGr' };
  if (!event.ctrlKey && !event.altKey) return { error: 'shortcuts.needModifier' };
  if (event.key === 'F12') return { error: 'shortcuts.f12' };
  if ((event.ctrlKey && event.altKey && event.key === 'Delete') || (event.altKey && ['Tab', 'F4', 'Escape'].includes(event.key))) return { error: 'shortcuts.system' };
  const { code, key } = event;
  // Windows registers virtual letter keys: respect the active layout (AZERTY too). Ctrl+Alt
  // on a letter that has an AltGr character reports that character (AZERTY: Ctrl+Alt+E → €):
  // the letter then comes from the physical key, and the recorder warns (shortcut_conflict).
  const main = /^[a-z]$/i.test(key) ? key.toUpperCase() : event.ctrlKey && event.altKey && /^Key[A-Z]$/.test(code) ? code.slice(3)
    : /^Digit\d$/.test(code) ? code.slice(5)
    : /^F([1-9]|1[01]|2[0-4]|1[3-9])$/.test(key) ? key : code === 'Space' ? 'Space'
    : ['Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(key) ? key
    : key.startsWith('Arrow') ? key.slice(5) : null;
  if (!main) return { error: 'shortcuts.badKey' };
  return { value: [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', main].filter(Boolean).join('+') };
}

// Rust answers with the layout of the window in front (the Settings while they are open);
// one question per chord and window is enough.
const conflicts = new Map<string, Promise<ShortcutConflict | null>>();
const holdsCtrlAlt = (shortcut: string) => { const parts = shortcut.toLowerCase().split('+'); return parts.includes('ctrl') && parts.includes('alt'); };
function useAltGrConflict(shortcut: string, enabled: boolean): ShortcutConflict | null {
  const [conflict, setConflict] = useState<{ shortcut: string; value: ShortcutConflict | null } | null>(null);
  useEffect(() => {
    if (!enabled || !shortcut || !holdsCtrlAlt(shortcut)) return;
    let live = true;
    let pending = conflicts.get(shortcut);
    if (!pending) { pending = bridge.shortcutConflict(shortcut).catch(() => null); conflicts.set(shortcut, pending); }
    void pending.then(value => { if (live) setConflict({ shortcut, value }); });
    return () => { live = false; };
  }, [shortcut, enabled]);
  return enabled && conflict?.shortcut === shortcut && conflict.value?.altGr ? conflict.value : null;
}

// A notice is one of ours (a message key, shown in the current language) or Rust's refusal.
type Notice = { key: MessageKey } | { text: string } | null;
type Props = {
  shortcut: string;
  enabled: boolean;
  label: string;
  busy: boolean;
  // Saves the chord (enabling its binding); null once saved, else Rust's refusal.
  record: (shortcut: string) => Promise<string | null>;
  // What Windows answered for this chord (lot 10, `shortcut_status`): 'taken' when another
  // application holds it, 'failed' for any other refusal. Unknown: nothing is said.
  registration?: BindingState;
  // Lucas, 24/09: a taken chord gets a free one to take in one click (the menu's: Rust's
  // suggest_shortcut); null when none is free.
  suggest?: () => Promise<string | null>;
};
// The proposal for a taken chord, asked again whenever the chord or its state changes.
function useSuggestion(suggest: Props['suggest'], shortcut: string, taken: boolean): string | null {
  const [suggestion, setSuggestion] = useState<{ shortcut: string; value: string | null } | null>(null);
  useEffect(() => {
    if (!suggest || !taken || !shortcut) return;
    let live = true;
    void suggest().then(value => { if (live) setSuggestion({ shortcut, value }); }, () => undefined);
    return () => { live = false; };
  }, [suggest, shortcut, taken]);
  return taken && suggestion?.shortcut === shortcut ? suggestion.value : null;
}
// The keycaps, the Change button, then what happened: saved, refused (translated), whether
// Windows could register the saved chord, and the AltGr warning while the saved chord is also an
// AltGr key here. Warnings, never a refusal: the recorder stays free to take another chord.
// Rendered as siblings: the parent row or card lays them out.
export function ShortcutRecorder({ shortcut, enabled, label, busy, record, registration, suggest }: Props) {
  const t = useT();
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const recorder = useRef<HTMLSpanElement>(null);
  const conflict = useAltGrConflict(shortcut, enabled);
  const proposal = useSuggestion(suggest, shortcut, enabled && registration === 'taken');
  useEffect(() => { if (capturing) recorder.current?.focus(); }, [capturing]);
  const take = async (value: string) => {
    setCapturing(false); setNotice(null);
    const error = await record(value);
    setNotice(error === null ? { key: 'shortcuts.saved' } : { text: error });
  };
  const captureKey = async (event: KeyboardEvent<HTMLSpanElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { setCapturing(false); return; }
    if (event.repeat || busy) return;
    const candidate = fromKey(event);
    if (candidate.error) { setNotice({ key: candidate.error }); return; }
    if (!candidate.value) return;
    await take(candidate.value);
  };
  const noticeText = notice === null ? '' : 'key' in notice ? t(notice.key) : describeRefusal(notice.text, t);
  const saved = notice !== null && 'key' in notice && notice.key === 'shortcuts.saved';
  const key = shortcut.split('+').at(-1) ?? '';
  return <>
    <div className="shortcut-control">
      <span ref={recorder} className="keycaps" data-capturing={capturing || undefined} role="textbox" aria-label={label} aria-readonly="true" tabIndex={capturing ? 0 : -1} onKeyDown={event => void captureKey(event)} onBlur={() => setCapturing(false)}>
        {capturing ? <em>{t('shortcuts.press')}</em> : shortcut ? shortcut.split('+').map((part, n) => <kbd key={n}>{part}</kbd>) : <em>{t('shortcuts.unset')}</em>}
      </span>
      {/* While listening, a press on Cancel must not first blur the keycaps (which would stop,
          then the click would start listening again). */}
      <button type="button" className="text-button" disabled={busy} onMouseDown={event => { if (capturing) event.preventDefault(); }} onClick={() => { setNotice(null); setCapturing(current => !current); }}>{t(capturing ? 'shortcuts.cancel' : 'shortcuts.change')}</button>
    </div>
    {noticeText && <p className="row-warning shortcut-notice" data-ok={saved || undefined} role={saved ? 'status' : 'alert'}>{noticeText}</p>}
    {enabled && shortcut && !capturing && (registration === 'taken' || registration === 'failed') && <p className="row-warning shortcut-notice" data-warning={registration} role="status">{t(registration === 'taken' ? 'shortcuts.stateTaken' : 'shortcuts.stateFailed', { shortcut })}</p>}
    {proposal && !capturing && <p className="shortcut-notice shortcut-suggestion"><button type="button" className="text-button" disabled={busy} onClick={() => void take(proposal)}>{t('shortcuts.useSuggestion', { shortcut: proposal })}</button></p>}
    {conflict && !capturing && <p className="row-warning shortcut-notice" data-warning="altgr" role="status">{conflict.character ? t('shortcuts.altGrConflict', { shortcut, key, character: conflict.character }) : t('shortcuts.altGrConflictKey', { shortcut, key })}</p>}
  </>;
}
