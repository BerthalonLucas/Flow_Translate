use crate::actions::{self, ActionDefinition, ShortcutBinding};
use crate::{
    crypto,
    types::{Profile, Settings},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use url::Url;

#[derive(Clone)]
pub struct SettingsStore {
    path: PathBuf,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedSettings {
    /// Until 0.3.0 the target language was a setting; since 0.4.0 it lives in the
    /// instruction of each action. Read for the migration, never written again.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    target_language: Option<crate::types::Language>,
    mode: crate::types::Mode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    shortcut: Option<String>,
    #[serde(default)]
    actions: Option<Vec<ActionDefinition>>,
    #[serde(default)]
    shortcut_bindings: Option<Vec<ShortcutBinding>>,
    #[serde(default)]
    default_action_id: Option<String>,
    history_enabled: bool,
    autostart: bool,
    #[serde(default)]
    connection_expanded: bool,
    #[serde(default)]
    text_size: crate::types::TextSize,
    #[serde(default)]
    auto_close: crate::types::AutoClose,
    #[serde(default)]
    ui_version: crate::types::UiVersion,
    #[serde(default)]
    language: crate::types::Language,
    #[serde(default)]
    theme: crate::types::Theme,
    #[serde(default)]
    motion: crate::types::MotionPreference,
    #[serde(default)]
    motion_preset: crate::types::MotionPreset,
    #[serde(default)]
    indicator: crate::types::Indicator,
    #[serde(default)]
    after_replace: crate::types::AfterReplace,
    #[serde(default)]
    undo_strategy: crate::types::UndoStrategy,
    #[serde(default)]
    pill_placement: crate::types::PillPlacement,
    #[serde(default)]
    glass_material: crate::types::GlassMaterial,
    #[serde(default)]
    menu_action_ids: Vec<String>,
    profiles: HashMap<String, PersistedProfile>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedProfile {
    endpoint: String,
    model: String,
    api_key_dpapi: String,
}

impl SettingsStore {
    pub fn new(root: &Path) -> Self {
        Self {
            path: root.join("settings.json"),
        }
    }

    pub fn load(&self) -> Result<Settings, String> {
        if !self.path.exists() {
            return Ok(Settings::default());
        }
        let bytes =
            fs::read(&self.path).map_err(|_| "Impossible de lire les paramètres.".to_string())?;
        let raw: PersistedSettings = serde_json::from_slice(&bytes)
            .map_err(|_| "Le fichier de paramètres est invalide.".to_string())?;
        let mut profiles = HashMap::new();
        for (name, profile) in raw.profiles {
            let api_key = if profile.api_key_dpapi.is_empty() {
                String::new()
            } else {
                let cipher = STANDARD
                    .decode(profile.api_key_dpapi)
                    .map_err(|_| "Une clé enregistrée est invalide.".to_string())?;
                String::from_utf8(crypto::unprotect(&cipher)?)
                    .map_err(|_| "Une clé enregistrée est invalide.".to_string())?
            };
            profiles.insert(
                name,
                Profile {
                    endpoint: profile.endpoint,
                    model: profile.model,
                    api_key,
                },
            );
        }
        let bindings = raw.shortcut_bindings.unwrap_or_else(|| {
            let mut bindings = actions::default_bindings(raw.shortcut.unwrap_or_else(|| "Ctrl+Alt+T".into()));
            // A previously accepted system chord must not prevent startup or discard
            // the user's profiles. Keep it visible, disabled, for re-recording.
            bindings[0].enabled = actions::parse_shortcut(&bindings[0].shortcut).is_ok();
            bindings
        });
        let language = raw.target_language.unwrap_or(crate::types::Language::Fr);
        let mut migrated = raw.target_language.is_some();
        let actions = raw.actions.map(|actions| actions.into_iter().map(|mut action| {
            if action.prompt_template.contains("{{") {
                action.prompt_template = actions::migrate_template(&action.prompt_template, language);
                migrated = true;
            }
            action
        }).collect::<Vec<_>>()).unwrap_or_else(actions::defaults);
        let default_action_id = raw.default_action_id.filter(|id| actions.iter().any(|a| &a.id == id))
            .unwrap_or_else(|| actions[0].id.clone());
        let settings = Settings {
            mode: raw.mode,
            actions,
            shortcut_bindings: bindings,
            default_action_id,
            history_enabled: raw.history_enabled,
            autostart: raw.autostart,
            connection_expanded: raw.connection_expanded,
            text_size: raw.text_size,
            auto_close: raw.auto_close,
            ui_version: raw.ui_version,
            language: raw.language,
            theme: raw.theme,
            motion: raw.motion,
            motion_preset: raw.motion_preset,
            indicator: raw.indicator,
            after_replace: raw.after_replace,
            undo_strategy: raw.undo_strategy,
            pill_placement: raw.pill_placement,
            glass_material: raw.glass_material,
            menu_action_ids: raw.menu_action_ids,
            profiles,
        };
        validate(&settings)?;
        if migrated {
            // Rewrite the file once so the language setting and the variables are gone.
            let _ = self.save(&settings);
        }
        Ok(settings)
    }

    pub fn save(&self, settings: &Settings) -> Result<(), String> {
        validate(settings)?;
        let mut profiles = HashMap::new();
        for (name, profile) in &settings.profiles {
            let encrypted = if profile.api_key.is_empty() {
                String::new()
            } else {
                STANDARD.encode(crypto::protect(profile.api_key.as_bytes())?)
            };
            profiles.insert(
                name.clone(),
                PersistedProfile {
                    endpoint: profile.endpoint.clone(),
                    model: profile.model.clone(),
                    api_key_dpapi: encrypted,
                },
            );
        }
        let raw = PersistedSettings {
            target_language: None,
            mode: settings.mode,
            shortcut: None,
            actions: Some(settings.actions.clone()),
            shortcut_bindings: Some(settings.shortcut_bindings.clone()),
            default_action_id: Some(settings.default_action_id.clone()),
            history_enabled: settings.history_enabled,
            autostart: settings.autostart,
            connection_expanded: settings.connection_expanded,
            text_size: settings.text_size,
            auto_close: settings.auto_close,
            ui_version: settings.ui_version,
            language: settings.language,
            theme: settings.theme,
            motion: settings.motion,
            motion_preset: settings.motion_preset,
            indicator: settings.indicator,
            after_replace: settings.after_replace,
            undo_strategy: settings.undo_strategy,
            pill_placement: settings.pill_placement,
            glass_material: settings.glass_material,
            menu_action_ids: settings.menu_action_ids.clone(),
            profiles,
        };
        let bytes = serde_json::to_vec_pretty(&raw)
            .map_err(|_| "Impossible de préparer les paramètres.".to_string())?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| "Impossible de créer le dossier de données.".to_string())?;
        }
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, bytes)
            .map_err(|_| "Impossible d’enregistrer les paramètres.".to_string())?;
        replace_file(&tmp, &self.path)
    }
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::PCWSTR,
        Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        },
    };
    let source = source
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    unsafe {
        MoveFileExW(
            PCWSTR(source.as_ptr()),
            PCWSTR(destination.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|_| "Impossible de finaliser les paramètres.".to_string())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination)
        .map_err(|_| "Impossible de finaliser les paramètres.".to_string())
}

