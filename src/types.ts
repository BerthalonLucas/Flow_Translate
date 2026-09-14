export type Mode = 'fast' | 'quality';
export type Language = 'fr' | 'en';
export type Rect = { x: number; y: number; width: number; height: number };
// replay: a result shown again from the tray; the frontend displays it complete without translating.
export type Replay = { requestId: string; translatedText: string; mode: Mode; targetLanguage: Language };
// origin: how Rust obtained the text (uia selection, synthetic copy, fresh user copy, tray replay, demo); shown nowhere.
export type CaptureOrigin = 'uia' | 'copy' | 'fresh' | 'replay' | 'demo';
export type Capture = { id: string; text: string; source: 'selection' | 'clipboard'; origin?: CaptureOrigin; canReplace: boolean; anchor: Rect | null; replay?: Replay };
// Second step of a capture: the document offsets and the Win32 control decide « Remplacer » behind the shown window.
export type CaptureTarget = { captureId: string; canReplace: boolean };
// A short message in place of the old MessageBox: a pill alone, or a line in the open glass.
export type CaptureNotice = { message: string };
export type Profile = { endpoint: string; model: string; apiKey: string };
export type Settings = { targetLanguage: Language; mode: Mode; shortcut: string; historyEnabled: boolean; autostart: boolean; connectionExpanded: boolean; profiles: Record<Mode, Profile> };
export type StreamEvent = { requestId: string; kind: 'delta' | 'done' | 'error'; text?: string; message?: string };
export type HistoryEntry = { id: string; sourceText: string; translatedText: string; targetLanguage: Language; mode: Mode; createdAt: string };
export type ConnectionStatus = { connected: boolean; message: string };
export type TranslationRequest = { id: string; captureId: string; text: string; targetLanguage: Language; mode: Mode };
// 'docked': the window rests bottom-centre with the tab on its bottom edge.
export type Presentation = 'contextual' | 'reader' | 'docked';
export type HitRegion = { x: number; y: number; width: number; height: number; radius: number };
export type OverlayGeometry = { captureId: string; presentation: Presentation; regions: HitRegion[] };
