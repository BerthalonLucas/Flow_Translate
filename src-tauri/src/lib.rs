mod actions;
mod browser_keys;
use actions::{BindingKind, Execution, ExecutionInfo, OutputMode};
mod capture;
mod clipboard_guard;
mod crypto;
mod error;
use error::{AppError, ErrorKind, Refusal};
mod halo;
mod history;
mod host;
mod inference;
mod menu_memory;
mod pasted;
mod placement;
mod selection_lines;
mod settings;
mod system_motion;
mod system_theme;
mod tray_text;
mod types;
use arboard::Clipboard;
use chrono::Utc;
use history::HistoryStore;
use menu_memory::MenuMemory;
use settings::SettingsStore;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tokio_util::sync::CancellationToken;
use types::*;
use uuid::Uuid;

struct Active {
    id: String,
    cancel: CancellationToken,
}
/// The Îlot menu of a capture (lot 3): what it froze until the choice. `choose_action`
/// runs once per capture, against these settings (actions, profiles, mode). `process`
/// is the source's executable name, the key of the memory per application (lot 4).
#[derive(Clone)]
struct MenuSession {
    capture_id: String,
    settings: Settings,
    process: Option<String>,
    last_action_id: Option<String>,
    chosen: bool,
    /// The watcher dropped its selection (review n°6): no choice runs on it any more.
    invalidated: bool,
}
/// The last press of a menu shortcut (lot 4). A second press of the same binding within
/// 400 ms is a double press: never a new capture, the menu runs its last action.
#[derive(Clone, Debug)]
struct MenuPress {
    binding_id: String,
    at: std::time::Instant,
    /// Set once the press's capture is stored; None while it is still being taken.
    capture_id: Option<String>,
    /// A double press that arrived while the capture was still being taken.
    repeat: bool,
}
const REPEAT_WINDOW: std::time::Duration = std::time::Duration::from_millis(400);
fn is_repeat(previous: Option<&MenuPress>, binding_id: &str, at: std::time::Instant) -> bool {
    previous.is_some_and(|press| press.binding_id == binding_id && at >= press.at && at.duration_since(press.at) < REPEAT_WINDOW)
}
/// What a double press does: emit `menu-repeat` for a menu still waiting, or nothing
/// (its capture is still being taken: the repeat is emitted once stored; or the menu is
/// already chosen or closed).
#[derive(Debug, PartialEq, Eq)]
enum Repeat {
    Emit(String),
    Swallow,
}
struct Inner {
    settings: Settings,
    capture: Option<StoredCapture>,
    menu: Option<MenuSession>,
    menu_press: Option<MenuPress>,
    pending_capture: Option<Capture>,
    active: Option<Active>,
    completed: Option<CompletedResult>,
    execution: Option<Execution>,
    side: Option<PlacementSide>,
    frontend_ready: bool,
    visible: bool,
    source_window: isize,
    source_rect: Option<Rect>,
    work: Rect,
    scale: f64,
    /// The screen (HMONITOR) `work` describes; the bottom forms follow the cursor's.
    monitor: isize,
    /// The rectangle Rust anchors beside the selection (window-relative, logical);
    /// region zero when absent. Lets the waiting pill stand where the glass will open.
    frame: Option<SurfaceRegion>,
    size: (f64, f64),
    manual: Option<ManualPlacement>,
    dragging: bool,
    presentation: Presentation,
    regions: Vec<SurfaceRegion>,
    pending_dismiss: Option<(String, u64)>,
    dismiss_generation: u64,
    last_overlay: Option<(Rect, Vec<SurfaceRegion>)>,
    measured: bool,
    /// Bumped by every notice: the timed hide only acts on its own generation.
    notice_generation: u64,
    /// The last complete result, kept ten minutes after its glass closed so the tray
    /// can show it again (« Revoir la dernière traduction »).
    last_result: Option<(CompletedResult, std::time::Instant)>,
    /// The replacement the Îlot's pill stands under (lot 9), until the next capture or the
    /// dismissal.
    applied: Option<Applied>,
    /// How far `move_overlay` moved the anchored window (physical pixels), kept by `position`.
    shift: (f64, f64),
    /// Some while a menu capture is being taken (review n°4 and n°7): the menu keys the hook
    /// took from the source since the press, until the capture has its id.
    held_keys: Option<Vec<host::MenuKey>>,
}
/// A replacement under the Îlot (lot 9): where the result went, what it replaced, the pasted
/// text as UI Automation found it. Only Rust's memory holds these texts: nothing emits or
/// logs them, the frontend gets rectangles and booleans.
struct Applied {
    request_id: String,
    window: isize,
    window_rect: Option<Rect>,
    control: isize,
    runtime_id: Option<Vec<i32>>,
    original: String,
    pasted: String,
    /// None when it could not be found (or no longer can): no Undo, an estimated place.
    located: Option<pasted::Located>,
    /// The replaced selection's lines and anchor, for that estimate.
    old_lines: Vec<Rect>,
    anchor: Option<Rect>,
    /// Undo is still offered: once per replacement, withdrawn by a key in the source.
    undo: bool,
}
// Glass position chosen by a drag of the anchored overlay (screen pixels of region zero).
#[derive(Clone, Copy, Debug)]
struct ManualPlacement {
    x: f64,
    y: f64,
}
impl Inner {
    fn new(settings: Settings) -> Self {
        Self {
            settings,
            capture: None,
            menu: None,
            menu_press: None,
            pending_capture: None,
            active: None,
            completed: None,
            execution: None,
            side: None,
            frontend_ready: false,
            visible: false,
            source_window: 0,
            source_rect: None,
            work: Rect {
                x: 0.,
                y: 0.,
                width: 1920.,
                height: 1080.,
            },
            scale: 1.,
            monitor: 0,
            frame: None,
            size: (280., 90.),
            manual: None,
            dragging: false,
            presentation: Presentation::Anchored,
            regions: Vec::new(),
            pending_dismiss: None,
            dismiss_generation: 0,
            last_overlay: None,
            measured: false,
            notice_generation: 0,
            last_result: None,
            applied: None,
            shift: (0., 0.),
            held_keys: None,
        }
    }
    /// Sets the result aside for the tray before the glass state forgets it.
    fn retire_result(&mut self) {
        if let Some(result) = self.completed.take() {
            self.last_result = Some((result, std::time::Instant::now()));
        }
    }
    fn cancel(&mut self, id: Option<&str>) {
        // A completed response may still be waiting for its native target.
        // Cancellation must also revoke that deferred automatic write.
        if let Some(run) = self.execution.as_mut() {
            if id.is_none() || run.auto_request.as_deref() == id { run.auto_request = None; }
        }
        if self
            .active
            .as_ref()
            .is_some_and(|a| id.is_none_or(|id| a.id == id))
        {
            if let Some(a) = self.active.take() {
                a.cancel.cancel();
            }
        }
    }
    fn current(&self, id: &str) -> bool {
        self.active
            .as_ref()
            .is_some_and(|a| a.id == id && !a.cancel.is_cancelled())
    }
    /// `choose_action` under the state lock: once per menu capture, against its frozen
    /// settings; the capture then carries the execution like a direct one.
    fn choose(&mut self, capture_id: &str, action_id: &str, instruction: Option<&str>) -> Result<ExecutionInfo, String> {
        if !self.visible || self.pending_dismiss.is_some() || self.capture.as_ref().is_none_or(|capture| capture.public.id != capture_id) {
            return Err("La capture n’est plus active.".into());
        }
        let menu = self.menu.as_mut().filter(|menu| menu.capture_id == capture_id).ok_or("Cette capture n’attend pas de choix.")?;
        if menu.chosen { return Err("Une action a déjà été choisie pour cette sélection.".into()); }
        if menu.invalidated { return Err("La sélection a changé; le menu est fermé.".into()); }
        let execution = Execution::chosen(&menu.settings, action_id, instruction)?;
        menu.chosen = true;
        let info = execution.info.clone();
        if let Some(capture) = self.capture.as_mut() { capture.public.execution = Some(info.clone()); }
        self.execution = Some(execution);
        Ok(info)
    }
    /// A press of the menu binding `binding_id` at `at` (lot 4): None when it is not a
    /// double press (the caller captures); otherwise what the double press does.
    fn repeat_press(&mut self, binding_id: &str, at: std::time::Instant) -> Option<Repeat> {
        if !is_repeat(self.menu_press.as_ref(), binding_id, at) { return None; }
        let press = self.menu_press.as_mut()?;
        let Some(capture_id) = press.capture_id.clone() else {
            press.repeat = true;
            return Some(Repeat::Swallow);
        };
        let waiting = self.visible && self.pending_dismiss.is_none() && self.menu.as_ref().is_some_and(|menu| menu.capture_id == capture_id && !menu.chosen);
        Some(if waiting { Repeat::Emit(capture_id) } else { Repeat::Swallow })
    }
    /// The press at `at` got its capture stored (Some) or none (None): returns the capture
    /// to repeat when a double press arrived meanwhile.
    fn settle_press(&mut self, at: std::time::Instant, capture_id: Option<&str>) -> Option<String> {
        let press = self.menu_press.as_mut().filter(|press| press.at == at)?;
        let Some(capture_id) = capture_id else {
            self.menu_press = None;
            return None;
        };
        press.capture_id = Some(capture_id.to_string());
        press.repeat.then(|| capture_id.to_string())
    }
    /// A menu key the hook took from the source: for the menu that waits, or held while a menu
    /// capture is still being taken (review n°4 and n°7: its id is not known yet).
    fn route_menu_key(&mut self, key: host::MenuKey) -> Option<(String, host::MenuKey)> {
        if let Some(held) = self.held_keys.as_mut() {
            held.push(key);
            return None;
        }
        let capture_id = self.menu.as_ref().filter(|menu| self.visible && !menu.chosen && !menu.invalidated).map(|menu| menu.capture_id.clone())?;
        Some((capture_id, key))
    }
    /// The keys held for the stored capture `capture_id`, a batch at a time: the caller emits
    /// each batch and asks again, so a key held meanwhile keeps its order; an empty batch ends
    /// the hold. Without a capture (None, or its menu no longer waits) they are dropped, never
    /// replayed in the source.
    fn release_held_keys(&mut self, capture_id: Option<&str>) -> Vec<(String, host::MenuKey)> {
        let keys = self.held_keys.as_mut().map(std::mem::take).unwrap_or_default();
        let waits = capture_id.filter(|id| {
            self.visible && self.pending_dismiss.is_none() && self.menu.as_ref().is_some_and(|menu| menu.capture_id == *id && !menu.chosen && !menu.invalidated)
        });
        match waits {
            Some(id) if !keys.is_empty() => keys.into_iter().map(|key| (id.to_string(), key)).collect(),
            _ => {
                self.held_keys = None;
                Vec::new()
            }
        }
    }
    /// The overlay page announces itself: the capture it missed while loading, and whether it
    /// is a page loaded again under a capture still on screen.
    fn page_ready(&mut self) -> (Option<Capture>, bool) {
        let reloaded = self.frontend_ready && self.visible && self.pending_dismiss.is_none() && self.capture.is_some();
        self.frontend_ready = true;
        (self.pending_capture.take(), reloaded)
    }
    /// The watcher found the target of `capture_id` changed: nothing can be replaced any more.
    /// A menu still waiting closes (review n°6: nothing left to act on; a choice in flight is
    /// refused). Under the Îlot the window keeps its place, anchor and side (the working pill,
    /// then the error pill, stay where the user looks; review of da-ilot 3e678ff); under v4 the
    /// glass loses its anchor and docks at the bottom, as in 0.4.
    fn invalidate(&mut self, capture_id: &str) -> Invalidated {
        let ilot = self.settings.ui_version == UiVersion::Ilot;
        let Some(capture) = self.capture.as_mut().filter(|c| c.public.id == capture_id && !c.invalidated) else { return Invalidated::Stale };
        capture.public.can_replace = false;
        capture.target = None;
        capture.invalidated = true;
        if let Some(menu) = self.menu.as_mut().filter(|m| m.capture_id == capture_id && !m.chosen) {
            menu.invalidated = true;
            return Invalidated::CloseMenu;
        }
        if ilot { return Invalidated::Stay; }
        capture.public.anchor = None;
        self.side = None;
        Invalidated::Redock
    }
    /// `replace_result` under the state lock: the completed result's target, spent once (the
    /// capture can no longer be replaced afterwards: `spent`, the frontend is told). Refused
    /// with a code (review of da-ilot, front): a result no longer current `paste_blocked`, a
    /// capture that can no longer be replaced or a foreign window in front `target_changed`.
    /// `in_front(window)`: that window, or one of ours, holds the foreground.
    fn replace_target(&mut self, request_id: &str, capture_id: &str, in_front: impl FnOnce(isize) -> bool) -> (Result<TargetIdentity, AppError>, bool) {
        if !self.visible || self.active.is_some() || self.pending_dismiss.is_some() || self.completed.as_ref().is_none_or(|done| done.request_id != request_id) {
            return (Err(AppError::new(ErrorKind::PasteBlocked, "Ce résultat n’est plus actif.")), false);
        }
        let gone = || AppError::new(ErrorKind::TargetChanged, "La sélection n’est plus disponible; utilisez Copier.");
        let Some(capture) = self.capture.as_mut().filter(|c| c.public.id == capture_id && c.public.can_replace) else { return (Err(gone()), false) };
        let Some(target) = capture.target.take() else { return (Err(gone()), false) };
        capture.public.can_replace = false;
        if !in_front(target.native_window) {
            return (Err(AppError::new(ErrorKind::TargetChanged, "La fenêtre source a changé; remplacement refusé.")), true);
        }
        (Ok(target), true)
    }
    /// The menu of `capture_id` still waits for its choice.
    fn menu_waits(&self, capture_id: &str) -> bool {
        self.menu.as_ref().is_some_and(|menu| menu.capture_id == capture_id && !menu.chosen && !menu.invalidated)
    }
    fn complete_pending_dismiss(&mut self, capture_id: &str, generation: u64) -> bool {
        if self.pending_dismiss.as_ref().is_none_or(|pending| pending.0 != capture_id || pending.1 != generation) {
            return false;
        }
        self.pending_dismiss = None;
        self.capture = None;
        self.last_overlay = None;
        true
    }
}
struct AppState {
    inner: Arc<Mutex<Inner>>,
    settings_store: SettingsStore,
    settings_lock: Mutex<()>,
    menu_memory: Mutex<MenuMemory>,
    /// Chords Windows refused to register (another application holds them, lot 10), by
    /// shortcut id: the settings window shows which binding does not work.
    refused_shortcuts: Mutex<std::collections::HashMap<u32, BindingState>>,
    history: HistoryStore,
    demo: bool,
    demo_clipboard: bool,
    demo_long: bool,
    simulated: bool,
}
fn lock_error() -> String {
    "État interne indisponible.".into()
}
#[tauri::command]
fn get_settings(window: tauri::WebviewWindow, state: State<'_, AppState>) -> Result<Settings, String> {
    let mut settings=state.inner.lock().map_err(|_|lock_error())?.settings.clone();
    if window.label()!="settings" {for profile in settings.profiles.values_mut(){profile.api_key.clear();}}
    Ok(settings)
}

