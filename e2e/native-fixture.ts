// Browser-only IPC fixture. This does not launch a native window or read user data.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import type { Capture, Settings, TranslationRequest } from '../src/types';

const settings: Settings = { targetLanguage: 'fr', mode: 'quality', shortcut: 'Ctrl+Alt+T', historyEnabled: false, autostart: false,
  profiles: { fast: { endpoint: '', model: 'test', apiKey: '' }, quality: { endpoint: '', model: 'test', apiKey: '' } } };
const capture = (id: string): Capture => ({ id, text: 'Example selection', source: 'selection', canReplace: true, anchor: null });
const calls: Array<{ command: string; args: Record<string, unknown> | undefined }> = [];
let request: TranslationRequest;
mockIPC((command, args) => {
  calls.push({ command, args });
  if (command === 'get_settings') return settings;
  if (command === 'frontend_ready') return capture('first');
  if (command === 'translate') request = args?.request as TranslationRequest;
  if (command === 'start_drag') return Promise.reject('Synthetic drag failure');
}, { shouldMockEvents: true });
mockWindows('overlay');

Object.assign(window, { nativeFixture: {
  calls,
  capture: (id: string) => emit('capture', capture(id)),
  delta: (text: string) => emit('translation', { requestId: request.id, kind: 'delta', text }),
  done: () => emit('translation', { requestId: request.id, kind: 'done' }),
} });
await import('../src/main');
