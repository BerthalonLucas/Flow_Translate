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

/// Written unconditionally since 0.5.0. A file without it comes from 0.4.0 — or from a
/// 0.4.0 that rewrote a 0.5.0 file from its own struct, which drops every field it does
/// not know: it is copied aside once, never twice, before being rewritten.
pub const SCHEMA_VERSION: u32 = 1;

/// The two startup messages. They cross a unit boundary (the Réglages show them as a
/// `danger` Callout): the non-breaking space is written as an escape, never pasted.
pub const NOTICE_BACKUP: &str =
    "Vos réglages étaient illisibles\u{00A0}: la dernière sauvegarde est chargée.";
pub const NOTICE_DEFAULTS: &str =
    "Vos réglages étaient illisibles\u{00A0}: les réglages par défaut sont chargés.";

/// Where the settings in hand come from. `Disk`: a file was read and validated (the
/// current one, or the 0.4.0 backup). `Recovered`: nothing loaded and the defaults are
/// in use — which the `Run` reconciliation reads (lib.rs).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SettingsOrigin {
    Disk,
    Recovered,
}

pub struct LoadOutcome {
    pub settings: Settings,
    pub origin: SettingsOrigin,
    /// `None` when nothing went wrong.
    pub notice: Option<&'static str>,
}

#[derive(Clone)]
pub struct SettingsStore {
    path: PathBuf,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedSettings {
    /// 0 when the field is absent, which is what a 0.4.0 file looks like. It never
    /// leaves this struct: `types::Settings` and the IPC know nothing about it.
    #[serde(default)]
    schema_version: u32,
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

    fn backup(&self) -> PathBuf {
        self.path.with_file_name("settings.v0.json")
    }

    /// The unreadable file is never overwritten and never deleted: it is renamed, dated
    /// to the second, so it can still be looked at.
    fn set_aside(&self) -> Result<PathBuf, String> {
        let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
        for suffix in 0..64 {
            let name = if suffix == 0 {
                format!("settings.illisible-{stamp}.json")
            } else {
                format!("settings.illisible-{stamp}-{suffix}.json")
            };
            let target = self.path.with_file_name(name);
            if target.exists() {
                continue;
            }
            return fs::rename(&self.path, &target)
                .map(|_| target)
                .map_err(|_| "Impossible d’écarter les paramètres illisibles.".to_string());
        }
        Err("Impossible d’écarter les paramètres illisibles.".into())
    }

    /// Reads one file. The flag says whether it already carried a `schemaVersion`.
    fn read(&self, path: &Path) -> Result<(Settings, bool), String> {
        let bytes =
            fs::read(path).map_err(|_| "Impossible de lire les paramètres.".to_string())?;
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
        let versioned = raw.schema_version >= SCHEMA_VERSION;
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
        // `actions: []` panicked here, before `validate` ever saw the file.
        let first = actions
            .first()
            .ok_or_else(|| "Le fichier de paramètres est invalide.".to_string())?;
        let default_action_id = raw.default_action_id.filter(|id| actions.iter().any(|a| &a.id == id))
            .unwrap_or_else(|| first.id.clone());
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
            profiles,
        };
        validate(&settings)?;
        if migrated {
            // Rewrite the file once so the language setting and the variables are gone.
            let _ = self.save(&settings);
        }
        Ok((settings, versioned))
    }

    /// Strict read of the current file: what a file is worth, before the tolerant path
    /// decides what to do about it.
    #[cfg(test)]
    pub fn load(&self) -> Result<Settings, String> {
        if !self.path.exists() {
            return Ok(Settings::default());
        }
        self.read(&self.path).map(|(settings, _)| settings)
    }