/// Why Windows refused a chord: `RegisterHotKey` answered ERROR_HOTKEY_ALREADY_REGISTERED
/// (global-hotkey's `AlreadyRegistered`: another application holds it), or anything else.
fn refusal_state(error: &str) -> BindingState {
    if error.starts_with("HotKey already registered") { BindingState::Taken } else { BindingState::Failed }
}
/// What the settings window shows per binding (lot 10): registered, refused by Windows
/// (taken by another application, or failed), or disabled.
fn shortcut_statuses(settings: &Settings, refused: &std::collections::HashMap<u32, BindingState>) -> Vec<ShortcutStatus> {
    settings.shortcut_bindings.iter().map(|binding| {
        let state = if !binding.enabled {
            BindingState::Disabled
        } else {
            actions::parse_shortcut(&binding.shortcut).ok()
                .and_then(|key| refused.get(&key.id()).copied())
                .unwrap_or(BindingState::Registered)
        };
        ShortcutStatus { binding_id: binding.id.clone(), shortcut: binding.shortcut.clone(), state }
    }).collect()
}
fn current_shortcut_statuses(state: &AppState) -> Result<Vec<ShortcutStatus>, String> {
    let settings = state.inner.lock().map_err(|_| lock_error())?.settings.clone();
    let refused = state.refused_shortcuts.lock().map_err(|_| lock_error())?;
    Ok(shortcut_statuses(&settings, &refused))
}
fn emit_shortcut_statuses(app: &AppHandle) {
    if let Ok(statuses) = current_shortcut_statuses(&app.state::<AppState>()) {
        let _ = app.emit_to("settings", "shortcut-status", statuses);
    }
}
/// The state of every binding: the settings window asks at load and follows the
/// `shortcut-status` event (startup refusals, saves).
#[tauri::command]
fn shortcut_status(state: State<'_, AppState>) -> Result<Vec<ShortcutStatus>, String> {
    current_shortcut_statuses(&state)
}

fn register_shortcut(app: &AppHandle, value: &str) -> Result<(), String> {
    register_shortcut_state(app, value).map_err(|(_, message)| message)
}
/// Registers a chord; on a refusal, why (for the status) and the French message of 0.4.
fn register_shortcut_state(app: &AppHandle, value: &str) -> Result<(), (BindingState, String)> {
    let shortcut = actions::parse_shortcut(value).map_err(|message| (BindingState::Failed, message))?;
    let shortcut_id = shortcut.id();
    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _, event| {
            if event.state == ShortcutState::Pressed {
                // Dated here, before the capture's own delay: the double press (lot 4)
                // compares the presses, not the ends of their captures.
                let pressed_at = std::time::Instant::now();
                let app = app.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let state = app.state::<AppState>();
                    // Every press translates the current selection (clipboard fallback
                    // included); the docked tab brings the previous glass back on hover.
                    if let Err(error) = capture_with_binding(app.clone(), &state, Some((shortcut_id, pressed_at))) {
                        capture_error(&app, &error, true);
                    }
                });
            }
        })
        .map_err(|error| (refusal_state(&error.to_string()), "Le raccourci est déjà utilisé ou indisponible.".into()))
}
#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    let _save_guard = state.settings_lock.lock().map_err(|_| lock_error())?;
    settings::validate(&settings)?;
    let old = state
        .inner
        .lock()
        .map_err(|_| lock_error())?
        .settings
        .clone();
    let old_keys = old.shortcut_bindings.iter().filter(|b| b.enabled).map(|b| actions::parse_shortcut(&b.shortcut)).collect::<Result<Vec<_>, _>>()?;
    let new_keys = settings.shortcut_bindings.iter().filter(|b| b.enabled).map(|b| actions::parse_shortcut(&b.shortcut)).collect::<Result<Vec<_>, _>>()?;
    // A chord Windows refused at startup, still wanted: tried again (the other application
    // may have let it go), never a reason to refuse the save.
    let refused_before = state.refused_shortcuts.lock().map_err(|_| lock_error())?.clone();
    let mut added: Vec<Shortcut> = Vec::new();
    for binding in settings.shortcut_bindings.iter().filter(|b| b.enabled) {
        let key = actions::parse_shortcut(&binding.shortcut)?;
        if old_keys.iter().any(|old| old.id() == key.id()) || added.iter().any(|done| done.id() == key.id()) { continue; }
        if let Err(error) = register_shortcut(&app, &binding.shortcut) {
            for key in added { let _ = app.global_shortcut().unregister(key); }
            return Err(error);
        }
        added.push(key);
    }
    let result = (|| {
        if settings.autostart != old.autostart {
            (if settings.autostart {
                app.autolaunch().enable()
            } else {
                app.autolaunch().disable()
            })
            .map_err(|_| "Démarrage automatique indisponible.".to_string())?;
        }
        state.settings_store.save(&settings)
    })();
    if let Err(err) = result {
        for key in added { let _ = app.global_shortcut().unregister(key); }
        if settings.autostart != old.autostart {
            let _ = if old.autostart {
                app.autolaunch().enable()
            } else {
                app.autolaunch().disable()
            };
        }
        return Err(err);
    }

    state.inner.lock().map_err(|_| lock_error())?.settings = settings.clone();
    if settings.language != old.language { tray_text::apply(&app, settings.language, state.simulated); }
    for key in old_keys { if !new_keys.iter().any(|new| new.id() == key.id()) { let _ = app.global_shortcut().unregister(key); } }
    {
        let mut retried = refused_before.clone();
        retried.retain(|id, _| new_keys.iter().any(|key| key.id() == *id));
        for binding in settings.shortcut_bindings.iter().filter(|b| b.enabled) {
            let Ok(key) = actions::parse_shortcut(&binding.shortcut) else { continue };
            if !retried.contains_key(&key.id()) { continue; }
            match register_shortcut_state(&app, &binding.shortcut) {
                Ok(()) => { retried.remove(&key.id()); }
                Err((refusal, _)) => { retried.insert(key.id(), refusal); }
            }
        }
        if let Ok(mut refused) = state.refused_shortcuts.lock() { *refused = retried; }
    }
    emit_shortcut_statuses(&app);
    let _ = app.emit_to("settings", "settings-changed", &settings);
    let mut public = settings;
    for profile in public.profiles.values_mut() { profile.api_key.clear(); }
    for label in SURFACES { let _ = app.emit_to(label, "settings-changed", &public); }

    Ok(())
}
fn store_capture(
    app: &AppHandle,
    state: &AppState,
    captured: StoredCapture,
    source: isize,
    mut execution: Option<Execution>,
    menu: Option<MenuSession>,
) -> Result<Capture, String> {
    let mut captured = captured;
    // An anchored capture opens on its selection's screen; the others on the cursor's.
    // The frontend sizes the reader band from that screen (`Capture.screen`).
    let (work, scale, monitor) = host::monitor_at(captured.public.anchor);
    captured.public.screen = Some(Screen { width: work.width / scale, height: work.height / scale, scale });
    if let Some(run) = execution.as_mut() {
        captured.public.execution = Some(run.info.clone());
    }
    let menu = menu.map(|session| MenuSession { capture_id: captured.public.id.clone(), ..session });
    captured.public.menu = menu.as_ref().map(|session| MenuInfo { last_action_id: session.last_action_id.clone() });
    let public = captured.public.clone();
    // A new capture lowers the no-activate state of the previous choice (the display
    // glass stays clickable into focus, as in 0.4); a menu takes its keys at once.
    let overlay = app.get_webview_window("overlay").map(|window| host::handle(&window)).unwrap_or(0);
    host::set_no_activate(overlay, false);
    halo::hide(app);
    host::disarm_undo_watch();
    let is_menu = menu.is_some();
    let ready = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        i.cancel(None);
        i.retire_result();
        i.notice_generation = i.notice_generation.wrapping_add(1);
        i.side = None;
        i.capture = Some(captured);
        i.menu = menu;
        i.execution = execution;
        i.visible = true;
        i.source_window = source;
        i.source_rect = host::window_rect(source);
        i.work = work;
        i.scale = scale;
        i.monitor = monitor;
        i.frame = None;
        i.size = (280., 90.);
        i.manual = None;
        i.dragging = false;
        i.presentation = Presentation::Anchored;
        i.regions.clear();
        i.applied = None;
        i.shift = (0., 0.);
        i.pending_dismiss = None;
        i.dismiss_generation = i.dismiss_generation.wrapping_add(1);
        i.last_overlay = None;
        i.measured = false;
        if !i.frontend_ready {
            i.pending_capture = Some(public.clone());
        }
        i.frontend_ready
    };
    host::set_menu_open(is_menu, source, overlay);
    position(app, state, 280., 90., None)?;
    let fallback_app = app.clone();
    let fallback_id = public.id.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let state = fallback_app.state::<AppState>();
        let size = {
            let Ok(mut i) = state.inner.lock() else { return };
            if !i.visible || i.measured || i.capture.as_ref().is_none_or(|capture| capture.public.id != fallback_id) { return; }
            i.measured = true;
            i.size
        };
        let _ = position(&fallback_app, &state, size.0, size.1, None);
    });
    if ready {
        app.emit_to("overlay", "capture", &public)
            .map_err(|_| "Affichage de la capture indisponible.".to_string())?;
    }
    Ok(public)
}

/// The glass is transparent to the desktop: a notice is a pill alone at the bottom of
/// the cursor's screen, hidden four seconds later, or a line in the open glass. No
/// MessageBox any more (2026-09-14).
const NOTICE_SIZE: (f64, f64) = (420., 64.);
const NOTICE_MS: u64 = 4_000;
fn show_notice(app: &AppHandle, message: &str, code: Option<ErrorKind>) {
    let state = app.state::<AppState>();
    let generation = {
        let Ok(mut i) = state.inner.lock() else { return };
        i.notice_generation = i.notice_generation.wrapping_add(1);
        if i.visible { None } else { Some(i.notice_generation) }
    };
    let notice = CaptureNotice { message: message.to_string(), code };
    let Some(generation) = generation else {
        let _ = app.emit_to("overlay", "capture-notice", notice);
        return;
    };
    let (work, scale) = host::monitor(None);
    let rect = placement::docked(work, NOTICE_SIZE.0 * scale, NOTICE_SIZE.1 * scale);
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let state = handle.state::<AppState>();
        if state.inner.lock().is_ok_and(|i| i.visible || i.notice_generation != generation) { return; }
        let Some(window) = handle.get_webview_window("overlay") else { return };
        // No surface: the pill is never clickable, the whole window lets the mouse through.
        if host::place(&window, rect).is_ok() && host::set_regions(&window, &[], scale).is_ok() {
            let _ = handle.emit_to("overlay", "capture-notice", notice);
        }
    });
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(NOTICE_MS + 300)).await;
        let inner = handle.clone();
        let _ = handle.run_on_main_thread(move || {
            let state = inner.state::<AppState>();
            if state.inner.lock().is_ok_and(|i| !i.visible && i.notice_generation == generation) {
                if let Some(window) = inner.get_webview_window("overlay") { let _ = host::hide(&window); }
            }
        });
    });
}

