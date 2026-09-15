use crate::actions::{ActionDefinition, ExecutionInfo, ShortcutBinding};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Fast,
    Quality,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Fr,
    En,
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
            shortcut_bindings: crate::actions::default_bindings("Ctrl+Alt+T".into()),
            default_action_id: "translate-fr".into(),
            history_enabled: false,
            autostart: false,
            connection_expanded: false,
            text_size: TextSize::Normal,
            auto_close: AutoClose::Normal,
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

