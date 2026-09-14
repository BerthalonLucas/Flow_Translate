// Browser-only IPC fixture. This does not launch a native window or read user data.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import type { Capture, Settings, TranslationRequest } from '../src/types';

let settings: Settings = { targetLanguage: 'fr', mode: 'quality', shortcut: 'Ctrl+Alt+T', historyEnabled: false, autostart: false, connectionExpanded: false, textSize: 'normal', autoClose: 'normal',
  profiles: { fast: { endpoint: '', model: 'test', apiKey: '' }, quality: { endpoint: '', model: 'test', apiKey: '' } } };
// Like Rust since 0.1.8: canReplace is false until the second capture step (`capture-target`).
// The fixture's captures are anchored on a 1920 × 1040 screen unless a test says otherwise.
const capture = (id: string, text = 'Example selection'): Capture => ({ id, text, source: 'selection', canReplace: false, anchor: { x: 400, y: 300, width: 120, height: 18 }, screen: { width: 1920, height: 1040, scale: 1 } });
const calls: Array<{ command: string; args: Record<string, unknown> | undefined }> = [];
let request: TranslationRequest;
let currentCapture = capture('first');
let heldCopy = false;
let failSettings = new URLSearchParams(location.search).has('settingsError');
let connected = false;
let refuseShortcut = false;
let resolveCopy: (() => void) | undefined;
mockIPC((command, args) => {
  calls.push({ command, args });
  if (command === 'get_settings') { if (failSettings) { return Promise.reject('Synthetic settings failure'); } return settings; }
  if (command === 'get_history') return [];
  if (command === 'save_settings') { const next = args?.settings as Settings; if (refuseShortcut && next.shortcut !== settings.shortcut) return Promise.reject('Le raccourci est déjà utilisé ou indisponible.'); settings = next; return; }
  if (command === 'check_connection') return { connected, message: connected ? 'Modèle trouvé.' : 'Serveur indisponible.' };
  if (command === 'frontend_ready') return currentCapture;
  if (command === 'translate') request = args?.request as TranslationRequest;
  if (command === 'start_drag') return Promise.reject('Synthetic drag failure');
  if (command === 'dismiss_overlay') return emit('overlay-dismiss-requested', { captureId: currentCapture.id });
  if (command === 'copy_result' && heldCopy) return new Promise<void>(resolve => { resolveCopy = resolve; });
}, { shouldMockEvents: true });
mockWindows('overlay');

Object.assign(window, { nativeFixture: {
  calls,
  recoverSettings: () => { failSettings = false; },
  connect: () => { connected = true; },
  refuseShortcut: () => { refuseShortcut = true; },
  error: () => emit('translation', { requestId: request.id, kind: 'error', message: 'Serveur indisponible.' }),
  capture: (id: string, text?: string) => { currentCapture = capture(id, text); return emit('capture', currentCapture); },
  delta: (text: string, requestId = request.id) => emit('translation', { requestId, kind: 'delta', text }),
  done: () => emit('translation', { requestId: request.id, kind: 'done' }),
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
  replay: (id: string) => { currentCapture = { ...capture(id, 'Example selection'), source: 'clipboard', canReplace: false, anchor: null, replay: { requestId: `replay-${id}`, translatedText: 'Exemple de sélection', mode: 'quality', targetLanguage: 'fr' } }; return emit('capture', currentCapture); },
} });
await import('../src/main');