/// Tray « Revoir la dernière traduction »: shows the last complete result again, as a
/// capture that carries its translation, for ten minutes after its glass closed.
const REPLAY_WINDOW: std::time::Duration = std::time::Duration::from_secs(600);
fn replay_last(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let last = {
        let i = state.inner.lock().map_err(|_| lock_error())?;
        i.completed.clone().filter(|r| r.complete && i.visible)
            .or_else(|| i.last_result.clone().filter(|(_, at)| at.elapsed() <= REPLAY_WINDOW).map(|(r, _)| r))
    };
    let Some(result) = last else {
        show_notice(app, "Aucune traduction récente.", Some(ErrorKind::NoSelection));
        return Ok(());
    };
    let public = Capture {
        id: Uuid::new_v4().to_string(),
        text: result.source_text.clone(),
        source: CaptureSource::Clipboard,
        origin: CaptureOrigin::Replay,
        can_replace: false,
        anchor: None,
        selection_rects: Vec::new(),
        replay: Some(Replay {
            request_id: result.request_id.clone(),
            translated_text: result.translated_text.clone(),
            mode: result.mode,
        }),
        screen: None,
        execution: result.execution.clone().map(|mut info| { info.output_mode = OutputMode::Display; info }),
        menu: None,
    };
    let capture_id = public.id.clone();
    store_capture(app, &state, StoredCapture { public, target: None, invalidated: false }, host::foreground(), None, None)?;
    let mut i = state.inner.lock().map_err(|_| lock_error())?;
    if i.capture.as_ref().is_some_and(|c| c.public.id == capture_id) {
        i.completed = Some(CompletedResult { capture_id, ..result });
    }
    Ok(())
}
#[tauri::command]
fn capture_text(app: AppHandle, state: State<'_, AppState>) -> Result<Capture, String> {
    capture_with_binding(app, &state, None).map_err(String::from)?.ok_or_else(|| "Sélectionnez un texte dans une autre application.".into())
}
/// What a shortcut opens: one action at once, or (a `menu` binding under the Îlot) the
/// menu beside the selection, with the settings of the moment frozen for the choice.
enum Opening {
    Direct(Execution),
    Menu(Box<Settings>),
}
/// The windows that draw over the source: the overlay (Îlot, pill, glass) and the halo.
const SURFACES: [&str; 2] = ["overlay", "halo"];
/// Whether `handle` is one of FlowTranslate's own windows.
fn ours(app: &AppHandle, handle: isize) -> bool {
    handle != 0 && ["overlay", "halo", "settings"].iter().any(|label| app.get_webview_window(label).is_some_and(|w| host::belongs_to(&w, handle)))
}
/// Review n°2 and n°6: the open menu had the foreground and something else than our windows
/// holds it now (the user clicked back into his document, or switched application).
fn leaves_menu(open: bool, focused: bool, fg: isize, ours: bool) -> bool {
    open && focused && fg != 0 && !ours
}
/// None when nothing was captured on purpose: a press while one of our windows holds
/// the foreground (the Îlot has the keyboard) never captures our own window.
fn capture_with_binding(app: AppHandle, state: &AppState, shortcut: Option<(u32, std::time::Instant)>) -> Result<Option<Capture>, AppError> {
    if let Some(window) = app.get_webview_window("settings") {
        // The hidden settings window can hold the foreground for an instant at startup
        // (the demo capture of the probe met it): only the shown one refuses a capture.
        // Nothing of another application is selected then: nothing to act on.
        if window.is_visible().unwrap_or(false) && host::belongs_to(&window, host::foreground()) { return Err(AppError::new(ErrorKind::NoSelection, "Fermez les réglages avant d’utiliser un raccourci.")); }
    }
    let opening = {
        let mut i = state.inner.lock().map_err(|_| AppError::internal(lock_error()))?;
        let binding = if let Some((id, _)) = shortcut {
            Some(i.settings.shortcut_bindings.iter().find(|b| b.enabled && actions::parse_shortcut(&b.shortcut).is_ok_and(|key| key.id() == id)).ok_or_else(|| AppError::internal("Ce raccourci n’est plus actif."))?.clone())
        } else { None };
        match binding {
            Some(binding) if binding.kind == BindingKind::Menu && i.settings.ui_version == UiVersion::Ilot => {
                let at = shortcut.map_or_else(std::time::Instant::now, |(_, at)| at);
                match i.repeat_press(&binding.id, at) {
                    Some(repeat) => Err(repeat),
                    None => {
                        i.menu_press = Some(MenuPress { binding_id: binding.id.clone(), at, capture_id: None, repeat: false });
                        Ok((Opening::Menu(Box::new(i.settings.clone())), Some(at)))
                    }
                }
            }
            _ => Ok((Opening::Direct(Execution::snapshot(&i.settings, binding.as_ref())?), None)),
        }
    };
    let (opening, pressed_at) = match opening {
        Ok(opening) => opening,
        Err(Repeat::Emit(capture_id)) => {
            let _ = app.emit_to("overlay", "menu-repeat", MenuRepeatEvent { capture_id });
            return Ok(None);
        }
        Err(Repeat::Swallow) => return Ok(None),
    };
    // Review n°4 and n°7: the menu's scope opens at the press, before the capture (a synthetic
    // copy first waits for the chord's release): a key typed right after the shortcut is held
    // here until the capture has its id, never typed in the source. Never over our windows.
    let source = host::foreground();
    let overlay = app.get_webview_window("overlay").map(|window| host::handle(&window)).unwrap_or(0);
    let before = (matches!(opening, Opening::Menu(_)) && !ours(&app, source)).then(|| (host::escape_open(), host::menu_focused()));
    if before.is_some() {
        if let Ok(mut i) = state.inner.lock() { i.held_keys = Some(Vec::new()); }
        host::set_menu_open(true, source, overlay);
    }
    let result = capture_opening(&app, state, opening, source);
    if let Some((escape_before, focused_before)) = before {
        match result.as_ref().ok().and_then(|capture| capture.as_ref()) {
            Some(capture) => release_held_keys(&app, state, Some(&capture.id)),
            None => {
                release_held_keys(&app, state, None);
                restore_scope(state, overlay, escape_before, focused_before);
            }
        }
    }
    if let Some(at) = pressed_at {
        let stored = result.as_ref().ok().and_then(|capture| capture.as_ref()).map(|capture| capture.id.clone());
        let repeat = state.inner.lock().map_err(|_| AppError::internal(lock_error()))?.settle_press(at, stored.as_deref());
        if let Some(capture_id) = repeat {
            let _ = app.emit_to("overlay", "menu-repeat", MenuRepeatEvent { capture_id });
        }
    }
    result
}
/// Emits the keys held during a menu capture as `menu-key` for it, in order, or drops them.
fn release_held_keys(app: &AppHandle, state: &AppState, capture_id: Option<&str>) {
    loop {
        let Ok(keys) = state.inner.lock().map(|mut i| i.release_held_keys(capture_id)) else { return };
        if keys.is_empty() { return; }
        for (capture_id, key) in keys {
            let _ = app.emit_to("overlay", "menu-key", MenuKeyEvent { capture_id, key: key.key, shift_key: key.shift });
        }
    }
}
/// What the watcher does with a capture whose target changed (`Inner::invalidate`).
#[derive(Debug, PartialEq, Eq)]
enum Invalidated {
    /// Not the current capture, or already invalidated.
    Stale,
    /// A menu still waiting: it closes.
    CloseMenu,
    /// Under the Îlot: `target-invalidated`, the window stays where it is.
    Stay,
    /// Under v4: `target-invalidated`, then the glass docks at the bottom.
    Redock,
}
/// What the scope becomes when a menu press opened it and got no capture: the scope of what
/// is still shown, never a menu scope left open over nothing (the hook would keep the keys).
#[derive(Debug, PartialEq, Eq)]
enum ScopeAfter {
    Closed,
    Menu,
    Escape,
}
fn scope_after(shown: bool, menu_waits: bool, escape_before: bool) -> ScopeAfter {
    match (shown, menu_waits, escape_before) {
        (false, _, _) => ScopeAfter::Closed,
        (true, true, _) => ScopeAfter::Menu,
        (true, false, true) => ScopeAfter::Escape,
        (true, false, false) => ScopeAfter::Closed,
    }
}
fn restore_scope(state: &AppState, overlay: isize, escape_before: bool, focused_before: bool) {
    let (shown, waits, source) = state.inner.lock().map(|i| {
        let waits = i.menu.as_ref().is_some_and(|menu| !menu.chosen && !menu.invalidated && i.capture.as_ref().is_some_and(|capture| capture.public.id == menu.capture_id));
        (i.visible && i.pending_dismiss.is_none(), waits, i.source_window)
    }).unwrap_or((false, false, 0));
    match scope_after(shown, waits, escape_before) {
        ScopeAfter::Menu => {
            host::set_menu_open(true, source, overlay);
            if focused_before { host::set_menu_focused(); }
        }
        ScopeAfter::Escape => {
            host::set_menu_open(false, 0, 0);
            host::escape_scope(source, overlay);
        }
        ScopeAfter::Closed => {
            host::set_menu_open(false, 0, 0);
            host::close_escape_scope();
        }
    }
}
/// A menu capture is being taken: the scope it opened at its press is its own until it is
/// stored or restored (a dismissal of the previous glass meanwhile must not close it).
fn menu_opening(state: &AppState) -> bool {
    state.inner.lock().is_ok_and(|i| i.held_keys.is_some())
}
/// Takes the capture of a press (or of `capture_text`) and stores it with what it opens.
fn capture_opening(app: &AppHandle, state: &AppState, opening: Opening, source: isize) -> Result<Option<Capture>, AppError> {
    let app = app.clone();
    // The demo capture reads no window; any other never takes one of ours as its source.
    if !state.demo && ours(&app, source) { return Ok(None); }
    let mut captured = capture::capture_current(state.demo, source)?;
    if state.demo_long {
        captured.public.text = "Bonjour, voici une démonstration longue destinée à vérifier le lecteur compact, son retour à la ligne, le menu placé au-dessus du verre et la stabilité du texte pendant les changements de présentation.".into();
    }
    if state.demo_clipboard {
        captured.public.source = CaptureSource::Clipboard;
        captured.public.anchor = None;
        captured.public.can_replace = false;
        captured.target = None;
    }
    let result = match opening {
        Opening::Direct(execution) => store_capture(&app, state, captured, source, Some(execution), None),
        Opening::Menu(settings) => {
            // The last action chosen in this application, if it still exists. The demo reads
            // no window: it is never tied to the one in front (review n°5).
            let process = (!state.demo).then(|| host::process_name(source)).flatten();
            let last_action_id = process.as_deref()
                .and_then(|process| state.menu_memory.lock().ok().and_then(|memory| memory.get(process).map(String::from)))
                .filter(|id| settings.actions.iter().any(|action| &action.id == id));
            let session = MenuSession { capture_id: String::new(), settings: *settings, process, last_action_id, chosen: false, invalidated: false };
            store_capture(&app, state, captured, source, None, Some(session))
        }
    }.map_err(AppError::internal);
    if result.is_ok() {
        reset_tray_tooltip(&app, state.simulated);
    }
    result.map(Some)
}
#[tauri::command]
fn frontend_ready(app: AppHandle, window: tauri::WebviewWindow, state: State<'_, AppState>) -> Result<Option<Capture>, String> {
    let (pending, reloaded) = state.inner.lock().map_err(|_| lock_error())?.page_ready();
    // Review of da-ilot (front n°2): the overlay page loaded again (F5, Ctrl+R, a crash) while
    // a capture was on screen; the new page knows nothing of it, so it closes as a dismissal
    // would (scope closed, nothing pasted) instead of leaving a window that swallows keys.
    if reloaded && window.label() == "overlay" {
        let _ = dismiss(&app, &state);
        return Ok(None);
    }
    Ok(pending)
}

#[tauri::command]
fn translate(
    app: AppHandle,
    state: State<'_, AppState>,
    request: TranslationRequest,
) -> Result<(), String> {
    if request.text.is_empty() || request.text.chars().count() > 6000 {
        return Err("La traduction accepte de 1 à 6 000 caractères.".into());
    }
    let (profile, instruction, execution_info, cancel, inner, history, demo, demo_long, halo_lines) = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        let captured = i
            .capture
            .as_ref()
            .ok_or_else(|| "Aucune capture active.".to_string())?;
        if captured.public.id != request.capture_id
            || captured.public.text != request.text
            || !i.visible
        {
            return Err("La capture n’est plus active.".into());
        }
        if i.execution.is_none() && i.menu.as_ref().is_some_and(|menu| menu.capture_id == request.capture_id && !menu.chosen) {
            return Err("Choisissez d’abord une action dans le menu.".into());
        }
        let run = i.execution.as_ref().ok_or("Cette capture ne peut pas être relancée. Sélectionnez à nouveau le texte.")?;
        if request.action_id != run.info.action_id {
            return Err("L’action ne correspond pas à la capture.".into());
        }
        if !run.started && request.mode != run.info.mode { return Err("Le profil ne correspond pas à la capture.".into()); }
        let key = match request.mode { Mode::Fast => "fast", Mode::Quality => "quality" };
        let profile = run.profiles.get(key).ok_or("Le profil est absent.")?.clone();
        actions::validate_template(&run.action.prompt_template)?;
        let instruction = run.action.prompt_template.clone();
        let execution_info = run.info.clone();
        let halo_lines = halo_lines(&i.settings, &captured.public);
        i.cancel(None);
        i.execution.as_mut().expect("validated execution").begin(&request.id);
        i.completed = None;
        let cancel = CancellationToken::new();
        i.active = Some(Active {
            id: request.id.clone(),
            cancel: cancel.clone(),
        });
        (
            profile,
            instruction,
            execution_info,
            cancel,
            state.inner.clone(),
            state.history.clone(),
            state.simulated,
            state.demo_long,
            halo_lines,
        )
    };
    match halo_lines {
        Some(lines) => halo::work(&app, &lines),
        None => halo::hide(&app),
    }
    // Test only (FLOWTRANSLATE_SIMULATE_WORD_MS, simulated inference): a slower simulated
    // stream, so the real-window checks can watch the halo while the work lasts.
    let word_ms = std::env::var("FLOWTRANSLATE_SIMULATE_WORD_MS").ok().and_then(|value| value.parse::<u64>().ok()).map_or(65, |ms| ms.clamp(1, 2_000));
    tauri::async_runtime::spawn(async move {
        let id = request.id.clone();
        let result = if demo {
            let output = if demo_long {
                "Voici une réponse synthétique assez longue pour dépasser les huit lignes du verre court et ouvrir la bande de lecture en bas de l’écran du curseur. Elle contient plusieurs phrases, des retours naturels et assez de texte pour vérifier que la bande reste stable lorsque la pilule et le menu se chevauchent visuellement, que le défilement fonctionne à la molette et que le budget de lecture se calcule sur le nombre de mots. Aucun appel d’inférence réel n’est effectué dans ce mode de démonstration : le texte est fixe, sans rapport avec la sélection, et sert uniquement à vérifier la géométrie, le suivi de l’écran de la souris et la sortie en deux temps de la bande une fois le temps de lecture écoulé."
            } else if execution_info.action_id.ends_with("-en") {
                "Could you send the updated proposal before Thursday?"
            } else {
                "Pourriez-vous envoyer la proposition mise à jour avant jeudi ?"
            };
            let mut out = String::new();
            for word in output.split_inclusive(' ') {
                if cancel.is_cancelled() {
                    break;
                }
                out.push_str(word);
                if let Ok(i) = inner.lock() {
                    if i.current(&id) {
                        let _ = app.emit_to(
                            "overlay",
                            "translation",
                            StreamEvent {
                                request_id: id.clone(),
                                kind: StreamKind::Delta,
                                text: Some(word.into()),
                                message: None,
                                code: None,
                            },
                        );
                    }
                }
                tokio::select! {_=cancel.cancelled()=>break,_=tokio::time::sleep(std::time::Duration::from_millis(word_ms))=>{}}
            }
            if cancel.is_cancelled() {
                Err(AppError::new(ErrorKind::Cancelled, "Traduction annulée."))
            } else {
                Ok(out)
            }
        } else {
            inference::stream(
                profile,
                instruction,
                request.text.clone(),
                cancel,
                |chunk| {
                    let i = inner.lock().map_err(|_| AppError::internal(lock_error()))?;
                    // A newer request or a cancel overtook this one: the stream just stops.
                    if !i.current(&id) {
                        return Err(AppError::new(ErrorKind::Cancelled, "Requête remplacée."));
                    }
                    app.emit_to(
                        "overlay",
                        "translation",
                        StreamEvent {
                            request_id: id.clone(),
                            kind: chunk.kind,
                            text: chunk.text,
                            message: chunk.message,
                            code: None,
                        },
                    )
                    .map_err(|_| AppError::internal("Flux d’affichage indisponible."))
                },
            )
            .await
        };
        // Check and commit under one lock: stale work can never become copyable.
        let mut i = match inner.lock() {
            Ok(i) => i,
            Err(_) => return,
        };
        if !i.current(&id) {
            return;
        }
        // The response arrived: the sweep fades before the result lands.
        halo::leave(&app);
        match result {
            Ok(text) => {
                i.completed = Some(CompletedResult {
                    execution: Some(execution_info.clone()),
                    request_id: id.clone(),
                    capture_id: request.capture_id,
                    source_text: request.text.clone(),
                    translated_text: text.clone(),
                    mode: request.mode,
                    complete: true,
                });
                i.active = None;
                if i.settings.history_enabled && !demo {
                    let _ = history.add(&HistoryEntry {
                        id: Uuid::new_v4().to_string(),
                        source_text: request.text,
                        translated_text: text.clone(),
                        action_name: execution_info.action_name,
                        mode: request.mode,
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
                // `done` carries the cleaned final text: the glass shows it in place of
                // the deltas it accumulated (a thinking block or a fence never reaches it).
                let _ = app.emit_to(
                    "overlay",
                    "translation",
                    StreamEvent {
                        request_id: id,
                        kind: StreamKind::Done,
                        text: Some(text),
                        message: None,
                        code: None,
                    },
                );
                drop(i);
                schedule_auto_delivery(&app);
            }
            Err(error) => {
                i.active = None;
                let _ = app.emit_to(
                    "overlay",
                    "translation",
                    StreamEvent {
                        request_id: id,
                        kind: StreamKind::Error,
                        text: None,
                        message: Some(error.message),
                        code: Some(error.kind),
                    },
                );
            }
        }
    });
    Ok(())
}
/// The lines the halo sweeps while an action works (lot 6): under the Îlot only, for a UIA
/// selection that still has its anchor (the watcher removes it once the selection moved).
fn halo_lines(settings: &Settings, capture: &Capture) -> Option<Vec<Rect>> {
    (settings.ui_version == UiVersion::Ilot && capture.anchor.is_some() && !capture.selection_rects.is_empty())
        .then(|| capture.selection_rects.clone())
}
#[tauri::command]
fn cancel_translation(app: AppHandle, state: State<'_, AppState>, request_id: String) -> Result<(), String> {
    let mut i = state.inner.lock().map_err(|_| lock_error())?;
    let working = i.current(&request_id);
    i.cancel(Some(&request_id));
    drop(i);
    if working { halo::hide(&app); }
    Ok(())
}
fn result_for(state: &AppState, id: &str) -> Result<CompletedResult, String> {
    let i = state.inner.lock().map_err(|_| lock_error())?;
    i.completed
        .clone()
        .filter(|r| r.request_id == id && r.complete && i.visible)
        .ok_or_else(|| "Aucun résultat complet pour cette requête.".into())
}
/// A « replace » capture delivers its first complete result by pasting it over the
/// selection (0.4.0), once, as soon as inference ends. The state lock is held through
/// the native paste: a new capture, a relaunch or a dismissal cannot commit in between.
/// Like `replace_result` (lot 3): when our own window holds the foreground (the Îlot had
/// the keyboard, a click on the pill), the source is brought back and revalidated after
/// that; when another application holds it, nothing is pasted.
fn schedule_auto_delivery(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let Ok(mut i) = state.inner.lock() else { return };
        if !i.visible || i.pending_dismiss.is_some() || i.active.is_some() { return; }
        let Some(result) = i.completed.clone() else { return };
        let Some(run) = i.execution.as_mut() else { return };
        if !run.claim_delivery(&result.request_id) { return; }
        // Why there is nothing to paste over: the watcher dropped a selection that moved, or
        // the capture never had one that could be written (a console, a copy of the user's).
        let invalidated = i.capture.as_ref().is_some_and(|c| c.public.id == result.capture_id && c.invalidated);
        let target = i.capture.as_mut().filter(|c| c.public.id == result.capture_id && c.public.can_replace).and_then(|c| {
            c.public.can_replace = false;
            c.target.take()
        });
        let fg = host::foreground();
        let ours = SURFACES.iter().any(|label| app.get_webview_window(label).is_some_and(|w| host::belongs_to(&w, fg)));
        let outcome = target.as_ref().ok_or_else(|| nothing_to_paste(invalidated))
            .and_then(|target| if fg != target.native_window && !ours { Err(AppError::new(ErrorKind::TargetChanged, "La fenêtre source a changé; remplacement refusé.")) } else { Ok(target) })
            .and_then(|target| capture::paste(target, &result.translated_text, true));
        // Under the Îlot (lot 9): the pasted text is found at once, still under the lock (no
        // new capture in between), for the pill's place, the marks and Undo.
        let applied = match (&outcome, &target) {
            (Ok(_), Some(target)) if i.settings.ui_version == UiVersion::Ilot => {
                let located = locate_pasted(&result.translated_text, target.native_window);
                let old = i.capture.as_ref().filter(|c| c.public.id == result.capture_id).map(|c| (c.public.selection_rects.clone(), c.public.anchor));
                let (old_lines, anchor) = old.unwrap_or_default();
                Some(Applied {
                    request_id: result.request_id.clone(),
                    window: target.native_window,
                    window_rect: host::window_rect(target.native_window),
                    control: target.control,
                    runtime_id: target.runtime_id.clone(),
                    original: target.selected_text.clone(),
                    pasted: result.translated_text.clone(),
                    undo: located.is_some() && i.settings.after_replace.undo,
                    located,
                    old_lines,
                    anchor,
                })
            }
            _ => None,
        };
        let pasted_rects = applied.as_ref().and_then(|a| a.located.as_ref()).map(|l| l.lines.clone()).unwrap_or_default();
        let undoable = applied.as_ref().is_some_and(|a| a.undo);
        if let Some(applied) = applied {
            if applied.undo { host::arm_undo_watch(applied.window); }
            i.applied = Some(applied);
        }
        let capture_id = result.capture_id.clone();
        drop(i);
        let _ = app.emit_to("overlay", "capture-target", CaptureTarget { capture_id, can_replace: false });
        let _ = app.emit_to("overlay", "result-delivery", ResultDelivery {
            pasted_rects,
            undoable,
            request_id: result.request_id.clone(),
            status: if outcome.is_ok() { DeliveryStatus::Applied } else { DeliveryStatus::Fallback },
            confirmed: outcome.as_ref().is_ok_and(|d| d.confirmed),
            message: match &outcome {
                Ok(d) if d.confirmed => "Sélection remplacée.".to_string(),
                Ok(_) => "Résultat collé dans la sélection.".to_string(),
                Err(error) => error.message.clone(),
            },
            code: outcome.as_ref().err().map(|error| error.kind),
        });
    });
}
/// A « replace » result without a target to paste over: the watcher dropped a selection
/// that moved or changed (`target_changed`), or the capture never had one that could be
/// written (`not_editable`: a console, a password field, a copy the user made himself).
fn nothing_to_paste(invalidated: bool) -> AppError {
    AppError::new(if invalidated { ErrorKind::TargetChanged } else { ErrorKind::NotEditable }, "Aucune sélection à remplacer; le résultat reste dans la bulle.")
}

