import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import type { Capture, ConnectionStatus, HistoryEntry, Mode, OverlayGeometry, Settings, StreamEvent, TranslationRequest } from './types';

type Unlisten = () => void;
type EventName = 'capture' | 'translation' | 'settings-changed' | 'target-invalidated' | 'overlay-dismiss-requested';
type Handler<T> = (payload: T) => void;

const defaultSettings: Settings = {
  targetLanguage: 'fr', mode: 'quality', shortcut: 'Ctrl+Alt+T', historyEnabled: false, autostart: false,
  profiles: { fast: { endpoint: '', model: 'tencent/Hy-MT2-1.8B', apiKey: '' }, quality: { endpoint: '', model: 'tencent/Hy-MT2-7B-FP8', apiKey: '' } }
};

const native = '__TAURI_INTERNALS__' in window;
let demoCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 830, y: 410, width: 360, height: 24 } };
let demoScenario: 'normal' | 'error' | 'long' | 'very-long' = 'normal';
let demoSettings = structuredClone(defaultSettings);
let activeTimer: number | undefined;
let activeDemoRequest: string | undefined;
let demoHistory: HistoryEntry[] = [{ id: 'demo-history', sourceText: 'Could you send the updated proposal?', translatedText: 'Pourriez-vous envoyer la proposition mise à jour ?', targetLanguage: 'fr', mode: 'quality', createdAt: '2026-09-08T10:24:00Z' }];
const demoListeners = new Map<EventName, Set<(payload: never) => void>>();

function emit<T>(name: EventName, payload: T) { demoListeners.get(name)?.forEach(handler => handler(payload as never)); }
function demoTranslation(text: string, language: 'fr' | 'en') {
  if (demoScenario === 'error') return null;
  if (demoScenario === 'long' || demoScenario === 'very-long') return ( 'Bonjour Alex,\n\nMerci pour votre retour sur la proposition. La nouvelle version reprend les points discutés lors de notre réunion : le calendrier de livraison, la répartition des responsabilités et les conditions de validation.\n\nPourriez-vous vérifier les montants et les dates avant jeudi ? Nous pourrons ensuite transmettre la version définitive à l’équipe. Le budget de 12 500 € reste inchangé et la première livraison est prévue le 15 octobre.\n\nVous trouverez également une synthèse des modifications et la liste des questions encore ouvertes. Je reste disponible pour en discuter demain matin.\n\nBonne journée,\nMarie').repeat(demoScenario === 'very-long' ? 8 : 1);
  if (text.includes('updated proposal')) return language === 'fr' ? 'Pourriez-vous envoyer la proposition mise à jour avant jeudi ?' : 'Could you send the updated proposal before Thursday?';
  if (text.includes('Je vous envoie')) return language === 'en' ? 'I am sending you the updated proposal.' : 'Je vous envoie la proposition mise à jour.';
  return language === 'fr' ? 'Voici une traduction de démonstration, prête à être relue.' : 'Here is a demo translation, ready for review.';
}

async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (native) return tauriInvoke<T>(name, args);
  if (name === 'get_settings') return structuredClone(demoSettings) as T;
  if (name === 'save_settings') { demoSettings = structuredClone(args?.settings as Settings); emit('settings-changed', demoSettings); return undefined as T; }
  if (name === 'capture_text') return structuredClone(demoCapture) as T;
  if (name === 'frontend_ready') return null as T;
  if (name === 'check_connection') return { connected: demoScenario !== 'error', message: demoScenario === 'error' ? 'Démo : serveur indisponible.' : 'Démo : connexion simulée.' } as T;
  if (name === 'get_history') return structuredClone(demoHistory) as T;
  if (name === 'delete_history') { const id = args?.id as string | null; demoHistory = id === null ? [] : demoHistory.filter(item => item.id !== id); return undefined as T; }
  if (name === 'translate') {
    const request = args?.request as TranslationRequest;
    window.clearTimeout(activeTimer);
    activeDemoRequest = request.id;
    const translated = demoTranslation(request.text, request.targetLanguage);
    if (!translated) { activeTimer = window.setTimeout(() => emit<StreamEvent>('translation', { requestId: request.id, kind: 'error', message: 'Démo : le serveur est indisponible.' }), 260); return undefined as T; }
    let i = 0;
    const tick = () => {
      if (activeDemoRequest !== request.id) return;
      if (i < translated.length) { emit<StreamEvent>('translation', { requestId: request.id, kind: 'delta', text: translated.slice(i, i += demoScenario === 'very-long' ? 180 : demoScenario === 'long' ? 28 : 5) }); activeTimer = window.setTimeout(tick, 45); }
      else emit<StreamEvent>('translation', { requestId: request.id, kind: 'done' });
    };
    activeTimer = window.setTimeout(tick, 120); return undefined as T;
  }
  if (name === 'dismiss_overlay') { activeDemoRequest = undefined; window.clearTimeout(activeTimer); emit('overlay-dismiss-requested', { captureId: demoCapture.id }); return undefined as T; }
  if (name === 'cancel_translation') { activeDemoRequest = undefined; window.clearTimeout(activeTimer); return undefined as T; }
  return undefined as T;
}

async function event<T>(name: EventName, handler: Handler<T>): Promise<Unlisten> {
  if (native) return tauriListen<T>(name, e => handler(e.payload));
  const set = demoListeners.get(name) ?? new Set();
  set.add(handler as (payload: never) => void); demoListeners.set(name, set);
  return () => set.delete(handler as (payload: never) => void);
}

export const bridge = {
  native,
  getSettings: () => command<Settings>('get_settings'),
  saveSettings: (settings: Settings) => command<void>('save_settings', { settings }),
  captureText: () => command<Capture>('capture_text'),
  frontendReady: () => command<Capture | null>('frontend_ready'),
  closeSettings: async () => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); return getCurrentWindow().close(); }
    history.back();
  },
  translate: (request: TranslationRequest) => command<void>('translate', { request }),
  cancel: (requestId: string) => command<void>('cancel_translation', { requestId }),
  copy: (requestId: string) => command<void>('copy_result', { requestId }),
  replace: (requestId: string) => command<void>('replace_result', { requestId }),
  dismiss: () => command<void>('dismiss_overlay'),
  completeDismiss: (captureId: string) => command<void>('complete_overlay_dismiss', { captureId }),
  openSettings: () => command<void>('open_settings'),
  focusOverlay: () => command<void>('focus_overlay'),
  startDrag: (clientX: number, clientY: number) => command<void>('start_drag', { clientX, clientY }),
  resize: (width: number, height: number, geometry: OverlayGeometry) => command<void>('resize_overlay', { width, height, ...geometry }),
  checkConnection: (mode: Mode) => command<ConnectionStatus>('check_connection', { mode }),
  getHistory: () => command<HistoryEntry[]>('get_history'),
  deleteHistory: (id: string | null) => command<void>('delete_history', { id }),
  on: event,
  setDemoCapture: (capture: Capture, scenario: 'normal' | 'error' | 'long' | 'very-long' = 'normal') => { demoCapture = capture; demoScenario = scenario; }
};
