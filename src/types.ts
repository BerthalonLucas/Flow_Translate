export type Mode = 'fast' | 'quality';
export type Language = 'fr' | 'en';
export type Rect = { x: number; y: number; width: number; height: number };
// The interface language since the Îlot art direction (English by default).
// The work area of the screen the capture opens on, logical pixels, with its DPI scale.
export type Screen = { width: number; height: number; scale: number };
// replay: a result shown again from the tray; the frontend displays it complete without translating.
export type Replay = { requestId: string; translatedText: string; mode: Mode };
// origin: how Rust obtained the text (uia selection, synthetic copy, fresh user copy, tray replay, demo); shown nowhere.
export type CaptureOrigin = 'uia' | 'copy' | 'fresh' | 'replay' | 'demo';
// menu: a `menu` shortcut under the Îlot (uiVersion 'ilot'): no execution until `choose_action`, the frontend opens the menu.
// The halo window (lot 6, « mise en valeur »): logical pixels relative to the window (width × height). menu: the selection at three levels (textBox, full lines, lines = exact text), still; work: the reflection over the exact text and the aurora around the text box, after 250 ms unless a menu was shown; marks: a wave over the new text (whole), then the changed words (lines), held; leave fades, clear removes. tone and ground come from the colour read under the text (null: the app's theme).
export type HaloPhase = 'menu' | 'work' | 'marks' | 'leave' | 'clear';
export type HaloTone = 'light' | 'dark';
export type HaloEvent = { generation: number; phase: HaloPhase; lines: Rect[]; full?: Rect[]; textBox?: Rect | null; whole?: Rect[]; tone?: HaloTone | null; ground?: [number, number, number] | null; width: number; height: number };
// selectionRects: the lines of a UI Automation selection, physical screen pixels like anchor (lot 5); Rust places from them, the frontend never does.
export type Capture = { id: string; text: string; source: 'selection' | 'clipboard'; origin?: CaptureOrigin; canReplace: boolean; anchor: Rect | null; selectionRects?: Rect[]; screen?: Screen; replay?: Replay; execution?: ExecutionInfo; menu?: MenuInfo };
// lastActionId: the last action chosen in the source application (null: none remembered). Never any text.
export type MenuInfo = { lastActionId: string | null };
// A menu key the native hook took from the source window (the overlay could not hold the foreground): KeyboardEvent.key naming.
export type MenuKey = { captureId: string; key: string; shiftKey: boolean };
// `menu-repeat`: the menu shortcut pressed twice within 400 ms while its menu waits (lot 4).
export type MenuRepeat = { captureId: string };
// `shortcut_conflict`: the chord is also AltGr + a key on the active layout, typing `character`.
export type ShortcutConflict = { altGr: boolean; character?: string };
// Second step of a capture: the document offsets and the Win32 control decide « Remplacer » behind the shown window.
export type CaptureTarget = { captureId: string; canReplace: boolean };
// A short message in place of the old MessageBox: a pill alone, or a line in the open glass.
export type CaptureNotice = { message: string; code?: ErrorCode };
export type Profile = { endpoint: string; model: string; apiKey: string };
// textSize: reading presets (16/24 · 22/33, 18/27 · 24/36, 20/30 · 26/39); autoClose: reading budget × 0.7, × 1, × 1.5, or never.
export type TextSize = 'normal' | 'large' | 'xlarge';
export type AutoClose = 'fast' | 'normal' | 'slow' | 'never';
// Hidden switch of the « Îlot » art direction (docs/DA-PLAN.md, lot 0): v4 keeps the 0.4
// journey, ilot the menu beside the selection. Not shown in the settings window.
export type UiVersion = 'v4' | 'ilot';
// Réglages of the Îlot art direction (docs/DA-PLAN.md); Rust persists and validates them.
export type Theme = 'system' | 'light' | 'dark';
export type MotionPreference = 'system' | 'full' | 'reduced';
// Rust's reading of « Effets d'animation » (command system_motion, event system-motion).
export type SystemMotion = { reduced: boolean };
export type MotionPreset = 'smooth' | 'bouncy';
export type Indicator = 'perle' | 'nebuleuse' | 'ruban';
// Undo: Ctrl+Z sent to the source (option A) or the original pasted back (option B).
export type UndoStrategy = 'keystroke' | 'repaste';
export type PillPlacement = 'below' | 'margin';
// Hidden trial of lot 12 (phase B): real Windows Acrylic instead of the painted glass.
export type GlassMaterial = 'painted' | 'acrylic';
// undoSeconds: 2 to 20. changedWordsSeconds: 5 to 120, the longest the marks stay without an action in the text.
export type AfterReplace = { check: boolean; undo: boolean; undoSeconds: number; changedWords: boolean; changedWordsSeconds: number };
// 0.4.0: no target language any more; each action's instruction names its language.
export type Settings = { mode: Mode; actions: ActionDefinition[]; shortcutBindings: ShortcutBinding[]; defaultActionId: string; historyEnabled: boolean; autostart: boolean; connectionExpanded: boolean; textSize: TextSize; autoClose: AutoClose; uiVersion: UiVersion;
  language: Language; theme: Theme; motion: MotionPreference; motionPreset: MotionPreset; indicator: Indicator; afterReplace: AfterReplace;
  undoStrategy: UndoStrategy; pillPlacement: PillPlacement; glassMaterial: GlassMaterial; menuActionIds: string[]; profiles: Record<Mode, Profile> };