/// The pasted text before the caret (lot 9), tried three times over about 200 ms: the paste
/// is confirmed from the field's text, the caret and the layout may follow a moment later.
fn locate_pasted(value: &str, window: isize) -> Option<pasted::Located> {
    for attempt in 0..3 {
        if attempt > 0 { std::thread::sleep(std::time::Duration::from_millis(90)); }
        if let Some(located) = pasted::locate(value, window) { return Some(located); }
    }
    None
}

/// The pasted text's runs where they were (within a pixel): nothing scrolled or reflowed.
fn same_rects(now: &[Rect], then: &[Rect]) -> bool {
    now.len() == then.len() && now.iter().zip(then).all(|(a, b)| {
        (a.x - b.x).abs() <= 1. && (a.y - b.y).abs() <= 1. && (a.width - b.width).abs() <= 1. && (a.height - b.height).abs() <= 1.
    })
}

/// The line the new text ends on: the lowest one, the rightmost of that row.
fn last_line(lines: &[Rect]) -> Option<Rect> {
    let lowest = lines.iter().map(|line| line.y + line.height / 2.).fold(f64::NEG_INFINITY, f64::max);
    lines.iter().copied()
        .filter(|line| line.y <= lowest && lowest <= line.y + line.height)
        .max_by(|a, b| (a.x + a.width).total_cmp(&(b.x + b.width)))
}

/// Where the pill goes after the paste (lot 9): under the last line of the new text, never
/// over it (`pillPlacement: margin`: right of the text column). `width` × `height` is the
/// pill's size, logical. The answer is relative to the overlay window as it stands, logical;
/// `inside` false means the pill would leave the window: `move_overlay` first. Estimated from
/// the old selection when the pasted text could not be found.
#[tauri::command]
fn result_pill(app: AppHandle, state: State<'_, AppState>, request_id: String, width: f64, height: f64) -> Result<PillTarget, String> {
    if !width.is_finite() || !height.is_finite() || width <= 0. || height <= 0. { return Err("Dimensions invalides.".into()); }
    let i = state.inner.lock().map_err(|_| lock_error())?;
    if !i.visible || i.pending_dismiss.is_some() { return Err("Ce résultat n’est plus actif.".into()); }
    let applied = i.applied.as_ref().filter(|a| a.request_id == request_id).ok_or("Ce résultat n’est plus actif.")?;
    let s = i.scale;
    let (lines, end, estimated) = match applied.located.as_ref().filter(|l| !l.lines.is_empty()) {
        Some(located) => (located.lines.clone(), last_line(&located.lines).ok_or("Texte introuvable.")?, false),
        None => {
            let anchor = applied.anchor.or_else(|| last_line(&applied.old_lines)).ok_or("Aucun emplacement pour la pilule.")?;
            let (block, end) = placement::estimated_text(&applied.old_lines, anchor, applied.original.chars().count(), applied.pasted.chars().count());
            (block, end, true)
        }
    };
    let margin = i.settings.pill_placement == PillPlacement::Margin;
    let (pill, side, clear) = placement::pill_after_paste(&lines, end, i.work, width * s, height * s, 8. * s, margin);
    drop(i);
    let window = app.get_webview_window("overlay").and_then(|w| host::window_rect(host::handle(&w))).ok_or("Traduction indisponible.")?;
    let (x, y) = ((pill.x - window.x) / s, (pill.y - window.y) / s);
    let inside = x >= -0.5 && y >= -0.5 && x + width <= window.width / s + 0.5 && y + height <= window.height / s + 0.5;
    Ok(PillTarget { x, y, side, inside, estimated, clear })
}

/// Moves the anchored overlay window by `dx`, `dy` logical pixels, its surfaces with it (they
/// are relative to the window), then answers. The frontend calls it at a moment when nothing
/// animates (lot 9: never a SetWindowPos during an animation), when `result_pill` says the
/// pill would leave the window. Kept by every later placement of this capture.
#[tauri::command]
async fn move_overlay(app: AppHandle, state: State<'_, AppState>, capture_id: String, dx: f64, dy: f64) -> Result<(), String> {
    let size = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if !dx.is_finite() || !dy.is_finite() || dx.abs() * i.scale > i.work.width || dy.abs() * i.scale > i.work.height {
            return Err("Déplacement invalide.".into());
        }
        let anchored = i.presentation == Presentation::Anchored && i.capture.as_ref().is_some_and(|c| c.public.anchor.is_some());
        if !i.visible || i.pending_dismiss.is_some() || i.dragging || i.capture.as_ref().is_none_or(|c| c.public.id != capture_id) {
            return Err("La capture n’est plus active.".into());
        }
        if !anchored { return Err("Seule la fenêtre ancrée se déplace.".into()); }
        let (px, py) = (dx * i.scale, dy * i.scale);
        match i.manual.as_mut() {
            Some(manual) => { manual.x += px; manual.y += py; }
            None => { i.shift.0 += px; i.shift.1 += py; }
        }
        i.size
    };
    let (placed_tx, placed_rx) = tokio::sync::oneshot::channel();
    position(&app, &state, size.0, size.1, Some(placed_tx))?;
    placed_rx.await.map_err(|_| "Placement interrompu.".to_string())?
}

/// Marks the changed words of the replacement (lot 9) in the halo: `ranges` are UTF-16
/// offsets of the result (JavaScript string indices), end excluded, at most 64. Each is found
/// in the pasted text by UI Automation and checked by its text; the marks hold until
/// `clear_highlight`, a key in the source, Undo or the dismissal. Answers how many ranges
/// were found and how many lines are drawn (0: nothing shown).
#[tauri::command]
async fn highlight_changes(app: AppHandle, state: State<'_, AppState>, request_id: String, ranges: Vec<TextRange>) -> Result<HighlightResult, String> {
    if ranges.len() > 64 { return Err("Trop de plages.".into()); }
    let (located, value, window) = {
        let i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible || i.pending_dismiss.is_some() { return Err("Ce résultat n’est plus actif.".into()); }
        let applied = i.applied.as_ref().filter(|a| a.request_id == request_id).ok_or("Ce résultat n’est plus actif.")?;
        let Some(located) = applied.located.clone().filter(|_| applied.undo) else { return Ok(HighlightResult { ranges: 0, lines: 0 }) };
        (located, applied.pasted.clone(), applied.window)
    };
    let pairs: Vec<(usize, usize)> = ranges.iter().map(|r| (r.start, r.end)).collect();
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (resolved, lines) = pasted::changed_lines(&located, &value, &pairs, window);
        let state = handle.state::<AppState>();
        let current = state.inner.lock().is_ok_and(|i| i.visible && i.applied.as_ref().is_some_and(|a| a.request_id == request_id && a.undo));
        if !current || lines.is_empty() { return HighlightResult { ranges: resolved, lines: 0 }; }
        halo::marks(&handle, &lines);
        HighlightResult { ranges: resolved, lines: lines.len() }
    }).await.map_err(|_| "Surlignage interrompu.".to_string())
}

/// The pill's Undo is over (its countdown ended): the marks fade out in 900 ms.
#[tauri::command]
fn clear_highlight(app: AppHandle, state: State<'_, AppState>, request_id: String) -> Result<(), String> {
    let current = state.inner.lock().map_err(|_| lock_error())?.applied.as_ref().is_some_and(|a| a.request_id == request_id);
    if current && halo::marking() { halo::leave(&app); }
    Ok(())
}

/// Undo withdrawn (lot 9): `undo-state` tells the frontend why, the marks fade. `request`
/// None: whatever replacement is current (the keyboard hook does not know it).
fn lose_undo(app: &AppHandle, request: Option<&str>, reason: UndoLoss, forget_text: bool) {
    let state = app.state::<AppState>();
    let lost = {
        let Ok(mut i) = state.inner.lock() else { return };
        let Some(applied) = i.applied.as_mut().filter(|a| request.is_none_or(|id| a.request_id == id)) else { return };
        if forget_text { applied.located = None; }
        let was = applied.undo;
        applied.undo = false;
        was.then(|| applied.request_id.clone())
    };
    host::disarm_undo_watch();
    if halo::marking() { halo::leave(app); }
    if let Some(request_id) = lost {
        let _ = app.emit_to("overlay", "undo-state", UndoState { request_id, available: false, reason });
    }
}

/// Undo of a replacement under the Îlot (lot 9), once: Ctrl+Z at the source (`undoStrategy`
/// keystroke, the default) or the original pasted back over the new text (repaste). The
/// source comes back to the front when one of our windows holds it, then the window, the
/// field, the element and the pasted text (still right before the caret, exactly) are checked
/// again, the keys must be up, and they are checked once more. Refused: nothing was sent.
/// Failed: sent, and the original did not come back. The clipboard is kept as for any paste.
#[tauri::command]
async fn undo_result(app: AppHandle, request_id: String) -> Result<UndoOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let refused = |kind: ErrorKind, message: &str| UndoOutcome { request_id: request_id.clone(), status: UndoStatus::Refused, confirmed: false, message: message.into(), code: Some(kind) };
        // Held through the undo: no capture, relaunch or dismissal commits in between.
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible || i.pending_dismiss.is_some() { return Err("Ce résultat n’est plus actif.".into()); }
        let strategy = i.settings.undo_strategy;
        let Some(applied) = i.applied.as_mut().filter(|a| a.request_id == request_id) else { return Err("Ce résultat n’est plus actif.".into()) };
        if !applied.undo { return Ok(refused(ErrorKind::TargetChanged, "Le texte a changé depuis le remplacement; annulation refusée.")); }
        applied.undo = false;
        host::disarm_undo_watch();
        halo::hide(&app);
        let Some(located) = applied.located.take() else { return Ok(refused(ErrorKind::TargetChanged, "Le texte a changé depuis le remplacement; annulation refusée.")) };
        let fg = host::foreground();
        let ours = SURFACES.iter().any(|label| app.get_webview_window(label).is_some_and(|w| host::belongs_to(&w, fg)));
        if fg != applied.window && !ours { return Ok(refused(ErrorKind::TargetChanged, "La fenêtre source a changé; annulation refusée.")); }
        let target = pasted::UndoTarget {
            window: applied.window,
            control: applied.control,
            runtime_id: applied.runtime_id.as_deref(),
            located: &located,
            original: &applied.original,
            pasted: &applied.pasted,
        };
        let outcome = match pasted::undo(&target, strategy, true) {
            Ok(confirmed) => UndoOutcome { request_id: request_id.clone(), status: UndoStatus::Undone, confirmed, message: "Remplacement annulé.".into(), code: None },
            Err(pasted::UndoFailure::Refused(error)) => refused(error.kind, &error.message),
            Err(pasted::UndoFailure::Failed(error)) => UndoOutcome { request_id: request_id.clone(), status: UndoStatus::Failed, confirmed: false, message: error.message, code: Some(error.kind) },
        };
        drop(i);
        Ok(outcome)
    }).await.map_err(|_| "L’annulation a été interrompue.".to_string())?
}
#[tauri::command]
fn copy_result(state: State<'_, AppState>, request_id: String) -> Result<(), String> {
    let r = result_for(&state, &request_id)?;
    // Our own write must not count as a fresh copy for the next shortcut.
    host::suppress_clipboard_tracking(std::time::Duration::from_millis(1_500));
    Clipboard::new()
        .and_then(|mut c| c.set_text(r.translated_text))
        .map_err(|_| "La copie est indisponible.".into())
}
/// « Remplacer » from the menu of the glass: the same paste, the source window brought
/// back to the front first (the click was on our window). One attempt per result.
#[tauri::command]
async fn replace_result(app: AppHandle, state: State<'_, AppState>, request_id: String) -> Result<(), Refusal> {
    let r = result_for(&state, &request_id).map_err(|message| AppError::new(ErrorKind::PasteBlocked, message))?;
    // UI Automation uses an MTA worker, never the WebView's STA UI thread.
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let mut i = state.inner.lock().map_err(|_| AppError::internal(lock_error()))?;
        let fg = host::foreground();
        let ours = SURFACES.iter().any(|label| app.get_webview_window(label).is_some_and(|w| host::belongs_to(&w, fg)));
        let (target, spent) = i.replace_target(&r.request_id, &r.capture_id, |window| fg == window || ours);
        if spent {
            let _ = app.emit_to("overlay", "capture-target", CaptureTarget { capture_id: r.capture_id.clone(), can_replace: false });
        }
        // Held through the paste, as for the automatic one: nothing commits in between.
        capture::paste(&target?, &r.translated_text, true).map(|_| ())
    }).await.map_err(|_| AppError::new(ErrorKind::PasteBlocked, "Le remplacement a été interrompu; utilisez Copier."))?.map_err(Refusal::from)
}
fn schedule_finish_dismiss(app: AppHandle, capture_id: String, generation: u64) -> Result<(), String> {
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let state = handle.state::<AppState>();
        let should_hide = state.inner.lock().map(|mut i| i.complete_pending_dismiss(&capture_id, generation)).unwrap_or(false);
        if should_hide {
            if let Some(window) = handle.get_webview_window("overlay") { let _ = host::hide(&window); }
        }
    }).map_err(|_| "Fermeture de la traduction indisponible.".to_string())
}

