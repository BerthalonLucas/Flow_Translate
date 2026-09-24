import { defaultActionId, defaultActions, defaultBindings, defaultMenuActionIds, instructionActionId, instructionActionName, instructionError } from '../src/actionDefaults';
// Browser-only IPC fixture. This does not launch a native window or read user data.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import type { BindingState, Capture, ErrorCode, ExecutionInfo, HaloEvent, Rect, Settings, ShortcutStatus, TranslationRequest, UndoLoss, UndoOutcome } from '../src/types';

let settings: Settings = { mode: 'quality', defaultActionId, actions: structuredClone(defaultActions), shortcutBindings: structuredClone(defaultBindings), historyEnabled: false, autostart: false, connectionExpanded: false, textSize: 'normal', autoClose: 'normal', uiVersion: 'v4', language: 'en', theme: 'system', motion: 'system', motionPreset: 'smooth', indicator: 'perle', afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: true }, undoStrategy: 'keystroke', pillPlacement: 'below', glassMaterial: 'painted', menuActionIds: [...defaultMenuActionIds],
  profiles: { fast: { endpoint: '', model: 'test', apiKey: '' }, quality: { endpoint: '', model: 'test', apiKey: '' } } };
// canReplace is false here; a test raises it with `target` (Rust knows it at the capture since 0.4.0).
// The fixture's captures are anchored on a 1920 × 1040 screen unless a test says otherwise.
const capture = (id: string, text = 'Example selection', execution?: ExecutionInfo): Capture => ({ id, text, source: 'selection', canReplace: false, anchor: { x: 400, y: 300, width: 120, height: 18 }, screen: { width: 1920, height: 1040, scale: 1 }, ...(execution ? { execution } : {}) });
const replaceExecution: ExecutionInfo = { actionId: 'correct', actionName: 'Corriger', outputMode: 'replace', mode: 'quality' };
// Every command the page invokes, with the page's clock when it did (performance.now()).
const calls: Array<{ command: string; args: Record<string, unknown> | undefined; at: number }> = [];
let request: TranslationRequest;
let currentCapture = capture('first');
let heldCopy = false;
let failSettings = new URLSearchParams(location.search).has('settingsError');
let connected = false;
let refuseShortcut = false;
// Rust's refusal of the next `replace_result`: `{message, code}` (Refusal) since the review of
// da-ilot, the French message for the 0.4 glass, the code for the Îlot.
let refuseReplace: { message: string; code: ErrorCode } | null = null;
// Lot 9: what `undo_result` answers (Rust's UndoOutcome, or a rejection: its French string), at
// once or once released.
let undoAnswer: { outcome?: Partial<UndoOutcome>; reject?: string } = {};
let holdUndo = false;
let releaseUndo: (() => void) | undefined;
let resolveCopy: (() => void) | undefined;
// Rust's reading of « Effets d'animation »: unknown until a test sets it.
let windowsMotion: { reduced: boolean } | null = null;
// Îlot (lots 3–4): whether the overlay gets the foreground, and the menu capture's choice.
let overlayFocus = true;
const chosen = new Set<string>();
// Where Rust put the overlay window (physical pixels), for the Îlot's side: by default below the
// fixture's anchor, the Îlot's strip 8 px under the selection, its right edge (149 + 283 in the
// window) on the selection's end (src/layout.ts, ilotReserve).
let overlayPosition = { x: 400 + 120 - 432, y: 300 + 18 + 8 - 104 };
// The next read of that position answers only once released: the Îlot waits for its side.
let holdPosition = false;
let releasePosition: (() => void) | undefined;
// The work area of the screen holding a point (`monitorFromPoint`, physical pixels), for the room
// the Îlot has around its strip: one 1920 × 1080 screen, its taskbar 40 high.
let workArea = { x: 0, y: 0, width: 1920, height: 1040 };
const monitor = () => ({ name: 'fixture', scaleFactor: 1, position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, workArea: { position: { x: workArea.x, y: workArea.y }, size: { width: workArea.width, height: workArea.height } } });
// The next `choose_action` is refused, as when the chosen action was deleted meanwhile.
let refuseChoice = false;
// The next `choose_action` answers only once released: a choice still on its way.
let holdChoice = false;
let releaseChoice: (() => void) | undefined;
// Lot 10: what Windows answered for each binding (`shortcut_status`); by default every enabled
// chord is registered. A test sets a binding's state (another application holds the chord: 'taken'),
// or the URL does before the window opens (`&shortcutTaken=<binding id>`).
let shortcutStates: Record<string, BindingState> = {};
const takenAtStart = new URLSearchParams(location.search).get('shortcutTaken');
if (takenAtStart) shortcutStates[takenAtStart] = 'taken';
const shortcutStatus = (): ShortcutStatus[] => settings.shortcutBindings.map(b => ({ bindingId: b.id, shortcut: b.shortcut, state: shortcutStates[b.id] ?? (b.enabled ? 'registered' : 'disabled') }));
mockIPC((command, args) => {
  calls.push({ command, args, at: performance.now() });
  if (command === 'get_settings') { if (failSettings) { return Promise.reject('Synthetic settings failure'); } return settings; }
  if (command === 'get_history') return [];
  if (command === 'system_motion') return windowsMotion;
  if (command === 'save_settings') {
    const next = args?.settings as Settings;
    if (refuseShortcut && JSON.stringify(next.shortcutBindings) !== JSON.stringify(settings.shortcutBindings)) return Promise.reject('Le raccourci est déjà utilisé ou indisponible.');
    // As Rust: a binding saved on another chord registered it (a taken one refuses the save), and
    // every save sends the state of each shortcut.
    for (const binding of next.shortcutBindings) if (settings.shortcutBindings.find(b => b.id === binding.id)?.shortcut !== binding.shortcut) delete shortcutStates[binding.id];
    settings = next;
    void emit('shortcut-status', shortcutStatus());
    return;
  }
  if (command === 'check_connection') return { connected, message: connected ? 'Modèle trouvé.' : 'Serveur indisponible.' };
  if (command === 'frontend_ready') return currentCapture;
  if (command === 'translate') request = args?.request as TranslationRequest;
  if (command === 'focus_overlay') return overlayFocus;
  if (command === 'plugin:window|inner_position') {
    if (!holdPosition) return overlayPosition;
    holdPosition = false;
    return new Promise(resolve => { releasePosition = () => resolve(overlayPosition); });
  }
  if (command === 'plugin:window|monitor_from_point') return monitor();
  if (command === 'choose_action') {
    const { captureId, actionId, instruction } = args as { captureId: string; actionId: string; instruction?: string };
    if (captureId !== currentCapture.id || !currentCapture.menu) return Promise.reject('Cette capture n’attend pas de choix.');
    if (refuseChoice) { refuseChoice = false; return Promise.reject('L’action n’existe plus.'); }
    if (chosen.has(captureId)) return Promise.reject('Une action a déjà été choisie pour cette sélection.');
    const action = settings.actions.find(item => item.id === actionId);
    if (instruction !== undefined ? actionId !== instructionActionId || instructionError(instruction) : !action) return Promise.reject('L’action n’existe plus.');
    chosen.add(captureId);
    const execution = { actionId, actionName: action?.name ?? instructionActionName, outputMode: 'replace', mode: settings.mode } satisfies ExecutionInfo;
    if (holdChoice) { holdChoice = false; return new Promise<ExecutionInfo>(resolve => { releaseChoice = () => resolve(execution); }); }
    return execution;
  }
  if (command === 'shortcut_status') return shortcutStatus();
  if (command === 'shortcut_conflict') return (args as { shortcut: string }).shortcut === 'Ctrl+Alt+E' ? { altGr: true, character: '€' } : { altGr: false };
  // Lot 10's `open_settings({ field })` on an open Settings window: the event it will send.
  if (command === 'open_settings' && args?.field) return emit('settings-focus-field', { field: args.field });
  if (command === 'start_drag') return Promise.reject('Synthetic drag failure');
  if (command === 'dismiss_overlay') return emit('overlay-dismiss-requested', { captureId: currentCapture.id });
  if (command === 'copy_result' && heldCopy) return new Promise<void>(resolve => { resolveCopy = resolve; });
  // Lot 9: Rust undoes once, after revalidation; the marks it draws are counted, never shown here.
  if (command === 'undo_result') {
    const requestId = (args as { requestId: string }).requestId;
    const answer = () => undoAnswer.reject !== undefined ? Promise.reject(undoAnswer.reject)
      : Promise.resolve({ requestId, status: 'undone', confirmed: true, message: 'Remplacement annulé.', ...undoAnswer.outcome } satisfies UndoOutcome);
    if (!holdUndo) return answer();
    holdUndo = false;
    return new Promise((resolve, reject) => { releaseUndo = () => { answer().then(resolve, reject); }; });
  }
  if (command === 'highlight_changes') { const ranges = (args as { ranges: unknown[] }).ranges; return { ranges: ranges.length, lines: ranges.length }; }
  if (command === 'clear_highlight') return;
  if (command === 'replace_result' && refuseReplace !== null) { void emit('capture-target', { captureId: currentCapture.id, canReplace: false }); return Promise.reject(refuseReplace); }
}, { shouldMockEvents: true });
mockWindows('overlay');

