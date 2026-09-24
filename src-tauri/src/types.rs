use crate::actions::{ActionDefinition, ExecutionInfo, ShortcutBinding};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Fast,
    Quality,
}

/// The target language of 0.3.0 (read for the migration only) and, since the « Îlot »
/// art direction, the language of the interface: English by default, French on request.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Fr,
    #[default]
    En,
}

/// Réglages of the « Îlot » art direction (docs/DA-PLAN.md). The frontend owns their
/// effect; Rust only persists and validates them. Every field has a default so a 0.4
/// settings file loads unchanged.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

/// « Animations : suivre Windows / toujours / réduites ».
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MotionPreference {
    #[default]
    System,
    Full,
    Reduced,
}

/// Apple « smooth » (default) or « bouncy » springs.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MotionPreset {
    #[default]
    Smooth,
    Bouncy,
}

/// The orb of the waiting pill.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Indicator {
    #[default]
    Perle,
    Nebuleuse,
    Ruban,
}

/// How Undo reverts a replacement: Ctrl+Z sent to the source (option A, default) or the
/// original pasted back over the new text (option B). Both revalidate the target first.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UndoStrategy {
    #[default]
    Keystroke,
    Repaste,
}

/// Where the pill rests after a replacement: under the new text, or in the margin.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PillPlacement {
    #[default]
    Below,
    Margin,
}

/// Hidden trial (lot 12, phase B): `painted` glass (default) or real Windows Acrylic.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GlassMaterial {
    #[default]
    Painted,
    Acrylic,
}

/// What follows a replacement: the drawn check, Undo with its countdown, the changed
/// words highlighted while Undo lasts. Each can be switched off.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterReplace {
    pub check: bool,
    pub undo: bool,
    pub undo_seconds: u32,
    pub changed_words: bool,
}

impl Default for AfterReplace {
    fn default() -> Self {
        Self { check: true, undo: true, undo_seconds: 8, changed_words: true }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Where the window lives (2026-09-14, calibrated reading): `anchored` beside the
/// selection (the waiting pill and the short glass), `bottom` centred on the bottom of
/// the cursor's screen (the reader band, and every capture without an anchor).
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Presentation {
    Anchored,
    Bottom,
}

/// The work area of the screen a window is on, in logical pixels, with its DPI scale:
/// the frontend sizes the reader band from it (half the width, at most 45 % of the
/// height), never from a hard-coded resolution.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Screen {
    pub width: f64,
    pub height: f64,
    pub scale: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub radius: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayDismissRequested {
    pub capture_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Capture {
    pub id: String,
    pub text: String,
    pub source: CaptureSource,
    /// How the text was obtained; shown nowhere, read by the real capture matrix.
    pub origin: CaptureOrigin,
    pub can_replace: bool,
    pub anchor: Option<Rect>,
    /// The screen the capture opens on (its selection's, or the cursor's).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub screen: Option<Screen>,
    /// A result shown again (tray « Revoir la dernière traduction »): the frontend
    /// displays it as complete instead of asking for a translation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replay: Option<Replay>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution: Option<ExecutionInfo>,
    /// A capture of a `menu` shortcut under the Îlot (lot 3): no execution until
    /// `choose_action`; the frontend opens the menu instead of translating.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub menu: Option<MenuInfo>,
}

/// What the Îlot needs to open: the last action chosen in the source application
/// (lot 4, null when none is remembered or it no longer exists). Never any text.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MenuInfo {
    pub last_action_id: Option<String>,
}

/// A menu key the hook took from the source window (the overlay could not hold the
/// foreground): `key` as `KeyboardEvent.key`, `shiftKey` for Shift+Tab.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuKeyEvent {
    pub capture_id: String,
    pub key: String,
    pub shift_key: bool,
}

/// A second press of the same menu shortcut within 400 ms while its menu waits (lot 4):
/// the frontend runs the last action of that application at once.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuRepeatEvent {
    pub capture_id: String,
}

/// Whether a shortcut is also AltGr + a key on the active layout, and what it types.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConflict {
    pub alt_gr: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Replay {
    pub request_id: String,
    pub translated_text: String,
    pub mode: Mode,
}

/// Whether the capture can still be pasted over: false once a paste was attempted (a
/// result is delivered once) or the selection was lost.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureTarget {
    pub capture_id: String,
    pub can_replace: bool,
}

/// A short message in place of the old MessageBox: shown in the glass when one is open,
/// otherwise as a pill alone at the bottom of the cursor's screen.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureNotice {
    pub message: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CaptureSource {
    Selection,
    Clipboard,
}

/// uia: the UI Automation selection; copy: the synthetic Ctrl+Insert; fresh: a copy the
/// user made less than three seconds before; replay: the tray; demo: `--demo*`.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CaptureOrigin {
    Uia,
    Copy,
    Fresh,
    Replay,
    Demo,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub endpoint: String,
    pub model: String,
    pub api_key: String,
}

/// Reading presets (2026-09-14): short glass 16/24 · reader 22/33, 18/27 · 24/36,
/// 20/30 · 26/39 (font size / line height, logical pixels). The frontend owns the values.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TextSize {
    #[default]
    Normal,
    Large,
    Xlarge,
}

