export type Mode = 'fast' | 'quality';
export type Language = 'fr' | 'en';
export type Rect = { x: number; y: number; width: number; height: number };
export type Capture = { id: string; text: string; source: 'selection' | 'clipboard'; canReplace: boolean; anchor: Rect | null };
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