fn dismiss(app: &AppHandle, state: &AppState) -> Result<(), String> {
    if !menu_opening(state) {
        host::close_escape_scope();
        host::set_menu_open(false, 0, 0);
    }
    halo::hide(app);
    host::disarm_undo_watch();
    // The overlay had the keyboard (the Îlot, a click in the glass): the source gets it
    // back before the window hides, its selection untouched and nothing pasted. Hiding
    // the active window alone would let Windows pick the next one in the z-order.
    let source = state.inner.lock().map_err(|_| lock_error())?.source_window;
    if app.get_webview_window("overlay").is_some_and(|overlay| host::belongs_to(&overlay, host::foreground())) {
        host::give_foreground(source);
    }
    let pending = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if i.pending_dismiss.is_some() { return Ok(()); }
        let capture_id = i.capture.as_ref().map(|capture| capture.public.id.clone());
        i.cancel(None);
        i.applied = None;
        i.visible = false;
        i.pending_capture = None;
        i.retire_result();
        i.dismiss_generation = i.dismiss_generation.wrapping_add(1);
        capture_id.map(|capture_id| {
            let pending = (capture_id, i.dismiss_generation);
            i.pending_dismiss = Some(pending.clone());
            pending
        })
    };
    let Some((capture_id, generation)) = pending else { return Ok(()); };
    let handle = app.clone();
    let timeout_id = capture_id.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let _ = schedule_finish_dismiss(handle, timeout_id, generation);
    });
    app.emit_to("overlay", "overlay-dismiss-requested", OverlayDismissRequested { capture_id })
        .map_err(|_| "Fermeture de la traduction indisponible.".to_string())?;
    Ok(())
}

#[tauri::command]
fn complete_overlay_dismiss(app: AppHandle, state: State<'_, AppState>, capture_id: String) -> Result<(), String> {
    let generation = {
        let i = state.inner.lock().map_err(|_| lock_error())?;
        let Some((pending_id, generation)) = i.pending_dismiss.as_ref() else { return Ok(()); };
        if pending_id != &capture_id { return Ok(()); }
        *generation
    };
    schedule_finish_dismiss(app, capture_id, generation)
}
#[tauri::command]
fn dismiss_overlay(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    dismiss(&app, &state)
}
// The Windows app mode for the « follow Windows » theme (see system_theme.rs); null when unknown.
#[tauri::command]
fn system_theme() -> Option<system_theme::SystemTheme> {
    system_theme::current()
}
// Whether Windows asks to reduce animations, for « Animations : suivre Windows » (see
// system_motion.rs); null when unknown.
#[tauri::command]
fn system_motion() -> Option<system_motion::SystemMotion> {
    system_motion::current()
}
/// The fields an error may open (lot 13's `data-field` identifiers, `SettingsField`): the
/// menu shortcut, and a profile's address, key or model, of the default profile when bare.
fn settings_field(field: &str) -> bool {
    const PROFILE: [&str; 3] = ["endpoint", "apiKey", "model"];
    field == "menuShortcut"
        || PROFILE.contains(&field)
        || field.split_once('.').is_some_and(|(mode, name)| matches!(mode, "quality" | "fast") && PROFILE.contains(&name))
}
/// Shows the settings window; with `field` (lot 10) it then asks the page to scroll to that
/// field, focus it and make it pulse (`settings-focus-field`). An unknown field only opens.
#[tauri::command]
fn open_settings(app: AppHandle, field: Option<String>) -> Result<(), String> {
    let w = app
        .get_webview_window("settings")
        .ok_or_else(|| "Réglages indisponibles.".to_string())?;
    w.show()
        .and_then(|_| w.set_focus())
        .map_err(|_| "Ouverture des réglages impossible.".to_string())?;
    if let Some(field) = field.filter(|field| settings_field(field)) {
        let _ = app.emit_to("settings", "settings-focus-field", SettingsFocus { field });
    }
    Ok(())
}
#[tauri::command]
fn drag_settings(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "settings" { return Err("Fenêtre inattendue.".into()); }
    window.start_dragging().map_err(|_| "Déplacement indisponible.".into())
}
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}
/// Probe only (see `host::override_cursor`): screen point the hit tester reads instead
/// of the real cursor; both `None` restore the real cursor.
#[tauri::command]
fn override_cursor(x: Option<i32>, y: Option<i32>) -> Result<(), String> {
    host::override_cursor(x.zip(y))
}
/// Activates the visible overlay so the WebView receives the keyboard (the Îlot menu,
/// lot 3). True when the overlay really holds the foreground afterwards; false leaves
/// the menu to the hook's keyboard fallback (`menu-key`).
#[tauri::command]
async fn focus_overlay(app: AppHandle) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || focus_overlay_now(&app))
        .await
        .map_err(|_| "Activation interrompue.".to_string())?
}
/// Off the main thread: the frontend asks as soon as the menu capture arrives, and the
/// window only shows once its first geometry is placed (or 300 ms later) on the main
/// thread, so the wait for it must not block that thread.
fn focus_overlay_now(app: &AppHandle) -> Result<bool, String> {
    let capture_id = {
        let state = app.state::<AppState>();
        let i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible || i.pending_dismiss.is_some() {
            return Err("La capture n’est plus active.".into());
        }
        let capture_id = i.capture
            .as_ref()
            .map(|capture| capture.public.id.clone())
            .ok_or_else(|| "La capture n’est plus active.".to_string())?;
        // Review n°3: a double press may choose before the menu even shows; a menu already
        // chosen (or closed) never takes the keyboard from the source.
        if !i.menu_waits(&capture_id) { return Ok(false); }
        capture_id
    };
    let w = app
        .get_webview_window("overlay")
        .ok_or_else(|| "Traduction indisponible.".to_string())?;
    let shown_by = std::time::Instant::now() + std::time::Duration::from_millis(900);
    while !host::is_visible(&w) {
        let current = app.state::<AppState>().inner.lock().map_err(|_| lock_error())?.capture.as_ref().is_some_and(|capture| capture.public.id == capture_id);
        if !current || std::time::Instant::now() >= shown_by { return Err("La capture n’est plus active.".into()); }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    // Test runs only (the WebView2 probe sets FLOWTRANSLATE_CDP_URL): a refused foreground
    // cannot be provoked on demand, so FLOWTRANSLATE_REFUSE_FOCUS exercises the fallback.
    let refuse = std::env::var_os("FLOWTRANSLATE_CDP_URL").is_some() && std::env::var_os("FLOWTRANSLATE_REFUSE_FOCUS").is_some();
    let focused = if refuse { false } else { host::activate(&w)? };
    let (current, should_hide, waits, source) = {
        let state = app.state::<AppState>();
        let i = state.inner.lock().map_err(|_| lock_error())?;
        let current = i.visible
            && i.pending_dismiss.is_none()
            && i.capture
                .as_ref()
                .is_some_and(|capture| capture.public.id == capture_id);
        let should_hide = !i.visible || i.pending_dismiss.is_some() || i.capture.is_none();
        (current, should_hide, i.menu_waits(&capture_id), i.source_window)
    };
    if !current {
        if should_hide {
            let _ = host::hide(&w);
        }
        return Err("La capture n’est plus active.".into());
    }
    // The choice arrived while the overlay was being activated: the source gets the keyboard
    // back once the chord is released, as after any choice.
    if !waits {
        if focused { return_foreground(host::handle(&w), source); }
        return Ok(false);
    }
    if focused { host::set_menu_focused(); }
    Ok(focused)
}

/// Gives the foreground back from the overlay to the source, once the chord's modifiers
/// are up. A double press (lot 4) chooses while Ctrl+Alt are still held: released over
/// the source, Alt would move its focus to its menu bar (Win11 Notepad, measured on
/// 2026-09-24) and the revalidation would then refuse the paste. Until then the overlay
/// keeps the foreground and receives the release.
fn return_foreground(overlay: isize, source: isize) {
    if overlay == 0 || host::foreground() != overlay { return; }
    if !host::modifiers_down() {
        host::give_foreground(source);
        return;
    }
    std::thread::spawn(move || {
        let _ = host::wait_modifiers_released(std::time::Duration::from_millis(1500));
        if host::foreground() == overlay { host::give_foreground(source); }
    });
}

/// The choice made in the Îlot, once per menu capture (lot 3): a saved action of the
/// settings frozen at the capture, or a free instruction (`actionId` = « instruction »,
/// 1 to 1,000 characters, never logged) that becomes an ephemeral action. The capture
/// then carries its execution (always « replace ») and the frontend calls `translate`
/// with the returned `actionId`, as for any capture. The source gets the keyboard back
/// if the overlay held it, and the overlay turns non-activatable (the pill never steals
/// the focus again, until the next capture).
/// The application a choice is remembered for: a saved action in real use only.
fn remembered_process(process: Option<String>, instruction: bool, simulated: bool) -> Option<String> {
    process.filter(|_| !instruction && !simulated)
}
#[tauri::command]
fn choose_action(app: AppHandle, state: State<'_, AppState>, capture_id: String, action_id: String, instruction: Option<String>) -> Result<ExecutionInfo, String> {
    let (info, source, process) = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        let info = i.choose(&capture_id, &action_id, instruction.as_deref())?;
        (info, i.source_window, i.menu.as_ref().and_then(|menu| menu.process.clone()))
    };
    if !menu_opening(&state) { host::set_menu_open(false, 0, 0); }
    let overlay = app.get_webview_window("overlay").map(|window| host::handle(&window)).unwrap_or(0);
    host::set_no_activate(overlay, true);
    return_foreground(overlay, source);
    // The memory per application (lot 4): a saved action only, never a free instruction, and
    // never in the demo or simulated modes (review n°5: they write no user data).
    if let Some(process) = remembered_process(process, instruction.is_some(), state.simulated) {
        if let Ok(mut memory) = state.menu_memory.lock() {
            if memory.remember(&process, &info.action_id) { let _ = memory.save(); }
        }
    }
    Ok(info)
}
/// Whether `shortcut` is also AltGr + a key on the active layout (the foreground
/// window's), and the character that chord types there (lot 4, for the recorder of the
/// settings window). A plain space typed by Ctrl+Space is not a conflict.
#[tauri::command]
fn shortcut_conflict(shortcut: String) -> Result<ShortcutConflict, String> {
    let parsed = actions::parse_shortcut(&shortcut)?;
    let character = actions::altgr_key(&parsed).and_then(|(vk, shift)| host::altgr_character(vk, shift)).filter(|c| *c != ' ');
    Ok(ShortcutConflict { alt_gr: character.is_some(), character: character.map(String::from) })
}
/// The frontend reserves the window once per form (src/layout.ts): anchored, the short
/// glass with the menu under its pill; bottom, the reader band with the menu above its
/// pill. The ceiling is the current screen's work area (2026-09-14), no longer 640 × 800.
#[tauri::command]
async fn resize_overlay(
    app: AppHandle,
    state: State<'_, AppState>,
    width: f64,
    height: f64,
    capture_id: Option<String>,
    presentation: Option<Presentation>,
    regions: Option<Vec<SurfaceRegion>>,
    frame: Option<SurfaceRegion>,
) -> Result<(), String> {
    if !width.is_finite() || !height.is_finite() || width <= 0. || height <= 0. {
        return Err("Dimensions invalides.".into());
    }
    if let Some(items) = regions.as_ref() { validate_regions(items, width, height)?; }
    if let Some(frame) = frame.as_ref() { validate_frame(frame, width, height)?; }
    let mut changed_screen: Option<Screen> = None;
    {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if capture_id.as_ref().is_some_and(|id| i.capture.as_ref().is_none_or(|capture| &capture.public.id != id)) {
            return Ok(());
        }
        if let Some(presentation) = presentation {
            // A form that moves to the bottom takes the cursor's screen from then on; when
            // that is not the selection's screen, the frontend learns the new work area.
            if presentation == Presentation::Bottom && i.presentation != Presentation::Bottom {
                let (work, scale, monitor) = host::monitor_at(None);
                if monitor != i.monitor {
                    changed_screen = Some(Screen { width: work.width / scale, height: work.height / scale, scale });
                }
                i.work = work;
                i.scale = scale;
                i.monitor = monitor;
                i.manual = None;
            }
            i.presentation = presentation;
        }
        if !fits(width, height, i.work, i.scale) {
            return Err("Dimensions invalides.".into());
        }
        if let Some(regions) = regions { i.regions = regions; i.frame = frame; i.measured = true; }
    }
    if let Some(screen) = changed_screen {
        let _ = app.emit_to("overlay", "work-area", screen);
    }
    let (placed_tx, placed_rx) = tokio::sync::oneshot::channel();
    position(&app, &state, width, height, Some(placed_tx))?;
    placed_rx.await.map_err(|_| "Placement interrompu.".to_string())?
}

/// A window never larger than the work area it will rest on (logical against physical).
fn fits(width: f64, height: f64, work: Rect, scale: f64) -> bool {
    width * scale <= work.width + 1. && height * scale <= work.height + 1.
}

