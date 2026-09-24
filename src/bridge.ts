import { defaultActionId, defaultActions, defaultBindings, defaultMenuActionIds, instructionActionId, instructionActionName, instructionError } from './actionDefaults';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import type { Capture, ConnectionStatus, ExecutionInfo, HighlightResult, HistoryEntry, Mode, OverlayGeometry, PillTarget, Rect, Refusal, Screen, Settings, SettingsField, ShortcutConflict, ShortcutStatus, StreamEvent, SystemMotion, TextRange, TranslationRequest, UndoOutcome } from './types';

type Unlisten = () => void;
type EventName = 'capture' | 'translation' | 'settings-changed' | 'target-invalidated' | 'overlay-dismiss-requested' | 'glass-near' | 'capture-target' | 'capture-notice' | 'work-area' | 'result-delivery' | 'system-theme' | 'system-motion' | 'menu-key' | 'menu-repeat' | 'settings-focus-field' | 'halo' | 'shortcut-status' | 'undo-state';
type Handler<T> = (payload: T) => void;

const defaultSettings: Settings = {
  mode: 'quality', defaultActionId, actions: structuredClone(defaultActions), shortcutBindings: structuredClone(defaultBindings), historyEnabled: false, autostart: false, connectionExpanded: false, textSize: 'normal', autoClose: 'normal', uiVersion: 'ilot', language: 'en', theme: 'system', motion: 'system', motionPreset: 'smooth', indicator: 'perle', afterReplace: { check: true, undo: true, undoSeconds: 8, changedWords: true }, undoStrategy: 'keystroke', pillPlacement: 'below', glassMaterial: 'painted', menuActionIds: [...defaultMenuActionIds],
  profiles: { fast: { endpoint: '', model: 'tencent/Hy-MT2-1.8B', apiKey: '' }, quality: { endpoint: '', model: 'tencent/Hy-MT2-7B-FP8', apiKey: '' } }
};

const native = '__TAURI_INTERNALS__' in window;
let demoCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 830, y: 410, width: 360, height: 24 } };
type DemoScenario = 'normal' | 'error' | 'long' | 'very-long' | 'pending' | 'partial';
let demoScenario: DemoScenario = 'normal';
// The preview starts where the app does, in the Îlot (Rust's default since 0.5.0); `?ui=v4` asks
// for the 0.4 journey, as the tests and the lab's 0.4 states do.
let demoSettings: Settings = { ...structuredClone(defaultSettings), uiVersion: new URLSearchParams(location.search).get('ui') === 'v4' ? 'v4' : 'ilot' };
let activeTimer: number | undefined;
let activeDemoRequest: string | undefined;
let demoHistory: HistoryEntry[] = [{ id: 'demo-history', sourceText: 'Could you send the updated proposal?', translatedText: 'Pourriez-vous envoyer la proposition mise à jour ?', actionName: 'Traduire en français', mode: 'quality', createdAt: '2026-09-08T10:24:00Z' }];
const demoListeners = new Map<EventName, Set<(payload: never) => void>>();

function emit<T>(name: EventName, payload: T) { demoListeners.get(name)?.forEach(handler => handler(payload as never)); }
function demoTranslation(text: string, actionId: string) {
  const language = actionId.endsWith('-en') ? 'en' : 'fr';
  if (demoScenario === 'error') return null;
  if (demoScenario === 'long' || demoScenario === 'very-long') return ( 'Bonjour Alex,\n\nMerci pour votre retour sur la proposition. La nouvelle version reprend les points discutés lors de notre réunion : le calendrier de livraison, la répartition des responsabilités et les conditions de validation.\n\nPourriez-vous vérifier les montants et les dates avant jeudi ? Nous pourrons ensuite transmettre la version définitive à l’équipe. Le budget de 12 500 € reste inchangé et la première livraison est prévue le 15 octobre.\n\nVous trouverez également une synthèse des modifications et la liste des questions encore ouvertes. Je reste disponible pour en discuter demain matin.\n\nBonne journée,\nMarie').repeat(demoScenario === 'very-long' ? 8 : 1);
  if (text.includes('updated proposal')) return language === 'fr' ? 'Pourriez-vous envoyer la proposition mise à jour avant jeudi ?' : 'Could you send the updated proposal before Thursday?';
  if (text.includes('Je vous envoie')) return language === 'en' ? 'I am sending you the updated proposal.' : 'Je vous envoie la proposition mise à jour.';
  return language === 'fr' ? 'Voici une traduction de démonstration, prête à être relue.' : 'Here is a demo translation, ready for review.';
}

