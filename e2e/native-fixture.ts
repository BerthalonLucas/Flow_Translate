// Browser-only IPC fixture. This does not launch a native window or read user data.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import type { Capture, Settings, TranslationRequest } from '../src/types';

const settings: Settings = { targetLanguage: 'fr', mode: 'quality', shortcut: 'Ctrl+Alt+T', historyEnabled: false, autostart: false,
  profiles: { fast: { endpoint: '', model: 'test', apiKey: '' }, quality: { endpoint: '', model: 'test', apiKey: '' } } };
const capture = (id: string, text = 'Example selection'): Capture => ({ id, text, source: 'selection', canReplace: true, anchor: null });
const calls: Array<{ command: string; args: Record<string, unknown> | undefined }> = [];
let request: TranslationRequest;
let currentCapture = capture('first');
let heldCopy = false;
let resolveCopy: (() => void) | undefined;
mockIPC((command, args) => {
  calls.push({ command, args });
  if (command === 'get_settings') return settings;
  if (command === 'frontend_ready') return currentCapture;
  if (command === 'translate') request = args?.request as TranslationRequest;
  if (command === 'start_drag') return Promise.reject('Synthetic drag failure');
  if (command === 'dismiss_overlay') return emit('overlay-dismiss-requested', { captureId: currentCapture.id });
  if (command === 'copy_result' && heldCopy) return new Promise<void>(resolve => { resolveCopy = resolve; });
}, { shouldMockEvents: true });
mockWindows('overlay');

Object.assign(window, { nativeFixture: {
  calls,
  capture: (id: string, text?: string) => { currentCapture = capture(id, text); return emit('capture', currentCapture); },
  delta: (text: string, requestId = request.id) => emit('translation', { requestId, kind: 'delta', text }),
  done: () => emit('translation', { requestId: request.id, kind: 'done' }),
  dismissEvent: (captureId: string) => emit('overlay-dismiss-requested', { captureId }),
  requestId: () => request.id,
  holdCopy: () => { heldCopy = true; },
  releaseCopy: () => { resolveCopy?.(); heldCopy = false; },
} });
await import('../src/main');