    /// Startup path: nothing here fails. An unreadable file used to stop the application
    /// without an icon, a notice or a log. It is now set aside, the last backup or fresh
    /// settings are loaded, and the caller is given the sentence to show.
    pub fn load_tolerant(&self) -> LoadOutcome {
        if !self.path.exists() {
            return LoadOutcome {
                settings: Settings::default(),
                origin: SettingsOrigin::Recovered,
                notice: None,
            };
        }
        match self.read(&self.path) {
            Ok((settings, versioned)) => {
                if !versioned {
                    // A 0.4.0 run rewrites the file from its own struct, so back in 0.5.0
                    // that file looks like a v0 again. Copying it over an existing backup
                    // would replace the real one: the copy happens once.
                    if !self.backup().exists() {
                        let _ = fs::copy(&self.path, self.backup());
                    }
                    let _ = self.save(&settings);
                }
                LoadOutcome { settings, origin: SettingsOrigin::Disk, notice: None }
            }
            Err(_) => {
                let _ = self.set_aside();
                match self.read(&self.backup()) {
                    Ok((settings, _)) => {
                        let _ = self.save(&settings);
                        LoadOutcome {
                            settings,
                            origin: SettingsOrigin::Disk,
                            notice: Some(NOTICE_BACKUP),
                        }
                    }
                    Err(_) => LoadOutcome {
                        settings: Settings::default(),
                        origin: SettingsOrigin::Recovered,
                        notice: Some(NOTICE_DEFAULTS),
                    },
                }
            }
        }
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
            schema_version: SCHEMA_VERSION,
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
    for required in ["fast", "quality"] {
        let engine = crate::types::engine_label(required);
        let profile = settings.profiles.get(required).ok_or_else(|| {
            format!("Le moteur {engine} est absent. Rouvrez les Réglages pour le configurer.")
        })?;
        validate_endpoint(&profile.endpoint)?;
        let model = profile.model.trim();
        if model.is_empty() || model.len() > 200 || model.chars().any(char::is_control) {
            return Err(format!("Le modèle du moteur {engine} est invalide."));
        }
        if profile.api_key.len() > 4096 || profile.api_key.chars().any(|c| c == '\r' || c == '\n') {
            return Err(format!("La clé du moteur {engine} est invalide."));
        }
    }
    Ok(())
}

/// Read and asserted by the Réglages: the non-breaking space is an escape, and the
/// colon of an `hôte:port` never takes one.
pub const HTTPS_ONLY: &str =
    "Un serveur distant doit utiliser HTTPS\u{00A0}; HTTP est réservé au bouclage local.";

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
        return Err(HTTPS_ONLY.into());
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
    /// A whole 0.5.0 file, valid, with its `schemaVersion`.
    fn written(root: &Path) -> SettingsStore {
        fs::create_dir_all(root).unwrap();
        let store = SettingsStore::new(root);
        store.save(&Settings::default()).unwrap();
        store
    }
    fn scratch(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("flowtranslate-{name}-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn an_unreadable_file_is_set_aside_and_the_start_goes_on() {
        // Four ways of being unreadable, none of which may stop a start any more.
        let cases: [(&str, String); 4] = [
            ("tronque", "{\"mode\":\"fast\",\"profiles\":".to_string()),
            ("vide", String::new()),
            ("enum", serde_json::json!({"mode": "turbo", "historyEnabled": false, "autostart": false, "profiles": {}}).to_string()),
            ("dpapi", serde_json::json!({
                "mode": "fast", "historyEnabled": false, "autostart": false,
                "profiles": {
                    "fast": {"endpoint": "http://127.0.0.1:8001/v1", "model": "m", "apiKeyDpapi": "**pas du base64**"},
                    "quality": {"endpoint": "http://127.0.0.1:8002/v1", "model": "m", "apiKeyDpapi": ""}
                }
            }).to_string()),
        ];
        for (name, body) in cases {
            let root = scratch(name);
            fs::create_dir_all(&root).unwrap();
            let store = SettingsStore::new(&root);
            fs::write(&store.path, body).unwrap();
            let outcome = store.load_tolerant();
            assert_eq!(outcome.origin, SettingsOrigin::Recovered, "{name}");
            assert_eq!(outcome.notice, Some(NOTICE_DEFAULTS), "{name}");
            assert_eq!(outcome.settings, Settings::default(), "{name}");
            // Set aside, never deleted and never overwritten.
            let aside = fs::read_dir(&root).unwrap().filter_map(|e| e.ok())
                .filter(|e| e.file_name().to_string_lossy().starts_with("settings.illisible-"))
                .count();
            assert_eq!(aside, 1, "{name}");
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    fn an_empty_action_list_is_refused_instead_of_panicking() {
        // `actions[0]` used to panic before `validate` had a chance to say no.
        let root = scratch("actions-vides");
        fs::create_dir_all(&root).unwrap();
        let store = SettingsStore::new(&root);
        fs::write(&store.path, serde_json::json!({
            "mode": "fast", "actions": [], "shortcutBindings": [], "historyEnabled": false, "autostart": false,
            "profiles": {
                "fast": {"endpoint": "http://127.0.0.1:8001/v1", "model": "m", "apiKeyDpapi": ""},
                "quality": {"endpoint": "http://127.0.0.1:8002/v1", "model": "m", "apiKeyDpapi": ""}
            }
        }).to_string()).unwrap();
        assert!(store.load().is_err());
        let outcome = store.load_tolerant();
        assert_eq!(outcome.origin, SettingsOrigin::Recovered);
        assert_eq!(outcome.settings.actions.len(), 4);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn the_last_readable_backup_is_preferred_to_fresh_settings() {
        let root = scratch("sauvegarde");
        let store = written(&root);
        let kept = Settings { mode: crate::types::Mode::Fast, ..Settings::default() };
        fs::write(store.backup(), fs::read(&store.path).unwrap()).unwrap();
        // The backup is a 0.5.0 file here; what matters is that it loads.
        store.save(&kept).unwrap();
        fs::write(&store.path, "{ pas du json").unwrap();
        let outcome = store.load_tolerant();
        assert_eq!(outcome.origin, SettingsOrigin::Disk);
        assert_eq!(outcome.notice, Some(NOTICE_BACKUP));
        assert_eq!(outcome.settings.mode, crate::types::Mode::Quality);
        // The recovered settings are written back, versioned.
        let written: serde_json::Value = serde_json::from_slice(&fs::read(&store.path).unwrap()).unwrap();
        assert_eq!(written["schemaVersion"], serde_json::json!(SCHEMA_VERSION));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_file_without_schema_version_is_copied_aside_once_and_only_once() {
        let root = scratch("v0");
        let store = written(&root);
        // A 0.4.0 file: the same content without `schemaVersion`.
        let mut raw: serde_json::Value = serde_json::from_slice(&fs::read(&store.path).unwrap()).unwrap();
        raw.as_object_mut().unwrap().remove("schemaVersion");
        raw["mode"] = serde_json::json!("fast");
        fs::write(&store.path, serde_json::to_vec(&raw).unwrap()).unwrap();
        let outcome = store.load_tolerant();
        assert_eq!(outcome.origin, SettingsOrigin::Disk);
        assert_eq!(outcome.notice, None);
        assert_eq!(outcome.settings.mode, crate::types::Mode::Fast);
        let backup = fs::read_to_string(store.backup()).unwrap();
        assert!(!backup.contains("schemaVersion"));
        let rewritten: serde_json::Value = serde_json::from_slice(&fs::read(&store.path).unwrap()).unwrap();
        assert_eq!(rewritten["schemaVersion"], serde_json::json!(SCHEMA_VERSION));

        // A 0.4.0 relaunched rewrites the file from its own struct and drops what it
        // ignores; back here it looks like a v0 again, and a blind copy would replace
        // the real backup with it.
        let mut degraded: serde_json::Value = serde_json::from_slice(&fs::read(&store.path).unwrap()).unwrap();
        degraded.as_object_mut().unwrap().remove("schemaVersion");
        degraded["mode"] = serde_json::json!("quality");
        fs::write(&store.path, serde_json::to_vec(&degraded).unwrap()).unwrap();
        store.load_tolerant();
        assert_eq!(fs::read_to_string(store.backup()).unwrap(), backup);
        let _ = fs::remove_dir_all(root);
    }

    /// The 0.4.0 struct, field for field: no `schemaVersion`, and no
    /// `deny_unknown_fields` anywhere — that is what lets 0.4.0 restart on our file.
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Persisted040 {
        mode: crate::types::Mode,
        #[serde(default)]
        actions: Option<Vec<ActionDefinition>>,
        #[serde(default)]
        shortcut_bindings: Option<Vec<ShortcutBinding>>,
        #[serde(default)]
        default_action_id: Option<String>,
        history_enabled: bool,
        autostart: bool,
        profiles: HashMap<String, PersistedProfile>,
    }

    #[test]
    fn a_0_5_0_file_still_loads_with_the_0_4_0_deserialisation() {
        let root = scratch("retour-0-4-0");
        let store = written(&root);
        let bytes = fs::read(&store.path).unwrap();
        assert!(String::from_utf8_lossy(&bytes).contains("schemaVersion"));
        let old: Persisted040 = serde_json::from_slice(&bytes).expect("0.4.0 reads a 0.5.0 file");
        // What 0.4.0 requires, always written: mode, both profiles, an outputMode per
        // shortcut and 1 to 12 shortcuts.
        assert_eq!(old.mode, crate::types::Mode::Quality);
        assert!(old.profiles.contains_key("fast") && old.profiles.contains_key("quality"));
        let bindings = old.shortcut_bindings.expect("shortcuts");
        assert!((1..=12).contains(&bindings.len()));
        assert!(bindings.iter().all(|b| matches!(b.output_mode, actions::OutputMode::Display | actions::OutputMode::Replace)));
        assert!(old.actions.is_some_and(|actions| !actions.is_empty()));
        assert!(old.default_action_id.is_some());
        assert!(!old.history_enabled && !old.autostart);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_recovery_without_a_backup_lets_an_existing_run_value_raise_autostart() {
        use crate::autostart::{self, RunValue};
        let root = scratch("run-recupere");
        fs::create_dir_all(&root).unwrap();
        let store = SettingsStore::new(&root);
        fs::write(&store.path, "}{").unwrap();
        let outcome = store.load_tolerant();
        assert_eq!(outcome.origin, SettingsOrigin::Recovered);
        let mut settings = outcome.settings;
        // Windows still launches us while `Settings::default()` says it does not.
        assert!(!settings.autostart);
        let decision = autostart::reconcile(outcome.origin, settings.autostart, RunValue::Ours);
        assert!(autostart::apply(&mut settings, decision));
        assert!(!decision.write);
        store.save(&settings).unwrap();
        assert!(store.load().unwrap().autostart, "la case doit dire la vérité et rester décochable");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn the_strings_shared_with_the_reglages_are_written_with_escaped_non_breaking_spaces() {
        // Asserted on both sides: a test in Rust here, a Playwright test there. The real
        // confrontation happens at the merge.
        assert_eq!(HTTPS_ONLY, "Un serveur distant doit utiliser HTTPS\u{00A0}; HTTP est réservé au bouclage local.");
        assert_eq!(NOTICE_BACKUP, "Vos réglages étaient illisibles\u{00A0}: la dernière sauvegarde est chargée.");
        assert_eq!(NOTICE_DEFAULTS, "Vos réglages étaient illisibles\u{00A0}: les réglages par défaut sont chargés.");
        for value in [HTTPS_ONLY, NOTICE_BACKUP, NOTICE_DEFAULTS] {
            assert_eq!(value.matches('\u{00A0}').count(), 1, "{value}");
        }
        assert_eq!(validate_endpoint("http://example.test").unwrap_err(), HTTPS_ONLY);
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
        store.save(&value).unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(loaded.mode, crate::types::Mode::Fast);
        assert_eq!((loaded.text_size, loaded.auto_close), (crate::types::TextSize::Large, crate::types::AutoClose::Never));
        let _ = std::fs::remove_dir_all(root);
    }
}