const azertyAltGr: Record<string, string> = { e: '€', '2': '~', '3': '#', '4': '{', '5': '[', '6': '|', '7': '`', '8': '\\', '9': '^', '0': '@', bracketleft: ']', equal: '}' };

// A `{message, code}` refusal (replace_result) read as its message, for the callers of 0.4.
function refusalMessage(reason: unknown): unknown {
  return typeof reason === 'object' && reason !== null && typeof (reason as Refusal).message === 'string' ? (reason as Refusal).message : reason;
}

async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (native) return tauriInvoke<T>(name, args);
  if (name === 'get_settings') return structuredClone(demoSettings) as T;
  if (name === 'save_settings') { demoSettings = structuredClone(args?.settings as Settings); emit('settings-changed', demoSettings); return undefined as T; }
  if (name === 'capture_text') return structuredClone(demoCapture) as T;
  if (name === 'frontend_ready') return null as T;
  if (name === 'check_connection') { await new Promise(resolve => window.setTimeout(resolve, 38)); return { connected: demoScenario !== 'error', message: demoScenario === 'error' ? 'Démo : serveur indisponible.' : 'Démo : connexion simulée.' } as T; }
  if (name === 'get_history') return structuredClone(demoHistory) as T;
  if (name === 'delete_history') { const id = args?.id as string | null; demoHistory = id === null ? [] : demoHistory.filter(item => item.id !== id); return undefined as T; }
  if (name === 'translate') {
    const request = args?.request as TranslationRequest;
    window.clearTimeout(activeTimer);
    activeDemoRequest = request.id;
    if (import.meta.env.DEV && demoScenario === 'pending') return undefined as T;
    if (import.meta.env.DEV && demoScenario === 'partial') {
      activeTimer = window.setTimeout(() => {
        if (activeDemoRequest !== request.id) return;
        emit<StreamEvent>('translation', { requestId: request.id, kind: 'delta', text: 'Pourriez-vous envoyer la proposition' });
        emit<StreamEvent>('translation', { requestId: request.id, kind: 'error', message: 'Réponse interrompue. Réessayez.' });
      }, 120);
      return undefined as T;
    }
    const translated = demoTranslation(request.text, request.actionId);
    if (!translated) { activeTimer = window.setTimeout(() => emit<StreamEvent>('translation', { requestId: request.id, kind: 'error', message: 'Démo : le serveur est indisponible.' }), 260); return undefined as T; }
    let i = 0;
    const tick = () => {
      if (activeDemoRequest !== request.id) return;
      if (i < translated.length) { emit<StreamEvent>('translation', { requestId: request.id, kind: 'delta', text: translated.slice(i, i += demoScenario === 'very-long' ? 180 : demoScenario === 'long' ? 28 : 5) }); activeTimer = window.setTimeout(tick, 45); }
      else emit<StreamEvent>('translation', { requestId: request.id, kind: 'done' });
    };
    activeTimer = window.setTimeout(tick, 120); return undefined as T;
  }
  // The Îlot in the preview: the page has the keyboard, a choice runs the demo translation.
  if (name === 'focus_overlay') return true as T;
  if (name === 'choose_action') {
    const actionId = args?.actionId as string;
    const instruction = args?.instruction as string | undefined;
    if (instruction !== undefined) {
      const error = actionId === instructionActionId ? instructionError(instruction) : 'La consigne libre ne correspond pas à l’action demandée.';
      if (error) throw error;
      return { actionId, actionName: instructionActionName, outputMode: 'replace', mode: demoSettings.mode } as T;
    }
    const action = demoSettings.actions.find(item => item.id === actionId);
    if (!action) throw 'L’action n’existe plus.';
    return { actionId, actionName: action.name, outputMode: 'replace', mode: demoSettings.mode } satisfies ExecutionInfo as T;
  }
  // The preview has no keyboard layout to ask: it answers for French AZERTY, the layout
  // the AltGr warning matters most for (Ctrl+Alt+E types €, Ctrl+Alt+0 types @).
  if (name === 'shortcut_conflict') {
    const parts = String(args?.shortcut ?? '').split('+').map(part => part.trim().toLowerCase());
    const key = parts.at(-1)?.replace(/^(key|digit)/, '') ?? '';
    const character = parts.includes('ctrl') && parts.includes('alt') && !parts.includes('shift') ? azertyAltGr[key] : undefined;
    return (character ? { altGr: true, character } : { altGr: false }) satisfies ShortcutConflict as T;
  }
  // Lot 10: the preview registers every enabled chord.
  if (name === 'shortcut_status') return demoSettings.shortcutBindings.map(b => ({ bindingId: b.id, shortcut: b.shortcut, state: b.enabled ? 'registered' : 'disabled' })) satisfies ShortcutStatus[] as T;
  if (name === 'dismiss_overlay') { activeDemoRequest = undefined; window.clearTimeout(activeTimer); emit('overlay-dismiss-requested', { captureId: demoCapture.id }); return undefined as T; }
  if (name === 'cancel_translation') { activeDemoRequest = undefined; window.clearTimeout(activeTimer); return undefined as T; }
  // Lot 9: the preview pastes nothing, so there is no text to stand under or to mark; Undo has nothing to read back.
  if (name === 'result_pill') throw 'Aperçu : aucun texte collé.';
  if (name === 'highlight_changes') return { ranges: 0, lines: 0 } satisfies HighlightResult as T;
  if (name === 'undo_result') return { requestId: String(args?.requestId ?? ''), status: 'undone', confirmed: false, message: 'Démo : remplacement annulé.' } satisfies UndoOutcome as T;
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
    location.assign('/');
  },
  resizeSettingsCorner: async () => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().startResizeDragging('SouthEast'); }
  },
  // The settings window's title bar text (taskbar, Alt+Tab) follows the interface language.
  setSettingsTitle: async (title: string) => {
    if (native) { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().setTitle(title); }
    else document.title = title;
  },
  dragSettings: () => command<void>('drag_settings'),
  quit: () => command<void>('quit_app'),
  translate: (request: TranslationRequest) => command<void>('translate', { request }),
  cancel: (requestId: string) => command<void>('cancel_translation', { requestId }),
  copy: (requestId: string) => command<void>('copy_result', { requestId }),
  replace: (requestId: string) => command<void>('replace_result', { requestId }).catch((reason: unknown) => { throw refusalMessage(reason); }),
  dismiss: () => command<void>('dismiss_overlay'),
  completeDismiss: (captureId: string) => command<void>('complete_overlay_dismiss', { captureId }),
  // field (lot 10): the Settings open on that field (Rust's side comes with lot 10).
  openSettings: async (field?: SettingsField) => {
    if (native) return command<void>('open_settings', field ? { field } : undefined);
    location.assign(`?window=settings&demo=1${field ? `&field=${encodeURIComponent(field)}` : ''}`);
  },
  // Îlot (lots 3–4): true when the overlay really holds the foreground; false leaves the
  // menu to the native keyboard fallback (`menu-key` events, no free field).
  focusOverlay: () => command<boolean>('focus_overlay'),
  // Once per menu capture: a saved action, or `instructionActionId` with the free instruction.
  chooseAction: (captureId: string, actionId: string, instruction?: string) => command<ExecutionInfo>('choose_action', { captureId, actionId, ...(instruction === undefined ? {} : { instruction }) }),
  // Where Rust put the overlay (physical pixels of the virtual screen, like a capture's anchor),
  // so the Îlot knows on which side of the selection it opened; null outside the native app.
  windowPosition: async (): Promise<{ x: number; y: number } | null> => {
    if (!native) return null;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const position = await getCurrentWindow().innerPosition();
    return { x: position.x, y: position.y };
  },
  // The work area (physical pixels) of the screen holding a point: Rust places a capture on the
  // screen of its anchor's centre (host::monitor_at, rcWork), the Îlot keeps its widest shape on
  // it (src/layout.ts ilotShift). null outside the native app, or off every screen.
  workAreaAt: async (x: number, y: number): Promise<Rect | null> => {
    if (!native) return null;
    const { monitorFromPoint } = await import('@tauri-apps/api/window');
    const monitor = await monitorFromPoint(x, y);
    if (!monitor) return null;
    const { position, size } = monitor.workArea;
    return { x: position.x, y: position.y, width: size.width, height: size.height };
  },
  // Lot 4, for the shortcut recorder (wired in lot 13): is this chord AltGr + a key here?
  shortcutConflict: (shortcut: string) => command<ShortcutConflict>('shortcut_conflict', { shortcut }),
  startDrag: (clientX: number, clientY: number) => command<void>('start_drag', { clientX, clientY }),
  resize: (width: number, height: number, geometry: OverlayGeometry) => command<void>('resize_overlay', { width, height, ...geometry }),
  // The reading budget is spent: Rust frees Escape while the glass dims; an approach re-arms it.
  dimming: (dimming: boolean) => command<void>('overlay_dimming', { dimming }),
  checkConnection: (mode: Mode) => command<ConnectionStatus>('check_connection', { mode }),
  getHistory: () => command<HistoryEntry[]>('get_history'),
  deleteHistory: (id: string | null) => command<void>('delete_history', { id }),
  // The Windows app mode read by Rust (null when unknown, or outside the native app).
  systemTheme: () => native ? command<unknown>('system_theme').catch(() => null) : Promise.resolve(null),
  // Whether Windows asks to reduce animations (Rust reads SPI_GETCLIENTAREAANIMATION); null or
  // undefined when unknown, always unknown in the browser preview.
  systemMotion: () => command<SystemMotion | null | undefined>('system_motion'),
  on: event,
  setDemoCapture: (capture: Capture, scenario: DemoScenario = 'normal') => { demoCapture = capture; demoScenario = scenario; },
  // Browser preview only: what Rust emits when the shortcut finds nothing to translate.
  demoNotice: (message: string) => { if (!native) emit('capture-notice', { message }); },
  // Browser preview only: what Rust emits when the cursor changes screen under a bottom form.
  demoWorkArea: (screen: Screen) => { if (!native) emit('work-area', screen); },
  // Lot 10: the state of every binding (a chord another application holds is 'taken').
  shortcutStatus: () => command<ShortcutStatus[]>('shortcut_status'),
  // Lot 9, after a paste under the Îlot (docs/BRIDGE.md « the result »): where the pill goes for a
  // pill of this size; moving the window by (dx, dy) logical pixels at a moment nothing animates;
  // the changed words marked in the halo until clearHighlight.
  resultPill: (requestId: string, width: number, height: number) => command<PillTarget>('result_pill', { requestId, width, height }),
  moveOverlay: (captureId: string, dx: number, dy: number) => command<void>('move_overlay', { captureId, dx, dy }),
  highlightChanges: (requestId: string, ranges: TextRange[]) => command<HighlightResult>('highlight_changes', { requestId, ranges }),
  clearHighlight: (requestId: string) => command<void>('clear_highlight', { requestId }),
  // Lot 9: undo a pasted result, once, after revalidation (`undo_result` → UndoOutcome). Read its
  // status: a resolved promise may be a refusal (`refused`: nothing was sent; `failed`: sent, the
  // original did not read back); a rejection is a French string (the result no longer current).
  undoResult: (requestId: string) => command<UndoOutcome>('undo_result', { requestId }),
  // `replace_result` with its refusal as Rust sends it, `{message, code}` (Refusal): the code says
  // why (target_changed, keys_held, not_editable, paste_blocked); `replace` keeps the message only,
  // for the glass of 0.4. The Îlot's own paste of a retried result reads the code (IlotStage).
  replaceResult: (requestId: string) => command<void>('replace_result', { requestId }),
};