pub fn validate(settings: &Settings) -> Result<(), String> {
    actions::validate(settings)?;
    if !(2..=20).contains(&settings.after_replace.undo_seconds) {
        return Err("La durée d’annulation doit être comprise entre 2 et 20 secondes.".into());
    }
    for required in ["fast", "quality"] {
        let profile = settings
            .profiles
            .get(required)
            .ok_or_else(|| format!("Le profil {required} est absent."))?;
        validate_endpoint(&profile.endpoint)?;
        let model = profile.model.trim();
        if model.is_empty() || model.len() > 200 || model.chars().any(char::is_control) {
            return Err(format!("Le modèle du profil {required} est invalide."));
        }
        if profile.api_key.len() > 4096 || profile.api_key.chars().any(|c| c == '\r' || c == '\n') {
            return Err(format!("La clé du profil {required} est invalide."));
        }
    }
    Ok(())
}

pub fn validate_endpoint(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "L’adresse du serveur est invalide.".to_string())?;
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(
            "L’adresse du serveur ne doit contenir ni identifiants, ni requête, ni fragment."
                .into(),
        );
    }
    let loopback = match url
        .host()
        .ok_or_else(|| "L’adresse du serveur doit contenir un hôte.".to_string())?
    {
        url::Host::Domain(host) => host.eq_ignore_ascii_case("localhost"),
        url::Host::Ipv4(ip) => ip.is_loopback(),
        url::Host::Ipv6(ip) => ip.is_loopback(),
    };
    if url.scheme() != "https" && !(url.scheme() == "http" && loopback) {
        return Err(
            "Un serveur distant doit utiliser HTTPS; HTTP est réservé au bouclage local.".into(),
        );
    }
    if !matches!(url.path(), "" | "/" | "/v1" | "/v1/") {
        return Err("L’adresse doit viser la racine du serveur ou son chemin /v1.".into());
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_settings_keep_profiles_and_migrate_the_original_shortcut() {
        for shortcut in ["Ctrl+Alt+Y", "Super+T"] {
            let root = std::env::temp_dir().join(format!("flowtranslate-migration-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            let old = serde_json::json!({
                "targetLanguage": "en", "mode": "fast", "shortcut": shortcut,
                "historyEnabled": true, "autostart": false,
                "profiles": {
                    "fast": {"endpoint": "http://127.0.0.1:8001/v1", "model": "custom-fast", "apiKeyDpapi": ""},
                    "quality": {"endpoint": "https://example.test/v1", "model": "custom-quality", "apiKeyDpapi": ""}
                }
            });
            fs::write(root.join("settings.json"), serde_json::to_vec(&old).unwrap()).unwrap();
            let store = SettingsStore::new(&root);
            let migrated = store.load().unwrap();
            assert_eq!(migrated.shortcut_bindings[0].shortcut, shortcut);
            assert_eq!(migrated.shortcut_bindings[0].enabled, shortcut == "Ctrl+Alt+Y");
            assert_eq!(migrated.default_action_id, "translate-fr");
            assert_eq!(migrated.actions.len(), 4);
            assert_eq!(migrated.profiles["fast"].model, "custom-fast");
            assert!(migrated.history_enabled);
            assert!(!fs::read_to_string(root.join("settings.json")).unwrap().contains("targetLanguage"));
            store.save(&migrated).unwrap();
            let restored = store.load().unwrap();
            assert_eq!(restored.actions, migrated.actions);
            assert_eq!(restored.shortcut_bindings, migrated.shortcut_bindings);
            fs::remove_dir_all(root).unwrap();
        }
    }
    #[test]
    fn a_0_3_0_action_list_loses_its_variables_and_keeps_its_ids() {
        let root = std::env::temp_dir().join(format!("flowtranslate-migration-actions-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let old = serde_json::json!({
            "targetLanguage": "en", "mode": "fast", "historyEnabled": false, "autostart": false,
            "actions": [
                {"id": "translate", "name": "Traduire", "promptTemplate": "Translate the following text into {{targetLanguage}}. Output only the translated result without any additional explanation:\n{{text}}"},
                {"id": "custom", "name": "Résumer", "promptTemplate": "Résume en une phrase : {{text}}"}
            ],
            "shortcutBindings": [{"id": "primary", "shortcut": "Ctrl+Alt+T", "actionId": "translate", "outputMode": "replace", "enabled": true}],
            "defaultActionId": "translate",
            "profiles": {
                "fast": {"endpoint": "http://127.0.0.1:8001/v1", "model": "custom-fast", "apiKeyDpapi": ""},
                "quality": {"endpoint": "https://example.test/v1", "model": "custom-quality", "apiKeyDpapi": ""}
            }
        });
        fs::write(root.join("settings.json"), serde_json::to_vec(&old).unwrap()).unwrap();
        let store = SettingsStore::new(&root);
        let migrated = store.load().unwrap();
        assert_eq!(migrated.default_action_id, "translate");
        assert_eq!(migrated.actions[0].prompt_template, "Translate the following text into English. Output only the translated result without any additional explanation:");
        assert_eq!(migrated.actions[1].prompt_template, "Résume en une phrase :");
        assert_eq!(migrated.shortcut_bindings[0].action_id, "translate");
        let written = fs::read_to_string(root.join("settings.json")).unwrap();
        assert!(!written.contains("{{text}}") && !written.contains("targetLanguage"));
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn migrated_credentials_remain_dpapi_encrypted() {
        let root = std::env::temp_dir().join(format!("flowtranslate-migration-key-{}", uuid::Uuid::new_v4()));
        let store = SettingsStore::new(&root);
        let mut value = Settings::default();
        value.profiles.get_mut("fast").unwrap().api_key = "synthetic-test-key".into();
        store.save(&value).unwrap();
        let mut raw: serde_json::Value = serde_json::from_slice(&fs::read(&store.path).unwrap()).unwrap();
        for key in ["actions", "shortcutBindings", "defaultActionId"] { raw.as_object_mut().unwrap().remove(key); }
        raw["shortcut"] = serde_json::json!("Ctrl+Alt+Y");
        fs::write(&store.path, serde_json::to_vec(&raw).unwrap()).unwrap();
        let migrated = store.load().unwrap();
        assert_eq!(migrated.profiles["fast"].api_key, "synthetic-test-key");
        store.save(&migrated).unwrap();
        assert!(!fs::read_to_string(&store.path).unwrap().contains("synthetic-test-key"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn endpoint_guards() {
        assert!(validate_endpoint("http://127.0.0.1:8001").is_ok());
        assert!(validate_endpoint("http://[::1]:8001").is_ok());
        assert!(validate_endpoint("https://translate.example.test").is_ok());
        assert!(validate_endpoint("http://127.0.0.1:8001/v1").is_ok());
        assert!(validate_endpoint("http://translate.example.test").is_err());
        assert!(validate_endpoint("https://user:secret@example.test").is_err());
        assert!(validate_endpoint("file:///tmp/socket").is_err());
    }
    #[test]
    fn settings_can_be_replaced_and_loaded() {
        let root = std::env::temp_dir().join(format!(
            "flowtranslate-settings-test-{}",
            uuid::Uuid::new_v4()
        ));
        let store = SettingsStore::new(&root);
        let mut value = Settings::default();
        store.save(&value).unwrap();
        value.mode = crate::types::Mode::Fast;
        value.text_size = crate::types::TextSize::Large;
        value.auto_close = crate::types::AutoClose::Never;
        value.ui_version = crate::types::UiVersion::Ilot;
        store.save(&value).unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(loaded.mode, crate::types::Mode::Fast);
        assert_eq!((loaded.text_size, loaded.auto_close), (crate::types::TextSize::Large, crate::types::AutoClose::Never));
        assert_eq!(loaded.ui_version, crate::types::UiVersion::Ilot);
        let _ = std::fs::remove_dir_all(root);
    }
    #[test]
    fn a_0_4_settings_file_without_the_ui_switch_keeps_the_0_4_journey() {
        let root = std::env::temp_dir().join(format!("flowtranslate-settings-test-{}", uuid::Uuid::new_v4()));
        let store = SettingsStore::new(&root);
        store.save(&Settings::default()).unwrap();
        let path = root.join("settings.json");
        let mut raw: serde_json::Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        raw.as_object_mut().unwrap().remove("uiVersion");
        std::fs::write(&path, serde_json::to_vec(&raw).unwrap()).unwrap();
        assert_eq!(store.load().unwrap().ui_version, crate::types::UiVersion::V4);
        let _ = std::fs::remove_dir_all(root);
    }
}