Object.assign(window, { nativeFixture: {
  calls,
  recoverSettings: () => { failSettings = false; },
  connect: () => { connected = true; },
  refuseShortcut: () => { refuseShortcut = true; },
  refuseReplace: (message: string | null = 'La fenêtre source a changé; remplacement refusé.', code: ErrorCode = 'target_changed') => { refuseReplace = message === null ? null : { message, code }; },
  // A failed request; lot 10 sends its code beside the French message (none: a 0.4 error).
  error: (code?: ErrorCode, message = 'Serveur indisponible.') => emit('translation', { requestId: request.id, kind: 'error', message, ...(code ? { code } : {}) }),
  capture: (id: string, text?: string) => { currentCapture = capture(id, text); return emit('capture', currentCapture); },
  // A « replace » capture: Rust will paste the first complete result and report `result-delivery`.
  captureReplace: (id: string, text?: string) => { currentCapture = { ...capture(id, text, replaceExecution), canReplace: true }; return emit('capture', currentCapture); },
  deliver: async (status: 'applied' | 'fallback', confirmed = status === 'applied', message = status === 'applied' ? 'Sélection remplacée.' : 'Le collage a été bloqué; utilisez Copier.', code?: ErrorCode) => { await emit('capture-target', { captureId: currentCapture.id, canReplace: false }); await emit('result-delivery', { requestId: request.id, status, confirmed, message, ...(code ? { code } : {}) }); },
  // Lot 9: Rust's own paste under the Îlot, its text found (`pastedRects`, physical) and Undo on
  // (`undoable`), or not.
  pasted: async ({ undoable = true, pastedRects = [{ x: 380, y: 300, width: 140, height: 18 }] }: { undoable?: boolean; pastedRects?: Rect[] } = {}) => {
    await emit('capture-target', { captureId: currentCapture.id, canReplace: false });
    await emit('result-delivery', { requestId: request.id, status: 'applied', confirmed: true, message: 'Sélection remplacée.', pastedRects, undoable });
  },
  // What the next `undo_result` answers: an outcome (undone by default), or a rejection.
  undoWith: (outcome: Partial<UndoOutcome>) => { undoAnswer = { outcome }; },
  undoRejects: (message = 'Ce résultat n’est plus actif.') => { undoAnswer = { reject: message }; },
  holdUndo: () => { holdUndo = true; },
  releaseUndo: () => { releaseUndo?.(); releaseUndo = undefined; },
  // Rust withdrew Undo: a key in the source, the user's own Ctrl+Z, the caret moved.
  undoState: (reason: UndoLoss = 'typed', requestId = request.id) => emit('undo-state', { requestId, available: false, reason }),
  delta: (text: string, requestId = request.id) => emit('translation', { requestId, kind: 'delta', text }),
  done: (text?: string) => emit('translation', { requestId: request.id, kind: 'done', ...(text === undefined ? {} : { text }) }),
  dismissEvent: (captureId: string) => emit('overlay-dismiss-requested', { captureId }),
  requestId: () => request.id,
  holdCopy: () => { heldCopy = true; },
  releaseCopy: () => { resolveCopy?.(); heldCopy = false; },
  near: (near: boolean) => emit('glass-near', { near }),
  target: (captureId: string, canReplace: boolean) => emit('capture-target', { captureId, canReplace }),
  notice: (message: string, code?: ErrorCode) => emit('capture-notice', { message, ...(code ? { code } : {}) }),
  // The watcher dropped the selection (lot 10: code target_changed).
  invalidate: (anchorLost = false, captureId = currentCapture.id) => emit('target-invalidated', { captureId, anchorLost, message: 'La sélection a changé.', code: 'target_changed' }),
  // Lot 10: what Windows answered for each binding; sent as `shortcut-status` when `emitNow`.
  shortcutStates: (states: Record<string, BindingState>, emitNow = true) => { shortcutStates = states; return emitNow ? emit('shortcut-status', shortcutStatus()) : undefined; },
  workArea: (width: number, height: number, scale = 1) => emit('work-area', { width, height, scale }),
  systemMotion: (reduced: boolean) => { windowsMotion = { reduced }; return emit('system-motion', windowsMotion); },
  settings: (next: Partial<Settings>) => { settings = { ...settings, ...next }; return emit('settings-changed', settings); },
  // Lot 13: a direct link to a field of the open Settings window.
  focusField: (field: string) => emit('settings-focus-field', { field }),
  unanchored: (id: string) => { currentCapture = { ...capture(id), source: 'clipboard', anchor: null }; return emit('capture', currentCapture); },
  // A `menu` capture under the Îlot: no execution until choose_action.
  captureMenu: (id: string, lastActionId: string | null = null, text?: string) => { currentCapture = { ...capture(id, text), canReplace: true, menu: { lastActionId } }; return emit('capture', currentCapture); },
  refuseFocus: () => { overlayFocus = false; },
  grantFocus: () => { overlayFocus = true; },
  refuseChoice: () => { refuseChoice = true; },
  holdChoice: () => { holdChoice = true; },
  releaseChoice: () => { releaseChoice?.(); releaseChoice = undefined; },
  // A menu capture without an anchor (clipboard): the Îlot opens at the bottom of the screen.
  unanchoredMenu: (id: string, lastActionId: string | null = null) => { currentCapture = { ...capture(id), source: 'clipboard', anchor: null, canReplace: true, menu: { lastActionId } }; return emit('capture', currentCapture); },
  // Rust placed the window elsewhere (above the selection, another screen): physical pixels.
  windowAt: (x: number, y: number) => { overlayPosition = { x, y }; },
  // The next read of the window's position waits for releasePosition (the Îlot not shown yet).
  holdPosition: () => { holdPosition = true; },
  releasePosition: () => { releasePosition?.(); releasePosition = undefined; },
  // The work area of the anchor's screen (physical pixels): a taskbar on the left, another screen.
  workAreaAt: (x: number, y: number, width: number, height: number) => { workArea = { x, y, width, height }; },
  menuKey: (key: string, shiftKey = false, captureId = currentCapture.id) => emit('menu-key', { captureId, key, shiftKey }),
  // Lot 4: the menu shortcut pressed twice within 400 ms while its menu waits.
  menuRepeat: (captureId = currentCapture.id) => emit('menu-repeat', { captureId }),
  // Lot 6: what Rust sends the halo window (lines in logical pixels relative to it).
  halo: (event: HaloEvent) => emit('halo', event),
  replay: (id: string) => { currentCapture = { ...capture(id, 'Example selection'), source: 'clipboard', canReplace: false, anchor: null, replay: { requestId: `replay-${id}`, translatedText: 'Exemple de sélection', mode: 'quality' } }; return emit('capture', currentCapture); },
} });
await import('../src/main');