fn validate_frame(frame: &SurfaceRegion, width: f64, height: f64) -> Result<(), String> {
    let values = [frame.x, frame.y, frame.width, frame.height];
    if values.iter().any(|value| !value.is_finite())
        || frame.x < 0. || frame.y < 0. || frame.width <= 0. || frame.height <= 0.
        || frame.x + frame.width > width + 0.01 || frame.y + frame.height > height + 0.01 {
        return Err("Cadre d’ancrage invalide.".into());
    }
    Ok(())
}

/// The reading budget is spent: the frontend dims the glass before it leaves. While it
/// dims, Escape is the user's again (no scope); an approach re-arms it through `position`.
#[tauri::command]
fn overlay_dimming(app: AppHandle, state: State<'_, AppState>, dimming: bool) -> Result<(), String> {
    if dimming {
        host::close_escape_scope();
        return Ok(());
    }
    let source = {
        let i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible { return Ok(()); }
        i.source_window
    };
    host::escape_scope(source, app.get_webview_window("overlay").map(|window| host::handle(&window)).unwrap_or(0));
    Ok(())
}

/// The cursor changed screen while the glass is visible (hit tester, 2026-09-14): a
/// bottom form follows it, the frontend learns the new work area to size the band; an
/// anchored glass belongs to its selection and stays.
fn screen_changed(app: &AppHandle, monitor: isize) {
    let state = app.state::<AppState>();
    let (work, scale) = host::monitor_info(monitor);
    let size = {
        let Ok(mut i) = state.inner.lock() else { return };
        if !i.visible || i.dragging || i.capture.is_none() || i.monitor == monitor || i.presentation != Presentation::Bottom {
            return;
        }
        i.monitor = monitor;
        i.work = work;
        i.scale = scale;
        i.manual = None;
        i.size
    };
    let _ = app.emit_to("overlay", "work-area", Screen { width: work.width / scale, height: work.height / scale, scale });
    let _ = position(app, &state, size.0, size.1, None);
}

fn validate_regions(regions: &[SurfaceRegion], width: f64, height: f64) -> Result<(), String> {
    if regions.is_empty() || regions.len() > 6 { return Err("Régions de surface invalides.".into()); }
    for region in regions {
        let values = [region.x, region.y, region.width, region.height, region.radius];
        if values.iter().any(|value| !value.is_finite())
            || region.x < 0. || region.y < 0. || region.width <= 0. || region.height <= 0.
            || region.radius < 0. || region.radius * 2. > region.width.min(region.height)
            || region.x + region.width > width + 0.01 || region.y + region.height > height + 0.01 {
            return Err("Régions de surface invalides.".into());
        }
    }
    Ok(())
}
#[tauri::command]
fn start_drag(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    client_x: f64,
    client_y: f64,
) -> Result<(), String> {
    if window.label() != "overlay" {
        return Err("Cette fenêtre ne peut pas être déplacée.".into());
    }
    let capture_id = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible {
            return Err("Aucune capture active.".into());
        }
        let capture_id = i.capture
            .as_ref()
            .ok_or_else(|| "Aucune capture active.".to_string())?
            .public
            .id
            .clone();
        i.dragging = true;
        capture_id
    };
    let button_down = match host::compensate_pointer_drag(&window, client_x, client_y) {
        Ok(button_down) => button_down,
        Err(error) => {
            if let Ok(mut i) = state.inner.lock() {
                i.dragging = false;
            }
            return Err(error);
        }
    };
    {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible
            || i.capture
                .as_ref()
                .is_none_or(|capture| capture.public.id != capture_id)
        {
            i.dragging = false;
            return Err("La capture n’est plus active.".into());
        }
    };
    if button_down && window.start_dragging().is_err() {
        state.inner.lock().map_err(|_| lock_error())?.dragging = false;
        return Err("Déplacement indisponible.".into());
    }
    let inner = state.inner.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Tao posts WM_NCLBUTTONDOWN, so start_dragging returns before the native
        // move loop finishes. Commit the manual position only after mouse-up.
        while unsafe {
            windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(
                windows::Win32::UI::Input::KeyboardAndMouse::VK_LBUTTON.0 as i32,
            ) < 0
        } {
            std::thread::sleep(std::time::Duration::from_millis(15));
        }
        let Some(rect) = host::window_rect(host::handle(&window)) else {
            if let Ok(mut i) = inner.lock() {
                i.dragging = false;
            }
            return;
        };
        let (work, scale) = host::monitor(Some(rect));
        let size = {
            let Ok(mut i) = inner.lock() else { return };
            if !i.visible
                || i.capture
                    .as_ref()
                    .is_none_or(|capture| capture.public.id != capture_id)
            {
                return;
            }
            i.manual = Some(ManualPlacement {
                x: rect.x + i.regions.first().map_or(0., |region| region.x * scale),
                y: rect.y + i.regions.first().map_or(0., |region| region.y * scale),
            });
            i.work = work;
            i.scale = scale;
            i.dragging = false;
            i.shift = (0., 0.);
            i.size
        };
        let state = app.state::<AppState>();
        let _ = position(&app, &state, size.0, size.1, None);
    });
    Ok(())
}
#[tauri::command]
async fn check_connection(
    state: State<'_, AppState>,
    mode: Mode,
) -> Result<ConnectionStatus, String> {
    let p = state
        .inner
        .lock()
        .map_err(|_| lock_error())?
        .settings
        .profile(mode)?
        .clone();
    Ok(match inference::check(&p).await {
        Ok(_) => ConnectionStatus {
            connected: true,
            message: "Connexion réussie.".into(),
            code: None,
        },
        Err(error) => ConnectionStatus {
            connected: false,
            message: error.message,
            code: Some(error.kind),
        },
    })
}
#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Result<Vec<HistoryEntry>, String> {
    state.history.list()
}
#[tauri::command]
fn delete_history(state: State<'_, AppState>, id: Option<String>) -> Result<(), String> {
    state.history.delete(id.as_deref())
}

fn position(
    app: &AppHandle,
    state: &AppState,
    width: f64,
    height: f64,
    placed: Option<tokio::sync::oneshot::Sender<Result<(), String>>>,
) -> Result<(), String> {
    let (capture_id, rect, scale, regions, apply_rect, apply_regions) = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible {
            return Ok(());
        }
        if !i.measured { return Ok(()); }
        let cap = i
            .capture
            .as_ref()
            .ok_or_else(|| "Aucune capture active.".to_string())?
            .public
            .clone();
        let capture_id = cap.id.clone();
        let s = i.scale;
        let work = i.work;
        let (w, h) = (width * s, height * s);
        let regions = i.regions.clone();
        let surface = i.frame.or_else(|| regions.first().copied()).unwrap_or(SurfaceRegion { x: 0., y: 0., width, height, radius: 28. });
        let (glass_w, glass_h) = (surface.width * s, surface.height * s);
        // The glass stays in the work area; the transparent reserve around it (halo, menu
        // space) may leave it, over the taskbar or off-screen, so the window is never
        // pushed over its anchor by the clamp.
        let to_host = |glass: Rect| {
            let glass = placement::clamp(work, glass.x, glass.y, glass_w, glass_h);
            Rect { x: glass.x - surface.x * s, y: glass.y - surface.y * s, width: w, height: h }
        };
        i.size = (width, height);
        if i.dragging {
            return Ok(());
        }
        // Docked glass and unanchored captures rest bottom-centre on the tab. Anchored
        // glass keeps its drag position or its anchor.
        // How far the window reaches below the glass top: the menu space reserved under
        // the pill counts when the side is chosen (the glass would otherwise be pushed up
        // over its anchor by the clamp near the bottom edge).
        let extent = h - surface.y * s;
        let mut regions = regions;
        let result: (Rect, f64) = match (i.presentation == Presentation::Bottom || cap.anchor.is_none(), i.manual, cap.anchor) {
            (true, _, _) | (_, _, None) => {
                let rect = placement::docked(work, w, h);
                // A work area shorter than the reserved window truncates it from the top
                // while the frontend keeps its root on the window's bottom edge.
                if rect.height < h {
                    regions = shift_regions(&regions, (rect.height - h) / s);
                }
                (rect, s)
            }
            (false, Some(manual), _) => (to_host(Rect { x: manual.x, y: manual.y, width: glass_w, height: glass_h }), s),
            (false, None, Some(anchor)) => {
                // Design « 1a »: compact and enlarged glass share the anchored top-left
                // corner; a larger glass is shifted by the clamp, never recentred.
                if i.side.is_none() {
                    i.side = Some(placement::overlay(anchor, work, glass_w, 220. * s, extent, None).1);
                }
                let (glass, side) = placement::overlay(anchor, work, glass_w, glass_h, extent, i.side);
                i.side = Some(side);
                // Moved on purpose after a paste (`move_overlay`, lot 9): past the clamp.
                let host = to_host(glass);
                (Rect { x: host.x + i.shift.0, y: host.y + i.shift.1, ..host }, s)
            }
        };
        let apply_rect = i.last_overlay.as_ref().is_none_or(|last| last.0 != result.0);
        let apply_regions = i.last_overlay.as_ref().is_none_or(|last| last.1 != regions);
        (capture_id, result.0, result.1, regions, apply_rect, apply_regions)
    };
    finish_position(app, capture_id, rect, scale, regions, apply_rect, apply_regions, placed)
}

/// Moves regions by `dy` logical pixels, clipping whatever leaves the window through its top.
fn shift_regions(regions: &[SurfaceRegion], dy: f64) -> Vec<SurfaceRegion> {
    regions
        .iter()
        .filter_map(|region| {
            let top = region.y + dy;
            let clipped = (-top).max(0.);
            let height = region.height - clipped;
            (height > 0.).then(|| SurfaceRegion { x: region.x, y: top.max(0.), width: region.width, height, radius: region.radius.min(height / 2.) })
        })
        .collect()
}

