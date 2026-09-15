export type Mode = 'fast' | 'quality';
export type Language = 'fr' | 'en';
export type Rect = { x: number; y: number; width: number; height: number };
// The work area of the screen the capture opens on, logical pixels, with its DPI scale.
export type Screen = { width: number; height: number; scale: number };
// replay: a result shown again from the tray; the frontend displays it complete without translating.
export type Replay = { requestId: string; translatedText: string; mode: Mode; targetLanguage: Language };
// origin: how Rust obtained the text (uia selection, synthetic copy, fresh user copy, tray replay, demo); shown nowhere.
export type CaptureOrigin = 'uia' | 'copy' | 'fresh' | 'replay' | 'demo';
export type Capture = { id: string; text: string; source: 'selection' | 'clipboard'; origin?: CaptureOrigin; canReplace: boolean; anchor: Rect | null; screen?: Screen; replay?: Replay; execution?: ExecutionInfo };
// Second step of a capture: the document offsets and the Win32 control decide « Remplacer » behind the shown window.
export type CaptureTarget = { captureId: string; canReplace: boolean };
// A short message in place of the old MessageBox: a pill alone, or a line in the open glass.
export type CaptureNotice = { message: string };
export type Profile = { endpoint: string; model: string; apiKey: string };
// textSize: reading presets (16/24 · 22/33, 18/27 · 24/36, 20/30 · 26/39); autoClose: reading budget × 0.7, × 1, × 1.5, or never.
export type TextSize = 'normal' | 'large' | 'xlarge';
export type AutoClose = 'fast' | 'normal' | 'slow' | 'never';
export type Settings = { targetLanguage: Language; mode: Mode; actions: ActionDefinition[]; shortcutBindings: ShortcutBinding[]; defaultActionId: string; historyEnabled: boolean; autostart: boolean; connectionExpanded: boolean; textSize: TextSize; autoClose: AutoClose; profiles: Record<Mode, Profile> };
export type StreamEvent = { requestId: string; kind: 'delta' | 'done' | 'error'; text?: string; message?: string };
export type HistoryEntry = { id: string; sourceText: string; translatedText: string; targetLanguage: Language; mode: Mode; createdAt: string };
export type ConnectionStatus = { connected: boolean; message: string };
export type TranslationRequest = { actionId: string; id: string; captureId: string; text: string; targetLanguage: Language; mode: Mode };
// What the session shows: the waiting pill, the short glass beside the selection, or the reader band.
export type Form = 'pending' | 'short' | 'reader';
// Where the native window lives: beside the selection, or centred on the bottom of the cursor's screen.
export type Presentation = 'anchored' | 'bottom';
export type HitRegion = { x: number; y: number; width: number; height: number; radius: number };
// frame: the rectangle Rust anchors beside the selection (the glass footprint, present before the glass opens).
export type OverlayGeometry = { captureId: string; presentation: Presentation; regions: HitRegion[]; frame: HitRegion };


export type OutputMode = 'display' | 'replace';
export type ActionDefinition = { id: string; name: string; promptTemplate: string };
export type ShortcutBinding = { id: string; shortcut: string; actionId: string; outputMode: OutputMode; enabled: boolean };
export type ExecutionInfo = { actionId: string; actionName: string; outputMode: OutputMode; mode: Mode; targetLanguage: Language };
export type ResultDelivery = { requestId: string; status: 'applied' | 'fallback'; message: string };
