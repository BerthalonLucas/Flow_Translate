import { defaultActionId, defaultActions, defaultBindings, defaultMenuActionIds, instructionActionId, instructionActionName, instructionError } from '../src/actionDefaults';
// Browser-only IPC fixture. This does not launch a native window or read user data.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import type { Capture, ExecutionInfo, Settings, TranslationRequest } from '../src/types';

let settings: Settings = { mode: 'quality', defaultActionId, actions: structuredClone(defaultActions), shortcutBindings: structuredClone(defaultBindings), historyEnabled: false, autostart: false, connectionExpanded: false, textSize: 'normal', autoClose: 'normal', uiVersion: 'v4', language: 'en', theme: 'system', motion: 'system', motionPreset: 'smooth', indicator: 'perle', afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: true }, undoStrategy: 'keystroke', pillPlacement: 'below', glassMaterial: 'painted', menuActionIds: [...defaultMenuActionIds],
  profiles: { fast: { endpoint: '', model: 'test', apiKey: '' }, quality: { endpoint: '', model: 'test', apiKey: '' } } };
// canReplace is false here; a test raises it with `target` (Rust knows it at the capture since 0.4.0).
// The fixture's captures are anchored on a 1920 × 1040 screen unless a test says otherwise.
const capture = (id: string, text = 'Example selection', execution?: ExecutionInfo): Capture => ({ id, text, source: 'selection', canReplace: false, anchor: { x: 400, y: 300, width: 120, height: 18 }, screen: { width: 1920, height: 1040, scale: 1 }, ...(execution ? { execution } : {}) });
const replaceExecution: ExecutionInfo = { actionId: 'correct', actionName: 'Corriger', outputMode: 'replace', mode: 'quality' };
const calls: Array<{ command: string; args: Record<string, unknown> | undefined }> = [];
let request: TranslationRequest;
let currentCapture = capture('first');
let heldCopy = false;
let failSettings = new URLSearchParams(location.search).has('settingsError');
let connected = false;
let refuseShortcut = false;
let refuseReplace = false;
let resolveCopy: (() => void) | undefined;
// Îlot (lots 3–4): whether the overlay gets the foreground, and the menu capture's choice.
let overlayFocus = true;
const chosen = new Set<string>();
mockIPC((command, args) => {
  calls.push({ command, args });
  if (command === 'get_settings') { if (failSettings) { return Promise.reject('Synthetic settings failure'); } return settings; }
  if (command === 'get_history') return [];
  if (command === 'save_settings') { const next = args?.settings as Settings; if (refuseShortcut && JSON.stringify(next.shortcutBindings) !== JSON.stringify(settings.shortcutBindings)) return Promise.reject('Le raccourci est déjà utilisé ou indisponible.'); settings = next; return; }
  if (command === 'check_connection') return { connected, message: connected ? 'Modèle trouvé.' : 'Serveur indisponible.' };
  if (command === 'frontend_ready') return currentCapture;
  if (command === 'translate') request = args?.request as TranslationRequest;
  if (command === 'focus_overlay') return overlayFocus;
  if (command === 'choose_action') {
    const { captureId, actionId, instruction } = args as { captureId: string; actionId: string; instruction?: string };
    if (captureId !== currentCapture.id || !currentCapture.menu) return Promise.reject('Cette capture n’attend pas de choix.');
    if (chosen.has(captureId)) return Promise.reject('Une action a déjà été choisie pour cette sélection.');
    const action = settings.actions.find(item => item.id === actionId);
    if (instruction !== undefined ? actionId !== instructionActionId || instructionError(instruction) : !action) return Promise.reject('L’action n’existe plus.');
    chosen.add(captureId);
    return { actionId, actionName: action?.name ?? instructionActionName, outputMode: 'replace', mode: settings.mode } satisfies ExecutionInfo;
  }
  if (command === 'shortcut_conflict') return (args as { shortcut: string }).shortcut === 'Ctrl+Alt+E' ? { altGr: true, character: '€' } : { altGr: false };
  if (command === 'start_drag') return Promise.reject('Synthetic drag failure');
  if (command === 'dismiss_overlay') return emit('overlay-dismiss-requested', { captureId: currentCapture.id });
  if (command === 'copy_result' && heldCopy) return new Promise<void>(resolve => { resolveCopy = resolve; });
  if (command === 'replace_result' && refuseReplace) { void emit('capture-target', { captureId: currentCapture.id, canReplace: false }); return Promise.reject('La fenêtre source a changé; remplacement refusé.'); }
}, { shouldMockEvents: true });
mockWindows('overlay');

Object.assign(window, { nativeFixture: {
  calls,
  recoverSettings: () => { failSettings = false; },
  connect: () => { connected = true; },
  refuseShortcut: () => { refuseShortcut = true; },
  refuseReplace: () => { refuseReplace = true; },
  error: () => emit('translation', { requestId: request.id, kind: 'error', message: 'Serveur indisponible.' }),
  capture: (id: string, text?: string) => { currentCapture = capture(id, text); return emit('capture', currentCapture); },
  // A « replace » capture: Rust will paste the first complete result and report `result-delivery`.
  captureReplace: (id: string, text?: string) => { currentCapture = { ...capture(id, text, replaceExecution), canReplace: true }; return emit('capture', currentCapture); },
  deliver: async (status: 'applied' | 'fallback', confirmed = status === 'applied', message = status === 'applied' ? 'Sélection remplacée.' : 'Le collage a été bloqué; utilisez Copier.') => { await emit('capture-target', { captureId: currentCapture.id, canReplace: false }); await emit('result-delivery', { requestId: request.id, status, confirmed, message }); },
  delta: (text: string, requestId = request.id) => emit('translation', { requestId, kind: 'delta', text }),
  done: (text?: string) => emit('translation', { requestId: request.id, kind: 'done', ...(text === undefined ? {} : { text }) }),
  dismissEvent: (captureId: string) => emit('overlay-dismiss-requested', { captureId }),
  requestId: () => request.id,
  holdCopy: () => { heldCopy = true; },
  releaseCopy: () => { resolveCopy?.(); heldCopy = false; },
  near: (near: boolean) => emit('glass-near', { near }),
  target: (captureId: string, canReplace: boolean) => emit('capture-target', { captureId, canReplace }),
  notice: (message: string) => emit('capture-notice', { message }),
  workArea: (width: number, height: number, scale = 1) => emit('work-area', { width, height, scale }),
  settings: (next: Partial<Settings>) => { settings = { ...settings, ...next }; return emit('settings-changed', settings); },
  unanchored: (id: string) => { currentCapture = { ...capture(id), source: 'clipboard', anchor: null }; return emit('capture', currentCapture); },
  // A `menu` capture under the Îlot: no execution until choose_action.
  captureMenu: (id: string, lastActionId: string | null = null, text?: string) => { currentCapture = { ...capture(id, text), canReplace: true, menu: { lastActionId } }; return emit('capture', currentCapture); },
  refuseFocus: () => { overlayFocus = false; },
  menuKey: (key: string, shiftKey = false, captureId = currentCapture.id) => emit('menu-key', { captureId, key, shiftKey }),
  // Lot 4: the menu shortcut pressed twice within 400 ms while its menu waits.
  menuRepeat: (captureId = currentCapture.id) => emit('menu-repeat', { captureId }),
  replay: (id: string) => { currentCapture = { ...capture(id, 'Example selection'), source: 'clipboard', canReplace: false, anchor: null, replay: { requestId: `replay-${id}`, translatedText: 'Exemple de sélection', mode: 'quality' } }; return emit('capture', currentCapture); },
} });
await import('../src/main');