fn finish_position(
    app: &AppHandle,
    capture_id: String,
    rect: Rect,
    scale: f64,
    regions: Vec<SurfaceRegion>,
    apply_rect: bool,
    apply_regions: bool,
    placed: Option<tokio::sync::oneshot::Sender<Result<(), String>>>,
) -> Result<(), String> {
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let state = handle.state::<AppState>();
        let source_window = {
            let Ok(i) = state.inner.lock() else {
                if let Some(placed) = placed { let _ = placed.send(Err(lock_error())); }
                return;
            };
            if !i.visible || i.capture.as_ref().is_none_or(|capture| capture.public.id != capture_id) {
                if let Some(placed) = placed { let _ = placed.send(Err("La capture n’est plus active.".into())); }
                return;
            }
            i.source_window
        };
        let result = (|| -> Result<(), String> {
          host::escape_scope(source_window, handle.get_webview_window("overlay").map(|window|host::handle(&window)).unwrap_or(0));
          if apply_rect || apply_regions {
            let window = handle.get_webview_window("overlay").ok_or_else(|| "Traduction indisponible.".to_string())?;
            // Folds, unfolds and menus only change the surfaces: no SetWindowPos.
            if apply_rect { host::place(&window, rect)?; }
            host::set_regions(&window, &regions, scale)?;
          }
          let mut i = state.inner.lock().map_err(|_| lock_error())?;
          if !i.visible || i.capture.as_ref().is_none_or(|capture| capture.public.id != capture_id) {
              return Err("La capture n’est plus active.".into());
          }
          if apply_rect || apply_regions { i.last_overlay = Some((rect, regions)); }
          Ok(())
        })();
        if let Some(placed) = placed { let _ = placed.send(result); }
    }).map_err(|_| "Placement indisponible.".to_string())
}
fn reset_tray_tooltip(app: &AppHandle, simulated: bool) {
    let Some(language) = app.state::<AppState>().inner.lock().ok().map(|i| i.settings.language) else { return };
    if let Some(tray) = app.tray_by_id(tray_text::TRAY_ID) {
        let _ = tray.set_tooltip(Some(tray_text::tooltip(language, simulated)));
    }
}
fn capture_error(app: &AppHandle, error: &AppError, notify: bool) {
    if let Some(tray) = app.tray_by_id("flowtranslate") {
        let _ = tray.set_tooltip(Some(format!("FlowTranslate — {}", error.message)));
    }
    if notify {
        show_notice(app, &error.message, Some(error.kind));
    }
}
fn watch_context(app: AppHandle) {
    std::thread::spawn(move || {
        let mut ticks = 0u32;
        let mut escape_was_down = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(35));
            ticks = ticks.wrapping_add(1);
            // Dates the user's own copies (the three-second freshness rule), visible or not.
            host::track_clipboard();
            let state = app.state::<AppState>();
            if ticks % 102857 == 0 {
                let _ = state.history.maintain();
            }
            let snapshot = {
                let Ok(i) = state.inner.lock() else { continue };
                if !i.visible {
                    escape_was_down = false;
                    continue;
                }
                let applied = i.applied.as_ref().map(|a| (a.request_id.clone(), a.window, a.window_rect, a.located.clone(), a.undo));
                (i.source_window, i.source_rect, i.capture.clone(), i.size, applied)
            };
            let fg = host::foreground();
            let ours = SURFACES.iter().any(|l| {
                app.get_webview_window(l)
                    .is_some_and(|w| host::belongs_to(&w, fg))
            });
            let down = host::escape_down();
            // While the Îlot waits for a choice, Escape is the menu's (« back, then close »),
            // in the WebView or as a `menu-key`; the frontend dismisses when it closes.
            if !host::menu_open() && (host::take_escape() || (down && !escape_was_down && (fg == snapshot.0 || ours))) {
                let _ = dismiss(&app, &state);
            }
            escape_was_down = down;
            // Review n°2 and n°6: the Îlot had the keyboard and the user went back to his document
            // (or to another application): he left the menu, like a click outside it. Closed at
            // once, nothing pasted, and the hook no longer takes his keys.
            if leaves_menu(host::menu_open(), host::menu_focused(), fg, ours) {
                let waiting = state.inner.lock().is_ok_and(|i| i.visible && i.menu.as_ref().is_some_and(|m| !m.chosen));
                if waiting {
                    let _ = dismiss(&app, &state);
                    continue;
                }
            }
            // Every 420 ms; every 105 ms while the halo sweeps over the lines: a scroll or a
            // move must not leave it over other text for long.
            // After a paste under the Îlot (lot 9) too: the pill and the marks stand on the
            // new text.
            let period = if halo::visible() || snapshot.4.is_some() { 3 } else { 12 };
            if ticks % period != 0 || state.demo {
                continue;
            }
            if let Some((request_id, window, window_rect, located, undo)) = snapshot.4 {
                // The caret after the pasted text is normal and keeps the pill; the window
                // moving, another application in front, or the text scrolling or reflowing
                // (its rectangles changed) hide pill and marks. The text no longer before the
                // caret (a click elsewhere): Undo is withdrawn, the pill stays.
                let moved = host::window_rect(window) != window_rect;
                let switched = fg != window && !ours;
                if moved || switched {
                    let _ = dismiss(&app, &state);
                    continue;
                }
                if let Some(located) = located.filter(|_| fg == window) {
                    match pasted::relocate(&located) {
                        Some(rects) if same_rects(&rects, &located.rects) => {}
                        Some(_) => { let _ = dismiss(&app, &state); }
                        None => lose_undo(&app, Some(&request_id), UndoLoss::CaretMoved, true),
                    }
                } else if !undo && halo::marking() {
                    halo::leave(&app);
                }
                continue;
            }
            let Some(captured) = snapshot.2 else { continue };
            // A capture without anchor (a copy, a selection without drawable rectangle) has no
            // place to lose; its target is still checked while the source is in front (review n°1).
            let anchored = captured.public.anchor.is_some();
            // Once invalidated, a capture is not checked again (under the Îlot it keeps its anchor).
            if captured.invalidated || (!anchored && captured.target.is_none()) {
                continue;
            }
            let moved = anchored && host::window_rect(snapshot.0) != snapshot.1;
            let switched = anchored && fg != snapshot.0 && !ours;
            let changed = fg == snapshot.0
                && captured
                    .target
                    .as_ref()
                    .is_some_and(|t| capture::validate_target(t).is_err());
            if moved || switched || changed {
                halo::hide(&app);
                let id = captured.public.id;
                let outcome = match state.inner.lock() {
                    Ok(mut i) => i.invalidate(&id),
                    Err(_) => continue,
                };
                let redock = match outcome {
                    Invalidated::Stale => continue,
                    Invalidated::CloseMenu => {
                        let _ = dismiss(&app, &state);
                        continue;
                    }
                    Invalidated::Stay => false,
                    Invalidated::Redock => true,
                };
                let _ = app.emit_to(
                    "overlay",
                    "target-invalidated",
                    TargetInvalidated {
                        capture_id: id,
                        anchor_lost: redock && anchored,
                        message: "La sélection a changé. Utilisez Copier.".into(),
                        code: ErrorKind::TargetChanged,
                    },
                );
                if redock { let _ = position(&app, &state, snapshot.3 .0, snapshot.3 .1, None); }
            }
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let _ = open_settings(app.clone(), None);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            // FLOWTRANSLATE_DATA_DIR isolates a test run: the executable of the build target
            // would otherwise share settings.json and the history with the installed app.
            let root = match std::env::var_os("FLOWTRANSLATE_DATA_DIR").filter(|dir| !dir.is_empty()) {
                Some(dir) => std::path::PathBuf::from(dir),
                None => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(&root)?;
            let store = SettingsStore::new(&root);
            let settings = store.load()?;
            let language = settings.language;
            let history = HistoryStore::new(&root)?;
            let args = std::env::args().collect::<Vec<_>>();
            let demo = args.iter().any(|a| {
                matches!(
                    a.as_str(),
                    "--demo" | "--demo-selection" | "--demo-clipboard" | "--demo-long"
                )
            });
            let demo_clipboard = args.iter().any(|a| a == "--demo-clipboard");
            let demo_long = args.iter().any(|a| a == "--demo-long");
            let shortcuts = settings.shortcut_bindings.iter().filter(|b| b.enabled).map(|b| b.shortcut.clone()).collect::<Vec<_>>();
            let simulated = demo || args.iter().any(|a| a == "--simulate-inference");
            app.manage(AppState {
                inner: Arc::new(Mutex::new(Inner::new(settings))),
                settings_store: store,
                settings_lock: Mutex::new(()),
                menu_memory: Mutex::new(MenuMemory::load(&root)),
                refused_shortcuts: Mutex::new(std::collections::HashMap::new()),
                history,
                demo,
                demo_clipboard,
                demo_long,
                simulated,
            });
            // Commands may arrive as soon as the WebView loads. State must exist first.
            // No browser accelerators in our pages (F5 reloads the overlay under the capture).
            for config in app.config().app.windows.clone() {
                let window = tauri::WebviewWindowBuilder::from_config(app, &config)?.build()?;
                browser_keys::disable(&window);
            }
            use tauri::tray::TrayIconBuilder;
            let menu = tray_text::menu(app.handle(), language)?;
            let mut tray = TrayIconBuilder::with_id(tray_text::TRAY_ID)
                .tooltip(tray_text::tooltip(language, simulated))
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "replay" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            if let Err(message) = replay_last(&app) {
                                capture_error(&app, &AppError::internal(message), true);
                            }
                        });
                    }
                    "settings" => {
                        let _ = open_settings(app.clone(), None);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            if let Some(w) = app.get_webview_window("halo") {
                // Never hit, never activated, no material: see halo.rs.
                host::silence_frame(&w)?;
                w.set_ignore_cursor_events(true)?;
                host::halo_style(&w)?;
            }
            if let Some(w) = app.get_webview_window("overlay") {
                host::apply_glass(&w);
                host::silence_frame(&w)?;
                let native = host::handle(&w);
                w.on_window_event(move |event| {
                    if matches!(event, tauri::WindowEvent::Focused(_)) {
                        tauri::async_runtime::spawn_blocking(move || {
                            let _ = host::repair_handle(native);
                        });
                    }
                });
            }
            host::start_hit_tester(app.handle().clone(), app.get_webview_window("overlay").map(|w| host::handle(&w)).unwrap_or(0), screen_changed);
            if let Some(w) = app.get_webview_window("settings") {
                let window = w.clone();
                w.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                });
            }
            for shortcut in shortcuts {
                if let Err((refusal, message)) = register_shortcut_state(app.handle(), &shortcut) {
                    if let Ok(key) = actions::parse_shortcut(&shortcut) {
                        if let Ok(mut refused) = app.state::<AppState>().refused_shortcuts.lock() { refused.insert(key.id(), refusal); }
                    }
                    capture_error(app.handle(), &AppError::internal(message), false);
                    let _ = open_settings(app.handle().clone(), None);
                }
            }
            // The page may already listen (it asks `shortcut_status` at load anyway).
            emit_shortcut_statuses(app.handle());
            let keys = app.handle().clone();
            let typed = app.handle().clone();
            host::install_keyboard_hook(move |key| {
                // The keyboard fallback of the Îlot: only while its capture still waits, or held
                // while a menu capture is being taken (review n°4 and n°7).
                let state = keys.state::<AppState>();
                let routed = state.inner.lock().ok().and_then(|mut i| i.route_menu_key(key));
                if let Some((capture_id, key)) = routed {
                    let _ = keys.emit_to("overlay", "menu-key", MenuKeyEvent { capture_id, key: key.key, shift_key: key.shift });
                }
            }, move |key| {
                // A real key reached the source after the paste (lot 9): Undo is no longer safe.
                let reason = if key == host::Typed::UndoKey { UndoLoss::UndoKey } else { UndoLoss::Typed };
                lose_undo(&typed, None, reason, false);
            })?;
            watch_context(app.handle().clone());
            system_theme::watch(app.handle().clone());
            system_motion::watch(app.handle().clone());
            if demo {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let state = handle.state::<AppState>();
                    let _ = capture_text(handle.clone(), state);
                });
            }
            if args.iter().any(|a| a == "--settings") {
                let _ = open_settings(app.handle().clone(), None);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            capture_text,
            frontend_ready,
            translate,
            cancel_translation,
            copy_result,
            replace_result,
            result_pill,
            move_overlay,
            highlight_changes,
            clear_highlight,
            undo_result,
            dismiss_overlay,
            complete_overlay_dismiss,
            open_settings,
            shortcut_status,
            focus_overlay,
            choose_action,
            shortcut_conflict,
            override_cursor,
            resize_overlay,
            overlay_dimming,
            drag_settings,
            quit_app,
            start_drag,
            check_connection,
            get_history,
            delete_history,
            system_theme,
            system_motion
        ])
        .run(tauri::generate_context!())
        .expect("Impossible de démarrer FlowTranslate");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancel_revokes_automatic_delivery_even_after_inference_finishes() {
        let settings = Settings::default();
        let mut binding = settings.shortcut_bindings[0].clone();
        binding.output_mode = OutputMode::Replace;
        let mut i = Inner::new(settings.clone());
        let mut run = Execution::snapshot(&settings, Some(&binding)).unwrap();
        run.begin("completed");
        i.execution = Some(run);
        i.cancel(Some("older"));
        assert_eq!(i.execution.as_ref().unwrap().auto_request.as_deref(), Some("completed"));
        i.cancel(Some("completed"));
        assert!(!i.execution.as_mut().unwrap().claim_delivery("completed"));
        i.execution.as_mut().unwrap().begin("retry");
        assert!(!i.execution.as_mut().unwrap().claim_delivery("retry"));
    }
    fn menu_capture(i: &mut Inner, id: &str) {
        i.capture = Some(StoredCapture { public: Capture { id: id.into(), text: "Texte".into(), source: CaptureSource::Selection, origin: CaptureOrigin::Uia, can_replace: true, anchor: None, selection_rects: Vec::new(), screen: None, replay: None, execution: None, menu: Some(MenuInfo { last_action_id: None }) }, target: None, invalidated: false });
        i.menu = Some(MenuSession { capture_id: id.into(), settings: i.settings.clone(), process: None, last_action_id: None, chosen: false, invalidated: false });
        i.execution = None;
        i.visible = true;
    }
    #[test]
    fn a_second_press_of_the_menu_within_400_ms_repeats_and_never_captures() {
        let t0 = std::time::Instant::now();
        let ms = |n: u64| t0 + std::time::Duration::from_millis(n);
        let press = |at| MenuPress { binding_id: "menu".into(), at, capture_id: None, repeat: false };
        let mut i = Inner::new(Settings::default());
        assert_eq!(i.repeat_press("menu", t0), None, "a first press captures");
        i.menu_press = Some(press(t0));
        // The first capture is still being taken: swallowed, then emitted once it is stored.
        assert_eq!(i.repeat_press("menu", ms(150)), Some(Repeat::Swallow));
        menu_capture(&mut i, "first");
        assert_eq!(i.settle_press(t0, Some("first")).as_deref(), Some("first"));
        // Stored and waiting: emitted at once, up to 399 ms after the first press.
        assert_eq!(i.repeat_press("menu", ms(399)), Some(Repeat::Emit("first".into())));
        assert_eq!(i.repeat_press("menu", ms(400)), None, "400 ms later it is a new press");
        assert_eq!(i.repeat_press("other", ms(100)), None, "another binding is a new press");
        // Chosen already, or closing: nothing, and still no new capture.
        i.menu.as_mut().unwrap().chosen = true;
        assert_eq!(i.repeat_press("menu", ms(200)), Some(Repeat::Swallow));
        i.menu.as_mut().unwrap().chosen = false;
        i.pending_dismiss = Some(("first".into(), 1));
        assert_eq!(i.repeat_press("menu", ms(200)), Some(Repeat::Swallow));
        // A press that captured nothing leaves no trace; a stale settle changes nothing.
        i.menu_press = Some(press(ms(1000)));
        assert_eq!(i.settle_press(ms(900), None), None);
        assert!(i.menu_press.is_some());
        assert_eq!(i.settle_press(ms(1000), None), None);
        assert!(i.menu_press.is_none());
        assert_eq!(i.repeat_press("menu", ms(1100)), None);
        // Without a double press, a stored capture repeats nothing.
        i.menu_press = Some(press(ms(2000)));
        assert_eq!(i.settle_press(ms(2000), Some("second")), None);
    }
    #[test]
    fn a_menu_capture_is_chosen_once_against_its_frozen_settings_then_carries_its_execution() {
        let mut i = Inner::new(Settings::default());
        menu_capture(&mut i, "menu");
        // The settings changing after the capture do not change what the menu runs.
        i.settings.actions.retain(|a| a.id != "correct");
        assert!(i.choose("other", "correct", None).is_err(), "stale capture");
        assert!(i.choose("menu", "missing", None).is_err());
        assert!(!i.menu.as_ref().unwrap().chosen, "a refused choice leaves the menu open");
        let info = i.choose("menu", "correct", None).unwrap();
        assert_eq!((info.action_id.as_str(), info.output_mode), ("correct", OutputMode::Replace));
        assert_eq!(i.capture.as_ref().unwrap().public.execution.as_ref(), Some(&info));
        assert_eq!(i.execution.as_ref().unwrap().info, info);
        assert!(i.choose("menu", "correct", None).is_err(), "once per capture");
        // A free instruction: its reserved id, frozen in Rust (the frontend never resends it).
        menu_capture(&mut i, "free");
        assert!(i.choose("free", actions::INSTRUCTION_ACTION_ID, Some(&"x".repeat(1001))).is_err());
        let info = i.choose("free", actions::INSTRUCTION_ACTION_ID, Some("Plus poli")).unwrap();
        assert_eq!(info.action_id, actions::INSTRUCTION_ACTION_ID);
        assert!(i.execution.as_ref().unwrap().action.prompt_template.contains("Plus poli"));
        // A dismissed or direct capture has nothing to choose.
        menu_capture(&mut i, "closing");
        i.pending_dismiss = Some(("closing".into(), 1));
        assert!(i.choose("closing", "correct", None).is_err());
        i.pending_dismiss = None;
        i.menu = None;
        assert!(i.choose("closing", "correct", None).is_err());
    }
    #[test]
    fn a_key_typed_during_a_menu_capture_waits_for_its_id_and_is_dropped_without_one() {
        let key = |name: &str| host::MenuKey { key: name.into(), shift: false };
        let mut i = Inner::new(Settings::default());
        // The press opened the scope; the capture is still being taken.
        i.held_keys = Some(Vec::new());
        assert_eq!(i.route_menu_key(key("f")), None, "held, never typed in the source");
        menu_capture(&mut i, "menu");
        assert_eq!(i.route_menu_key(key("Enter")), None, "still held until the release");
        assert_eq!(i.release_held_keys(Some("menu")), vec![("menu".into(), key("f")), ("menu".into(), key("Enter"))]);
        assert_eq!(i.route_menu_key(key("Tab")), None, "held meanwhile, after the first batch");
        assert_eq!(i.release_held_keys(Some("menu")), vec![("menu".into(), key("Tab"))]);
        assert!(i.release_held_keys(Some("menu")).is_empty());
        assert!(i.held_keys.is_none());
        assert_eq!(i.route_menu_key(key("1")), Some(("menu".into(), key("1"))), "then straight to the menu");
        // No capture (nothing selected, an error): dropped, never replayed.
        i.held_keys = Some(vec![key("f")]);
        assert!(i.release_held_keys(None).is_empty());
        assert!(i.held_keys.is_none());
        // A capture whose menu no longer waits gets nothing either.
        i.held_keys = Some(vec![key("f")]);
        i.menu.as_mut().unwrap().chosen = true;
        assert!(i.release_held_keys(Some("menu")).is_empty());
        assert_eq!(i.route_menu_key(key("f")), None);
        // The scope after a press without capture: never a menu scope over nothing.
        assert_eq!(scope_after(false, false, true), ScopeAfter::Closed);
        assert_eq!(scope_after(false, true, true), ScopeAfter::Closed);
        assert_eq!(scope_after(true, true, false), ScopeAfter::Menu, "the previous menu still waits");
        assert_eq!(scope_after(true, false, true), ScopeAfter::Escape, "a glass still open");
        assert_eq!(scope_after(true, false, false), ScopeAfter::Closed, "a glass dimming");
    }
    #[test]
    fn a_refused_replacement_says_why_with_its_code() {
        let target = |window| TargetIdentity { runtime_id: None, native_window: window, control: 0, selected_text: "Texte".into(), anchor: None, selection_len: 5, editable: true, check: types::TargetCheck::Uia };
        let ready = || {
            let mut i = Inner::new(Settings::default());
            menu_capture(&mut i, "c");
            i.capture.as_mut().unwrap().target = Some(target(7));
            i.completed = Some(CompletedResult { execution: None, request_id: "r".into(), capture_id: "c".into(), source_text: String::new(), translated_text: String::new(), mode: Mode::Quality, complete: true });
            i
        };
        let code = |(result, spent): (Result<TargetIdentity, AppError>, bool)| (result.err().map(|e| e.kind), spent);
        // Another request than the completed one: nothing is spent.
        assert_eq!(code(ready().replace_target("old", "c", |_| true)), (Some(ErrorKind::PasteBlocked), false));
        // Another application in front: refused, and the capture can no longer be replaced.
        let mut i = ready();
        assert_eq!(code(i.replace_target("r", "c", |window| window == 8)), (Some(ErrorKind::TargetChanged), true));
        assert!(!i.capture.as_ref().unwrap().public.can_replace);
        assert_eq!(code(i.replace_target("r", "c", |_| true)), (Some(ErrorKind::TargetChanged), false), "spent once");
        // The source (or one of our windows) in front: the target, once.
        let mut i = ready();
        let (result, spent) = i.replace_target("r", "c", |window| window == 7);
        assert_eq!((result.map(|t| t.native_window).ok(), spent), (Some(7), true));
    }
    #[test]
    fn an_invalidated_capture_keeps_its_place_under_the_ilot_and_docks_under_v4() {
        let anchor = Rect { x: 10., y: 20., width: 30., height: 16. };
        let chosen = |ui: UiVersion| {
            let mut i = Inner::new(Settings { ui_version: ui, ..Settings::default() });
            menu_capture(&mut i, "c");
            i.capture.as_mut().unwrap().public.anchor = Some(anchor);
            i.side = Some(PlacementSide::Below);
            i.choose("c", "correct", None).unwrap();
            i
        };
        // The working pill under the Îlot: it stays where it is, anchor and side kept.
        let mut i = chosen(UiVersion::Ilot);
        assert_eq!(i.invalidate("c"), Invalidated::Stay);
        let c = i.capture.as_ref().unwrap();
        assert_eq!((c.public.anchor, c.public.can_replace, c.target.is_none(), c.invalidated), (Some(anchor), false, true, true));
        assert_eq!(i.side, Some(PlacementSide::Below));
        assert_eq!(i.invalidate("c"), Invalidated::Stale, "checked once");
        // Under v4 the glass loses its anchor and docks at the bottom, as in 0.4.
        let mut i = chosen(UiVersion::V4);
        assert_eq!(i.invalidate("c"), Invalidated::Redock);
        assert_eq!((i.capture.as_ref().unwrap().public.anchor, i.side), (None, None));
        // A menu still waiting closes; another capture is stale.
        let mut i = Inner::new(Settings::default());
        menu_capture(&mut i, "m");
        assert_eq!(i.invalidate("other"), Invalidated::Stale);
        assert_eq!(i.invalidate("m"), Invalidated::CloseMenu);
        assert!(i.menu.as_ref().unwrap().invalidated);
    }
    #[test]
    fn an_overlay_page_loaded_again_under_a_shown_capture_is_told_apart() {
        let mut i = Inner::new(Settings::default());
        assert_eq!(i.page_ready(), (None, false), "the first load");
        menu_capture(&mut i, "menu");
        assert!(i.page_ready().1, "F5 while the Îlot is shown");
        i.visible = false;
        assert!(!i.page_ready().1, "a reload with nothing on screen");
        // Before the first load, the capture waits for the page and is not a reload.
        let mut first = Inner::new(Settings::default());
        menu_capture(&mut first, "menu");
        first.pending_capture = first.capture.as_ref().map(|c| c.public.clone());
        let (pending, reloaded) = first.page_ready();
        assert_eq!((pending.map(|c| c.id), reloaded), (Some("menu".to_string()), false));
    }
    #[test]
    fn a_choice_is_remembered_in_real_use_only() {
        let chrome = || Some("chrome.exe".to_string());
        assert_eq!(remembered_process(chrome(), false, false).as_deref(), Some("chrome.exe"));
        assert_eq!(remembered_process(chrome(), true, false), None, "a free instruction");
        // Review n°5: --demo-selection and --simulate-inference write no menu-memory.json.
        assert_eq!(remembered_process(chrome(), false, true), None);
        assert_eq!(remembered_process(None, false, false), None);
    }
    #[test]
    fn only_a_menu_that_still_waits_takes_the_keyboard() {
        // Review n°3: a double press chooses while the Îlot is still being shown.
        let mut i = Inner::new(Settings::default());
        assert!(!i.menu_waits("menu"), "no menu");
        menu_capture(&mut i, "menu");
        assert!(i.menu_waits("menu"));
        assert!(!i.menu_waits("other"), "another capture");
        i.choose("menu", "correct", None).unwrap();
        assert!(!i.menu_waits("menu"), "chosen: the source keeps the keyboard");
        menu_capture(&mut i, "next");
        i.menu.as_mut().unwrap().invalidated = true;
        assert!(!i.menu_waits("next"), "invalidated");
    }
    #[test]
    fn a_menu_left_or_invalidated_closes_and_never_runs_a_choice() {
        // The Îlot had the keyboard; the user clicked back into the source: he left the menu.
        assert!(leaves_menu(true, true, 10, false));
        // Still in the Îlot, or the activation was refused (the hook's fallback), or closed.
        assert!(!leaves_menu(true, true, 10, true));
        assert!(!leaves_menu(true, false, 10, false));
        assert!(!leaves_menu(false, true, 10, false));
        assert!(!leaves_menu(true, true, 0, false));
        // The watcher dropped the selection of a menu that still waited: no choice runs.
        let mut i = Inner::new(Settings::default());
        menu_capture(&mut i, "menu");
        i.menu.as_mut().unwrap().invalidated = true;
        assert!(i.choose("menu", "correct", None).is_err());
        assert!(!i.menu.as_ref().unwrap().chosen);
    }
    #[test]
    fn a_short_work_area_shifts_the_docked_regions_up_and_clips_them_at_the_top() {
        let regions = [
            SurfaceRegion { x: 92., y: 500., width: 300., height: 200., radius: 28. },
            SurfaceRegion { x: 220., y: 722., width: 44., height: 20., radius: 10. },
        ];
        // 758 px reserved, 700 px available: everything moves 58 px up.
        let shifted = shift_regions(&regions, -58.);
        assert_eq!(shifted[0].y, 442.);
        assert_eq!(shifted[1].y, 664.);
        assert_eq!(shifted.len(), 2);
        // A surface leaving through the top is clipped, its radius kept plausible; one
        // entirely above the window disappears.
        let clipped = shift_regions(&regions, -560.);
        assert_eq!(clipped.len(), 2);
        assert_eq!((clipped[0].y, clipped[0].height), (0., 140.));
        assert_eq!(shift_regions(&regions, -730.).len(), 1);
    }
    #[test]
    fn a_result_without_target_says_why_and_the_settings_open_only_known_fields() {
        assert_eq!(nothing_to_paste(true).kind, ErrorKind::TargetChanged);
        assert_eq!(nothing_to_paste(false).kind, ErrorKind::NotEditable);
        for field in ["menuShortcut", "endpoint", "apiKey", "model", "quality.endpoint", "fast.apiKey", "fast.model"] {
            assert!(settings_field(field), "{field}");
        }
        for field in ["", "history", "slow.model", "model.fast", "quality.model.x", "quality.", "../x"] {
            assert!(!settings_field(field), "{field}");
        }
    }
    #[test]
    fn every_binding_reports_whether_windows_registered_its_chord() {
        let mut settings = Settings::default();
        let menu = settings.shortcut_bindings[0].clone();
        settings.shortcut_bindings.push(actions::ShortcutBinding { id: "direct".into(), shortcut: "Ctrl+Alt+Shift+T".into(), enabled: false, ..menu.clone() });
        let mut refused = std::collections::HashMap::new();
        let states = |refused: &std::collections::HashMap<u32, BindingState>| shortcut_statuses(&settings, refused).into_iter().map(|s| (s.binding_id, s.state)).collect::<Vec<_>>();
        assert_eq!(states(&refused), vec![(menu.id.clone(), BindingState::Registered), ("direct".into(), BindingState::Disabled)]);
        // Ctrl+Alt+Space held by another application at startup (measured on 2026-09-24).
        refused.insert(actions::parse_shortcut(&menu.shortcut).unwrap().id(), refusal_state("HotKey already registered: HotKey { mods: ALT | CONTROL, key: Space, id: 1 }"));
        assert_eq!(states(&refused)[0], (menu.id.clone(), BindingState::Taken));
        assert_eq!(refusal_state("Unable to register hotkey: Unknown VKCode for F24"), BindingState::Failed);
        let json = serde_json::to_value(shortcut_statuses(&settings, &refused)).unwrap();
        assert_eq!(json[0], serde_json::json!({"bindingId": menu.id, "shortcut": menu.shortcut, "state": "taken"}));
    }
    #[test]
    fn the_pill_follows_the_last_line_and_a_scrolled_text_is_told_apart() {
        let first = Rect { x: 100., y: 200., width: 600., height: 20. };
        let last = Rect { x: 100., y: 220., width: 240., height: 20. };
        let run = Rect { x: 360., y: 221., width: 80., height: 18. };
        assert_eq!(last_line(&[first, last, run]), Some(run), "the rightmost run of the lowest row");
        assert_eq!(last_line(&[last, first]), Some(last));
        assert_eq!(last_line(&[]), None);
        // Within a pixel the text stayed; a scroll moves every run.
        assert!(same_rects(&[first, last], &[Rect { x: 100.5, ..first }, last]));
        assert!(!same_rects(&[first, last], &[Rect { y: 180., ..first }, Rect { y: 200., ..last }]));
        assert!(!same_rects(&[first], &[first, last]));
    }
    #[test]
    fn the_result_and_undo_events_carry_rectangles_booleans_and_codes_never_text() {
        let delivery = ResultDelivery { request_id: "r".into(), status: DeliveryStatus::Applied, confirmed: true, message: "Sélection remplacée.".into(), code: None, pasted_rects: Vec::new(), undoable: false };
        let json = serde_json::to_value(&delivery).unwrap();
        assert!(json.get("pastedRects").is_none(), "absent when the pasted text was not found");
        assert_eq!(json["undoable"], false);
        let line = Rect { x: 1., y: 2., width: 3., height: 4. };
        let json = serde_json::to_value(ResultDelivery { pasted_rects: vec![line], undoable: true, ..delivery }).unwrap();
        assert_eq!(json["pastedRects"], serde_json::json!([{"x": 1., "y": 2., "width": 3., "height": 4.}]));
        assert_eq!(serde_json::to_value(UndoState { request_id: "r".into(), available: false, reason: UndoLoss::UndoKey }).unwrap(), serde_json::json!({"requestId": "r", "available": false, "reason": "undo_key"}));
        let refused = UndoOutcome { request_id: "r".into(), status: UndoStatus::Refused, confirmed: false, message: "m".into(), code: Some(ErrorKind::TargetChanged) };
        let json = serde_json::to_value(refused).unwrap();
        assert_eq!((json["status"].as_str(), json["code"].as_str()), (Some("refused"), Some("target_changed")));
        let target = PillTarget { x: 1., y: 2., side: PillSide::Below, inside: true, estimated: false, clear: true };
        assert_eq!(serde_json::to_value(target).unwrap()["side"], "below");
    }
    #[test]
    fn stale_cancel_preserves_current() {
        let mut i = Inner::new(Settings::default());
        i.active = Some(Active {
            id: "new".into(),
            cancel: CancellationToken::new(),
        });
        i.cancel(Some("old"));
        assert!(i.current("new"));
        i.cancel(Some("new"));
        assert!(!i.current("new"));
    }
    #[test]
    fn the_halo_sweeps_only_an_anchored_uia_selection_under_the_ilot() {
        let line = Rect { x: 10., y: 20., width: 300., height: 18. };
        let capture = Capture { id: "c".into(), text: "Texte".into(), source: CaptureSource::Selection, origin: CaptureOrigin::Uia, can_replace: true, anchor: Some(line), selection_rects: vec![line], screen: None, replay: None, execution: None, menu: None };
        let mut settings = Settings::default();
        settings.ui_version = UiVersion::V4;
        assert_eq!(halo_lines(&settings, &capture), None, "the 0.4 journey has no halo");
        settings.ui_version = UiVersion::Ilot;
        assert_eq!(halo_lines(&settings, &capture), Some(vec![line]));
        let moved = Capture { anchor: None, ..capture.clone() };
        assert_eq!(halo_lines(&settings, &moved), None, "an invalidated selection is not swept");
        let copied = Capture { origin: CaptureOrigin::Copy, source: CaptureSource::Clipboard, anchor: None, selection_rects: Vec::new(), ..capture };
        assert_eq!(halo_lines(&settings, &copied), None, "the copy paths have no rectangles");
    }
    #[test]
    fn cancelled_token_cannot_complete() {
        let mut i = Inner::new(Settings::default());
        let c = CancellationToken::new();
        i.active = Some(Active {
            id: "r".into(),
            cancel: c.clone(),
        });
        c.cancel();
        assert!(!i.current("r"));
    }
    #[test]
    fn stale_dismiss_ack_cannot_close_new_capture() {
        let mut i = Inner::new(Settings::default());
        i.pending_dismiss = Some(("new".into(), 8));
        assert!(!i.complete_pending_dismiss("old", 7));
        assert_eq!(i.pending_dismiss, Some(("new".into(), 8)));
        assert!(i.complete_pending_dismiss("new", 8));
    }
    #[test]
    fn the_window_never_exceeds_the_work_area_of_its_screen() {
        let work = Rect { x: 0., y: 0., width: 2560., height: 1400. };
        // Half of a 2560 px screen plus the halos, 45 % of its height plus the reserve: fits.
        assert!(fits(1344., 930., work, 1.));
        assert!(!fits(2600., 400., work, 1.));
        // At 150 % the same logical window is larger than a 1920 × 1040 work area.
        assert!(!fits(1344., 930., Rect { x: -1920., y: 40., width: 1920., height: 1040. }, 1.5));
        assert!(fits(1280., 693., Rect { x: -1920., y: 40., width: 1920., height: 1040. }, 1.5));
    }
    #[test]
    fn the_anchor_frame_must_lie_inside_the_window() {
        let frame = SurfaceRegion { x: 32., y: 34., width: 380., height: 28., radius: 0. };
        assert!(validate_frame(&frame, 444., 334.).is_ok());
        assert!(validate_frame(&SurfaceRegion { width: 420., ..frame }, 444., 334.).is_err());
        assert!(validate_frame(&SurfaceRegion { y: -1., ..frame }, 444., 334.).is_err());
    }
    #[test]
    fn regions_reject_nan_and_out_of_bounds() {
        let valid = SurfaceRegion { x: 0., y: 14., width: 280., height: 100., radius: 26. };
        assert!(validate_regions(&[valid], 280., 114.).is_ok());
        assert!(validate_regions(&[SurfaceRegion { x: f64::NAN, ..valid }], 280., 114.).is_err());
        assert!(validate_regions(&[SurfaceRegion { width: 281., ..valid }], 280., 114.).is_err());
    }
}
