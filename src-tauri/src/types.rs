use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode { Fast, Quality }

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language { Fr, En }

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rect { pub x: f64, pub y: f64, pub width: f64, pub height: f64 }

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Capture {
    pub id: String,
    pub text: String,
    pub source: CaptureSource,
    pub can_replace: bool,
    pub anchor: Option<Rect>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CaptureSource { Selection, Clipboard }

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Profile { pub endpoint: String, pub model: String, pub api_key: String }

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub target_language: Language,
    pub mode: Mode,
    pub shortcut: String,
    pub history_enabled: bool,
    pub autostart: bool,
    pub profiles: HashMap<String, Profile>,
}

impl Default for Settings {
    fn default() -> Self {
        let mut profiles = HashMap::new();
        profiles.insert("fast".into(), Profile {
            endpoint: "http://127.0.0.1:8001/v1".into(),
            model: "flowtranslate-fast".into(),
            api_key: String::new(),
        });
        profiles.insert("quality".into(), Profile {
            endpoint: "http://127.0.0.1:8002/v1".into(),
            model: "flowtranslate-quality".into(),
            api_key: String::new(),
        });
        Self {
            target_language: Language::Fr,
            mode: Mode::Quality,
            shortcut: "Ctrl+Alt+T".into(),
            history_enabled: false,
            autostart: false,
            profiles,
        }
    }
}

impl Settings {
    pub fn profile(&self, mode: Mode) -> Result<&Profile, String> {
        let key = match mode { Mode::Fast => "fast", Mode::Quality => "quality" };
        self.profiles.get(key).ok_or_else(|| format!("Le profil {key} est absent."))
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationRequest {
    pub id: String,
    pub capture_id: String,
    pub text: String,
    pub target_language: Language,
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
pub enum StreamKind { Delta, Done, Error }

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub source_text: String,
    pub translated_text: String,
    pub target_language: Language,
    pub mode: Mode,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus { pub connected: bool, pub message: String }

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetInvalidated {
    pub capture_id: String,
    pub anchor_lost: bool,
    pub message: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PlacementSide { Above, Below, Bottom }

#[derive(Clone, Debug)]
pub struct TargetIdentity {
    pub runtime_id: Vec<i32>,
    pub native_window: isize,
    pub selected_text: String,
    pub anchor: Option<Rect>,
    pub selection_start: Option<usize>,
    pub selection_len: usize,
    pub editable: bool,
}

#[derive(Clone, Debug)]
pub struct StoredCapture { pub public: Capture, pub target: Option<TargetIdentity> }

#[derive(Clone, Debug)]
pub struct CompletedResult {
    pub request_id: String,
    pub capture_id: String,
    pub source_text: String,
    pub translated_text: String,
    pub target_language: Language,
    pub mode: Mode,
    pub complete: bool,
}
