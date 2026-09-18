import { defaultActions, defaultBindings } from '../src/actionDefaults';
// Browser-only IPC fixture for the settings window. It launches no native window and reads no user
// data. The overlay keeps its own fixture (`e2e/native-fixture.ts`).
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import { endpointError } from '../src/bridge';
import type { HistoryEntry, Settings, SettingsTarget } from '../src/types';

const params = new URLSearchParams(location.search);
let settings: Settings = {
  mode: 'quality', defaultActionId: 'translate-fr', actions: structuredClone(defaultActions),
  shortcutBindings: structuredClone(defaultBindings), historyEnabled: true, autostart: false,
  connectionExpanded: false, textSize: 'normal', autoClose: 'normal',
  profiles: { fast: { endpoint: 'http://127.0.0.1:8001/v1', model: 'test', apiKey: '' }, quality: { endpoint: 'http://127.0.0.1:8002/v1', model: 'test', apiKey: '' } },
};
const entry = (id: string, translatedText: string, actionName: string): HistoryEntry =>
  ({ id, sourceText: 'never shown', translatedText, actionName, mode: 'quality', createdAt: '2026-09-17T09:12:00Z' });
let history: HistoryEntry[] = [entry('h1', 'Pourriez-vous envoyer la proposition mise à jour ?', 'Traduire en français')];
const calls: Array<{ command: string; args: Record<string, unknown> | undefined }> = [];
let failSettings = params.has('settingsError');
let connected = false;
let refuseShortcut = false;
let failCopy = false;
// The native window hands its target over at mount: the event can arrive before the window exists.
let pendingTarget: SettingsTarget | null = params.has('target') ? { page: params.get('target') as SettingsTarget['page'], ...(params.get('targetEngine') ? { engine: params.get('targetEngine') as 'fast' | 'quality' } : {}), ...(params.get('targetReason') ? { reason: params.get('targetReason')! } : {}) } : null;
let startupNotice: string | null = params.has('startupNotice') ? 'Vos réglages étaient illisibles : la dernière sauvegarde est chargée.' : null;

mockIPC((command, args) => {
  calls.push({ command, args });
  if (command === 'get_settings') { if (failSettings) return Promise.reject('Synthetic settings failure'); return settings; }
  if (command === 'save_settings') {
    const next = args?.settings as Settings;
    if (refuseShortcut && JSON.stringify(next.shortcutBindings) !== JSON.stringify(settings.shortcutBindings)) return Promise.reject('Le raccourci est déjà utilisé ou indisponible.');
    settings = next; return;
  }
  if (command === 'get_history') return structuredClone(history);
  if (command === 'delete_history') { const id = args?.id as string | null; history = id === null ? [] : history.filter(item => item.id !== id); return; }
  if (command === 'copy_history') {
    if (failCopy) return Promise.reject('Copie indisponible. Réessayez.');
    if (!history.some(item => item.id === args?.id)) return Promise.reject('Copie indisponible. Réessayez.');
    return;
  }
  if (command === 'validate_endpoint') { const error = endpointError(args?.endpoint as string); return error ? Promise.reject(error) : undefined; }
  if (command === 'take_settings_target') { const target = pendingTarget; pendingTarget = null; return target; }
  if (command === 'take_startup_notice') { const notice = startupNotice; startupNotice = null; return notice; }
  if (command === 'check_connection') return { connected, message: connected ? 'Modèle trouvé.' : 'Le moteur Rapide ne répond pas. Vérifiez qu’il est démarré sur 127.0.0.1:8001.' };
}, { shouldMockEvents: true });
mockWindows('settings');

Object.assign(window, { settingsFixture: {
  calls,
  saved: () => calls.filter(call => call.command === 'save_settings').at(-1)?.args?.settings as Settings | undefined,
  saves: () => calls.filter(call => call.command === 'save_settings').length,
  recoverSettings: () => { failSettings = false; },
  connect: () => { connected = true; },
  refuseShortcut: () => { refuseShortcut = true; },
  breakCopy: () => { failCopy = true; },
  addHistory: (id: string, text: string, actionName = 'Corriger') => { history = [entry(id, text, actionName), ...history]; },
  // What Rust emits towards the settings window on every `open_settings`.
  open: (target: SettingsTarget) => emit('settings-target', target),
} });
await import('../src/main');
