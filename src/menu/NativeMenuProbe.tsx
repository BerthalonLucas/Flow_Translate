// PROVISIONAL (lots 3–4, native owner): a bare keyboard driver for the Îlot contract, so
// the real window can be exercised before the real menu exists. It only shows with
// uiVersion 'ilot' while a menu capture waits for its choice. The Îlot of lot 7
// (src/menu/Ilot.tsx) replaces it: delete this file and its one line in App.tsx then.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { bridge } from '../bridge';
import { instructionActionId, instructionError } from '../actionDefaults';
import type { ActionDefinition, MenuKey } from '../types';
import type { TranslationController } from '../useTranslation';

const box: CSSProperties = { position: 'fixed', left: 8, bottom: 8, maxWidth: 420, padding: '6px 10px', borderRadius: 10, background: 'rgb(250 250 252 / .96)', color: 'rgb(29 29 31)', font: '12px/1.4 "Segoe UI", sans-serif', boxShadow: '0 4px 16px rgb(0 0 0 / .2)', zIndex: 10 };

export function NativeMenuProbe({ controller }: { controller: TranslationController }) {
  const { state, settings, choose, cancelAndDismiss } = controller;
  const capture = state.capture;
  const open = settings?.uiVersion === 'ilot' && Boolean(capture?.menu) && !capture?.execution && !controller.closingCaptureId;
  const captureId = open ? capture!.id : null;
  // null: not asked yet; false: the keyboard stays with the source (the hook forwards `menu-key`).
  const [focused, setFocused] = useState<boolean | null>(null);
  const [index, setIndex] = useState(-1);
  const [field, setField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const actions = settings?.actions ?? [];
  const grid = (settings?.menuActionIds.length ? settings.menuActionIds : actions.slice(0, 6).map(action => action.id))
    .map(id => actions.find(action => action.id === id)).filter((action): action is ActionDefinition => Boolean(action)).slice(0, 6);
  const last = capture?.menu?.lastActionId ?? settings?.defaultActionId ?? grid[0]?.id;

  useEffect(() => {
    setFocused(null); setIndex(-1); setField(null); setError('');
    if (!captureId) return;
    let current = true;
    void bridge.focusOverlay().then(value => { if (current) setFocused(value); }, () => { if (current) setFocused(false); });
    return () => { current = false; };
  }, [captureId]);
  useEffect(() => { if (field !== null) input.current?.focus(); }, [field]);

  const run = useCallback((actionId: string | undefined, instruction?: string) => {
    if (!actionId) return;
    void choose(actionId, instruction).catch((reason: unknown) => setError(typeof reason === 'string' ? reason : 'Choice refused.'));
  }, [choose]);

  // One table for the focused WebView (keydown) and the native fallback (`menu-key`).
  const handle = useCallback((key: string, shift: boolean, fromWebView: boolean): boolean => {
    if (key === 'Escape') { cancelAndDismiss(); return true; }
    if (key === 'Enter') { run(index >= 0 ? grid[index]?.id : last); return true; }
    if (key === 'Tab' || key.startsWith('Arrow')) {
      const back = key === 'ArrowUp' || key === 'ArrowLeft' || (key === 'Tab' && shift);
      setIndex(value => grid.length ? (value + (back ? grid.length - 1 : 1) + (value < 0 && back ? 1 : 0)) % grid.length : -1);
      return true;
    }
    if (/^[1-6]$/.test(key)) { run(grid[Number(key) - 1]?.id); return true; }
    if ((key === ' ' || key === '/') && fromWebView) { setField(''); return true; }
    if ([...key].length === 1 && /\p{L}/u.test(key)) {
      const action = grid.find(item => item.key?.toLowerCase() === key.toLowerCase());
      if (action) run(action.id);
      else if (fromWebView) setField(key);
      return true;
    }
    return false;
  }, [cancelAndDismiss, grid, index, last, run]);

  useEffect(() => {
    if (!captureId || field !== null) return;
    const onKey = (event: KeyboardEvent) => {
      // AltGr is Ctrl+Alt on Windows; a chord still held after the shortcut is not a menu key.
      if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      if (handle(event.key, event.shiftKey, true)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [captureId, field, handle]);
  useEffect(() => {
    if (!captureId) return;
    let disposed = false;
    const listening = bridge.on<MenuKey>('menu-key', key => { if (!disposed && key.captureId === captureId) handle(key.key, key.shiftKey, false); });
    return () => { disposed = true; void listening.then(unlisten => unlisten()); };
  }, [captureId, handle]);

  if (!captureId) return null;
  const name = (id: string | undefined) => actions.find(action => action.id === id)?.shortName ?? actions.find(action => action.id === id)?.name ?? id;
  return <div style={box} data-menu-probe data-focused={focused === null ? undefined : String(focused)} role="menu" aria-label="Îlot (provisional)">
    <div><strong>Îlot probe</strong> · provisional · {focused === null ? '…' : focused ? 'keyboard here' : 'keyboard fallback'}</div>
    <div>↵ {name(last)}{grid.map((action, n) => <span key={action.id} role="menuitem" data-active={n === index || undefined} style={{ marginLeft: 8, fontWeight: n === index ? 700 : 400 }}>{n + 1}·{action.key ?? '–'} {name(action.id)}</span>)}</div>
    {field !== null && <input ref={input} aria-label="Instruction" value={field} maxLength={1000} style={{ width: '100%', marginTop: 4, font: 'inherit' }}
      onChange={event => setField(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setField(null); }
        else if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); const problem = instructionError(field); if (problem) setError(problem); else run(instructionActionId, field); }
      }} />}
    {error && <div role="alert">{error}</div>}
  </div>;
}
