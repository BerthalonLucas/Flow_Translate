use crate::types::{Language, Mode, Profile, Settings};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri_plugin_global_shortcut::Shortcut;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActionDefinition {
    pub id: String,
    pub name: String,
    pub prompt_template: String,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OutputMode { Display, Replace }
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutBinding {
    pub id: String,
    pub shortcut: String,
    pub action_id: String,
    pub output_mode: OutputMode,
    pub enabled: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionInfo {
    pub action_id: String,
    pub action_name: String,
    pub output_mode: OutputMode,
    pub mode: Mode,
    pub target_language: Language,
}
#[derive(Clone)]
pub struct Execution {
    pub info: ExecutionInfo,
    pub action: ActionDefinition,
    pub profiles: std::collections::HashMap<String, Profile>,
    pub started: bool,
    pub auto_request: Option<String>,
    pub delivered: bool,
    pub target_pending: bool,
}
impl Execution {
    pub fn snapshot(settings: &Settings, binding: Option<&ShortcutBinding>) -> Result<Self, String> {
        let id = binding.map_or(settings.default_action_id.as_str(), |b| b.action_id.as_str());
        let action = settings.actions.iter().find(|a| a.id == id).cloned().ok_or("L’action n’existe plus.")?;
        Ok(Self {
            info: ExecutionInfo { action_id: action.id.clone(), action_name: action.name.clone(),
                output_mode: binding.map_or(OutputMode::Display, |b| b.output_mode),
                mode: settings.mode, target_language: settings.target_language },
            action, profiles: settings.profiles.clone(), started: false, auto_request: None,
            delivered: false, target_pending: false,
        })
    }
    pub fn begin(&mut self, request_id: &str) {
        if !self.started && self.info.output_mode == OutputMode::Replace { self.auto_request = Some(request_id.into()); }
        self.started = true;
    }
    pub fn claim_delivery(&mut self, request_id: &str) -> bool {
        if self.delivered || self.target_pending || self.auto_request.as_deref() != Some(request_id) { return false; }
        self.delivered = true;
        true
    }
}
pub fn defaults() -> Vec<ActionDefinition> {
    [
        ("translate", "Traduire", "Translate the following text into {{targetLanguage}}. Output only the translated result without any additional explanation:\n{{text}}"),
        ("correct", "Corriger", "Correct spelling, grammar and punctuation. Preserve the original language and meaning. Output only the corrected text:\n{{text}}"),
        ("professionalize", "Professionnaliser", "Rewrite the text in a clear, professional tone. Preserve its language and meaning. Output only the rewritten text:\n{{text}}"),
    ].into_iter().map(|(id, name, prompt)| ActionDefinition { id: id.into(), name: name.into(), prompt_template: prompt.into() }).collect()
}
pub fn default_bindings(shortcut: String) -> Vec<ShortcutBinding> {
    vec![ShortcutBinding { id: "primary".into(), shortcut, action_id: "translate".into(), output_mode: OutputMode::Display, enabled: true }]
}
pub fn validate_template(template: &str) -> Result<(), String> {
    if template.trim().is_empty() || template.chars().count() > 8000 || template.contains('\0') { return Err("Le prompt doit contenir de 1 à 8 000 caractères, sans caractère nul.".into()); }
    if template.matches("{{text}}").count() != 1 { return Err("Le prompt doit contenir exactement une variable {{text}}.".into()); }
    let rest = template.replace("{{text}}", "").replace("{{targetLanguage}}", "");
    if rest.contains("{{") || rest.contains("}}") { return Err("Variable inconnue : utilisez {{text}} et éventuellement {{targetLanguage}}.".into()); }
    Ok(())
}
pub fn render(template: &str, text: &str, language: Language) -> Result<String, String> {
    validate_template(template)?;
    let target = match language { Language::Fr => "French", Language::En => "English" };
    // Replace the template's language first: variables inside captured text stay literal.
    Ok(template.replace("{{targetLanguage}}", target).replace("{{text}}", text))
}
pub fn parse_shortcut(value: &str) -> Result<Shortcut, String> {
    if value.len() > 80 { return Err("Le raccourci est trop long.".into()); }
    let parts = value.split('+').map(|v| v.trim().to_ascii_lowercase()).collect::<Vec<_>>();
    if parts.iter().any(|v| matches!(v.as_str(), "super" | "meta" | "win" | "windows" | "cmd" | "command")) {
        return Err("La touche Windows est réservée au système.".into());
    }
    if parts.iter().any(|v| v == "f12") { return Err("F12 est réservée par Windows.".into()); }
    if !parts.iter().any(|v| matches!(v.as_str(), "ctrl" | "control" | "alt")) { return Err("Ajoutez Ctrl ou Alt à la combinaison.".into()); }
    if (parts.iter().any(|p| p == "ctrl" || p == "control") && parts.iter().any(|p| p == "alt") && parts.last().is_some_and(|p| p == "delete"))
        || (parts.iter().any(|p| p == "alt") && parts.last().is_some_and(|p| matches!(p.as_str(), "tab" | "f4" | "escape"))) {
        return Err("Cette combinaison est réservée à Windows.".into());
    }
    value.parse().map_err(|_| "Le raccourci n’est pas reconnu.".into())
}
pub fn validate(settings: &Settings) -> Result<(), String> {
    if settings.actions.is_empty() || settings.actions.len() > 24 { return Err("Configurez entre 1 et 24 actions.".into()); }
    let mut ids = HashSet::new();
    for action in &settings.actions {
        if action.id.is_empty() || action.id.len() > 80 || !ids.insert(&action.id) { return Err("Identifiant d’action invalide ou dupliqué.".into()); }
        if action.name.trim().is_empty() || action.name.chars().count() > 60 || action.name.chars().any(char::is_control) { return Err("Le nom d’une action doit contenir de 1 à 60 caractères.".into()); }
        validate_template(&action.prompt_template)?;
    }
    if !ids.contains(&settings.default_action_id) { return Err("L’action par défaut n’existe pas.".into()); }
    if settings.shortcut_bindings.is_empty() || settings.shortcut_bindings.len() > 12 { return Err("Configurez entre 1 et 12 raccourcis.".into()); }
    let mut binding_ids = HashSet::new();
    let mut keys = HashSet::new();
    for binding in &settings.shortcut_bindings {
        if binding.id.is_empty() || binding.id.len() > 80 || !binding_ids.insert(&binding.id) { return Err("Identifiant de raccourci invalide ou dupliqué.".into()); }
        if !ids.contains(&binding.action_id) { return Err("Un raccourci utilise une action absente.".into()); }
        if binding.enabled && !keys.insert(parse_shortcut(&binding.shortcut)?.id()) { return Err("Deux raccourcis actifs utilisent la même combinaison.".into()); }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn prompts_preserve_literal_user_variables() {
        assert_eq!(render("To {{targetLanguage}}: {{text}}", "{{targetLanguage}} {{text}}", Language::Fr).unwrap(), "To French: {{targetLanguage}} {{text}}");
        for value in ["No text", "{{text}} {{text}}", "{{unknown}} {{text}}"] { assert!(validate_template(value).is_err()); }
    }
    #[test]
    fn shortcut_policy_and_alias_duplicates() {
        for value in ["T", "Shift+T", "Super+T", "Ctrl+F12"] { assert!(parse_shortcut(value).is_err()); }
        let mut settings = Settings::default();
        let mut other = settings.shortcut_bindings[0].clone();
        other.id = "other".into(); other.shortcut = "Control+Alt+KeyT".into();
        settings.shortcut_bindings.push(other);
        assert!(validate(&settings).is_err());
        settings.shortcut_bindings[1].enabled = false;
        assert!(validate(&settings).is_ok());
    }
    #[test]
    fn delivery_is_once_only_and_never_on_retry() {
        let settings = Settings::default();
        let mut binding = settings.shortcut_bindings[0].clone();
        binding.output_mode = OutputMode::Replace;
        let mut run = Execution::snapshot(&settings, Some(&binding)).unwrap();
        run.begin("first"); run.target_pending = true;
        assert!(!run.claim_delivery("first"));
        run.target_pending = false;
        assert!(!run.claim_delivery("stale"));
        assert!(run.claim_delivery("first"));
        assert!(!run.claim_delivery("first"));
        run.begin("retry");
        assert!(!run.claim_delivery("retry"));
    }
    #[test]
    fn a_capture_keeps_its_action_prompt_and_profile_snapshot() {
        let mut settings = Settings::default();
        let mut binding = settings.shortcut_bindings[0].clone();
        binding.action_id = "correct".into();
        let mut run = Execution::snapshot(&settings, Some(&binding)).unwrap();
        settings.actions[1].prompt_template = "Changed: {{text}}".into();
        settings.profiles.get_mut("quality").unwrap().model = "another-model".into();
        assert_eq!(run.info.action_id, "correct");
        assert_ne!(run.action.prompt_template, settings.actions[1].prompt_template);
        assert_ne!(run.profiles["quality"].model, settings.profiles["quality"].model);
        run.begin("display-only");
        assert!(!run.claim_delivery("display-only"));
    }
}