export type StreamEvent = { requestId: string; kind: 'delta' | 'done' | 'error'; text?: string; message?: string; code?: ErrorCode };
export type HistoryEntry = { id: string; sourceText: string; translatedText: string; actionName: string; mode: Mode; createdAt: string };
export type ConnectionStatus = { connected: boolean; message: string; code?: ErrorCode };
export type TranslationRequest = { actionId: string; id: string; captureId: string; text: string; mode: Mode };
// What the session shows: the waiting pill, the short glass beside the selection, or the reader band.
export type Form = 'pending' | 'short' | 'reader';
// Where the native window lives: beside the selection, or centred on the bottom of the cursor's screen.
export type Presentation = 'anchored' | 'bottom';
export type HitRegion = { x: number; y: number; width: number; height: number; radius: number };
// frame: the rectangle Rust anchors beside the selection (the glass footprint, present before the glass opens).
export type OverlayGeometry = { captureId: string; presentation: Presentation; regions: HitRegion[]; frame: HitRegion };


export type OutputMode = 'display' | 'replace';
// key: the letter that runs it from the Îlot; shortName: its tile label; icon: a Lucide name.
export type ActionDefinition = { id: string; name: string; promptTemplate: string; key?: string; shortName?: string; icon?: string };
// kind: one action at once (0.4), or the Îlot menu beside the selection. Absent means 'action'.
export type BindingKind = 'action' | 'menu';
export type ShortcutBinding = { id: string; kind?: BindingKind; shortcut: string; actionId: string; outputMode: OutputMode; enabled: boolean };
// A direct link to one field of the Settings window (lot 13, for the errors of lot 10): the
// `field=` parameter of its URL, or the `settings-focus-field` event while it is open. A bare
// profile field means the default profile's.
export type ProfileField = 'endpoint' | 'apiKey' | 'model';
export type SettingsField = 'menuShortcut' | ProfileField | `${Mode}.${ProfileField}`;
export type SettingsFocus = { field: SettingsField };
export type ExecutionInfo = { actionId: string; actionName: string; outputMode: OutputMode; mode: Mode };
// applied: the result was pasted over the selection (confirmed when the field read it back); fallback: it stays in the glass.
export type ResultDelivery = { requestId: string; status: 'applied' | 'fallback'; confirmed: boolean; message: string; code?: ErrorCode; pastedRects?: Rect[]; undoable?: boolean };
// Lot 10: what failed, beside the French message of 0.4 (translation error, result-delivery
// fallback, capture-notice, target-invalidated, check_connection, the refusals of replace_result
// and undo_result). The one list of the codes Rust sends (error.rs, in its order);
// src/result/errors.ts gives each its family, button and texts, and reads an unknown code as
// 'internal'. Never any text of the server or of the user. settings_open (a shortcut pressed
// while the Settings window is in front) and nothing_recent (the tray's « Revoir » with nothing
// recent) are capture notices since the review of da-ilot.
export const errorCodes = [
  'unreachable', 'timeout', 'unauthorized', 'model_not_found', 'bad_endpoint', 'busy', 'length', 'stream_broken',
  'paste_blocked', 'target_changed', 'not_editable', 'too_long', 'cancelled',
  'server_error', 'no_selection', 'protected_field', 'keys_held', 'settings_open', 'nothing_recent', 'internal',
] as const;
export type ErrorCode = typeof errorCodes[number];
// Lot 10: whether each binding's chord works (`shortcut_status`, event `shortcut-status`); taken: another application holds it.
export type BindingState = 'registered' | 'taken' | 'failed' | 'disabled';
export type ShortcutStatus = { bindingId: string; shortcut: string; state: BindingState };
// Lot 9, after a paste under the Îlot: where the pill goes (`result_pill`), logical pixels relative to
// the overlay window; inside false: `move_overlay` first. estimated: the pasted text was not found.
export type PillSide = 'below' | 'above' | 'margin';
export type PillTarget = { x: number; y: number; side: PillSide; inside: boolean; estimated: boolean; clear: boolean };
// Lot 9: the changed words, UTF-16 offsets of the result (end excluded), and what the halo drew of them.
export type TextRange = { start: number; end: number };
export type HighlightResult = { ranges: number; lines: number };
// Lot 9, `undo_result`: undone (confirmed when read back), refused (nothing sent), failed (sent, the original did not come back).
export type UndoStatus = 'undone' | 'refused' | 'failed';
export type UndoOutcome = { requestId: string; status: UndoStatus; confirmed: boolean; message: string; code?: ErrorCode };
// Lot 9, event `undo-state`: Undo withdrawn; typed: a key reached the source; undo_key: the user's own Ctrl+Z; caret_moved: the text is no longer before the caret.
export type UndoLoss = 'typed' | 'undo_key' | 'caret_moved';
export type UndoState = { requestId: string; available: false; reason: UndoLoss };
// Since the review of da-ilot, `replace_result` rejects with its code beside the French message of
// 0.4: target_changed, keys_held, not_editable, paste_blocked (bridge.replaceResult keeps it).
export type Refusal = { message: string; code: ErrorCode };