/// How fast the glass leaves once read: the reading budget × 0.7, × 1, × 1.5, or never.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AutoClose {
    Fast,
    #[default]
    Normal,
    Slow,
    Never,
}

/// Hidden switch of the « Îlot » art direction (docs/DA-PLAN.md, lot 0): `v4` keeps the
/// 0.4 journey (a shortcut runs its action at once, the waiting pill, the glass),
/// `ilot` the new one (the menu beside the selection, the pill, the check and Undo). Not
/// shown in the settings window; kept while the migration lasts.
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UiVersion {
    #[default]
    V4,
    Ilot,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub mode: Mode,
    pub actions: Vec<ActionDefinition>,
    pub shortcut_bindings: Vec<ShortcutBinding>,
    pub default_action_id: String,
    pub history_enabled: bool,
    pub autostart: bool,
    #[serde(default)]
    pub connection_expanded: bool,
    #[serde(default)]
    pub text_size: TextSize,
    #[serde(default)]
    pub auto_close: AutoClose,
    #[serde(default)]
    pub ui_version: UiVersion,
    #[serde(default)]
    pub language: Language,
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub motion: MotionPreference,
    #[serde(default)]
    pub motion_preset: MotionPreset,
    #[serde(default)]
    pub indicator: Indicator,
    #[serde(default)]
    pub after_replace: AfterReplace,
    #[serde(default)]
    pub undo_strategy: UndoStrategy,
    #[serde(default)]
    pub pill_placement: PillPlacement,
    #[serde(default)]
    pub glass_material: GlassMaterial,
    /// The actions of the Îlot grid, in the user's order (six at most). Empty: the
    /// frontend shows the first actions of the list.
    #[serde(default)]
    pub menu_action_ids: Vec<String>,
    pub profiles: HashMap<String, Profile>,
}

impl Default for Settings {
    fn default() -> Self {
        let mut profiles = HashMap::new();
        profiles.insert(
            "fast".into(),
            Profile {
                endpoint: "http://127.0.0.1:8001/v1".into(),
                model: "flowtranslate-fast".into(),
                api_key: String::new(),
            },
        );
        profiles.insert(
            "quality".into(),
            Profile {
                endpoint: "http://127.0.0.1:8002/v1".into(),
                model: "flowtranslate-quality".into(),
                api_key: String::new(),
            },
        );
        Self {
            mode: Mode::Quality,
            actions: crate::actions::defaults(),
            shortcut_bindings: crate::actions::default_bindings(),
            default_action_id: crate::actions::DEFAULT_ACTION_ID.into(),
            history_enabled: false,
            autostart: false,
            connection_expanded: false,
            text_size: TextSize::Normal,
            auto_close: AutoClose::Normal,
            ui_version: UiVersion::default(),
            language: Language::default(),
            theme: Theme::default(),
            motion: MotionPreference::default(),
            motion_preset: MotionPreset::default(),
            indicator: Indicator::default(),
            after_replace: AfterReplace::default(),
            undo_strategy: UndoStrategy::default(),
            pill_placement: PillPlacement::default(),
            glass_material: GlassMaterial::default(),
            menu_action_ids: crate::actions::default_menu_action_ids(),
            profiles,
        }
    }
}

impl Settings {
    pub fn profile(&self, mode: Mode) -> Result<&Profile, String> {
        let key = match mode {
            Mode::Fast => "fast",
            Mode::Quality => "quality",
        };
        self.profiles
            .get(key)
            .ok_or_else(|| format!("Le profil {key} est absent."))
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationRequest {
    pub action_id: String,
    pub id: String,
    pub capture_id: String,
    pub text: String,
    pub mode: Mode,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamEvent {
    pub request_id: String,
    pub kind: StreamKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StreamKind {
    Delta,
    Done,
    Error,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub source_text: String,
    pub translated_text: String,
    /// The action that produced the entry (« Traduire » for rows older than 0.4.0).
    pub action_name: String,
    pub mode: Mode,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    pub connected: bool,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetInvalidated {
    pub capture_id: String,
    pub anchor_lost: bool,
    pub message: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PlacementSide {
    Above,
    Below,
}

/// Where the selection lives, kept in Rust only: the source window, its focused control
/// and, when UI Automation gave the selection, the element it came from. The paste of
/// 0.4.0 checks that identity again just before the chord; the text serves the watcher
/// and the confirmation, never a log.
#[derive(Clone, Debug)]
pub struct TargetIdentity {
    pub runtime_id: Option<Vec<i32>>,
    pub native_window: isize,
    pub control: isize,
    pub selected_text: String,
    pub anchor: Option<Rect>,
    pub selection_len: usize,
    pub editable: bool,
}

#[derive(Clone, Debug)]
pub struct StoredCapture {
    pub public: Capture,
    pub target: Option<TargetIdentity>,
}

#[derive(Clone, Debug)]
pub struct CompletedResult {
    pub execution: Option<ExecutionInfo>,
    pub request_id: String,
    pub capture_id: String,
    pub source_text: String,
    pub translated_text: String,
    pub mode: Mode,
    pub complete: bool,
}

