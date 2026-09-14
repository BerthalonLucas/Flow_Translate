mod capture;
mod crypto;
mod history;
mod host;
mod inference;
mod placement;
mod settings;
mod types;
use arboard::Clipboard;
use chrono::Utc;
use history::HistoryStore;
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
struct Inner {
    settings: Settings,
    capture: Option<StoredCapture>,
    pending_capture: Option<Capture>,
    active: Option<Active>,
    completed: Option<CompletedResult>,
    side: Option<PlacementSide>,
    frontend_ready: bool,
    visible: bool,
    source_window: isize,
    source_rect: Option<Rect>,
    work: Rect,
    scale: f64,
    size: (f64, f64),
    manual: Option<ManualPlacement>,
    dragging: bool,
    presentation: Presentation,
    regions: Vec<SurfaceRegion>,
    pending_dismiss: Option<(String, u64)>,
    dismiss_generation: u64,
    last_overlay: Option<(Rect, Vec<SurfaceRegion>)>,
    last_capsule: Option<Option<Rect>>,
    measured: bool,
    /// Bumped by every notice: the timed hide only acts on its own generation.
    notice_generation: u64,
    /// The last complete result, kept ten minutes after its glass closed so the tray
    /// can show it again (« Revoir la dernière traduction »).
    last_result: Option<(CompletedResult, std::time::Instant)>,
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
            pending_capture: None,
            active: None,
            completed: None,
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
            size: (280., 90.),
            manual: None,
            dragging: false,
            presentation: Presentation::Contextual,
            regions: Vec::new(),
            pending_dismiss: None,
            dismiss_generation: 0,
            last_overlay: None,
            last_capsule: None,
            measured: false,
            notice_generation: 0,
            last_result: None,
        }
    }
    /// Sets the result aside for the tray before the glass state forgets it.
    fn retire_result(&mut self) {
        if let Some(result) = self.completed.take() {
            self.last_result = Some((result, std::time::Instant::now()));
        }
    }
    fn cancel(&mut self, id: Option<&str>) {
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
    fn complete_pending_dismiss(&mut self, capture_id: &str, generation: u64) -> bool {
        if self.pending_dismiss.as_ref().is_none_or(|pending| pending.0 != capture_id || pending.1 != generation) {
            return false;
        }
        self.pending_dismiss = None;
        self.capture = None;
        self.last_overlay = None;
        self.last_capsule = None;
        true
    }
}
struct AppState {
    inner: Arc<Mutex<Inner>>,
    settings_store: SettingsStore,
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

fn register_shortcut(app: &AppHandle, value: &str) -> Result<(), String> {
    let shortcut: Shortcut = value
        .parse()
        .map_err(|_| "Le raccourci n’est pas reconnu.".to_string())?;
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _, event| {
            if event.state == ShortcutState::Pressed {
                let app = app.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let state = app.state::<AppState>();
                    // Every press translates the current selection (clipboard fallback
                    // included); the docked tab brings the previous glass back on hover.
                    if let Err(message) = capture_text(app.clone(), state) {
                        capture_error(&app, &message, true);
                    }
                });
            }
        })
        .map_err(|_| "Le raccourci est déjà utilisé ou indisponible.".into())
}
#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    settings::validate(&settings)?;
    let old = state
        .inner
        .lock()
        .map_err(|_| lock_error())?
        .settings
        .clone();
    let changed = settings.shortcut != old.shortcut;
    if changed {
        register_shortcut(&app, &settings.shortcut)?;
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
        if changed {
            let _ = app.global_shortcut().unregister(settings.shortcut.as_str());
        }
        if settings.autostart != old.autostart {
            let _ = if old.autostart {
                app.autolaunch().enable()
            } else {
                app.autolaunch().disable()
            };
        }
        return Err(err);
    }
    if changed {
        let _ = app.global_shortcut().unregister(old.shortcut.as_str());
    }
    state.inner.lock().map_err(|_| lock_error())?.settings = settings.clone();
    app.emit_to("settings", "settings-changed", &settings)
        .map_err(|_| "Notification des réglages indisponible.".to_string())?;
    let mut public=settings;
    for profile in public.profiles.values_mut(){profile.api_key.clear();}
    for label in ["overlay","capsule"]{app.emit_to(label,"settings-changed",&public).map_err(|_|"Notification des réglages indisponible.".to_string())?;}
    Ok(())
}
fn store_capture(
    app: &AppHandle,
    state: &AppState,
    captured: StoredCapture,
    source: isize,
) -> Result<Capture, String> {
    let public = captured.public.clone();
    let deferred = captured.target.clone().filter(|_| !state.demo);
    // An anchored capture opens on its selection's screen; the others on the cursor's.
    let (work, scale) = host::monitor(public.anchor);
    let ready = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        i.cancel(None);
        i.retire_result();
        i.notice_generation = i.notice_generation.wrapping_add(1);
        i.side = None;
        i.capture = Some(captured);
        i.visible = true;
        i.source_window = source;
        i.source_rect = host::window_rect(source);
        i.work = work;
        i.scale = scale;
        i.size = (280., 90.);
        i.manual = None;
        i.dragging = false;
        i.presentation = Presentation::Contextual;
        i.regions.clear();
        i.pending_dismiss = None;
        i.dismiss_generation = i.dismiss_generation.wrapping_add(1);
        i.last_overlay = None;
        i.last_capsule = None;
        i.measured = false;
        if !i.frontend_ready {
            i.pending_capture = Some(public.clone());
        }
        i.frontend_ready
    };
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
    // Second step, behind the shown window: document offsets and the Win32 control
    // decide whether « Remplacer » is offered (reading a whole document can be slow).
    if let Some(target) = deferred {
        let app = app.clone();
        let capture_id = public.id.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let Some((selection_start, win32)) = capture::complete_target(&target) else { return };
            let can_replace = win32.is_some();
            let state = app.state::<AppState>();
            {
                let Ok(mut i) = state.inner.lock() else { return };
                let Some(current) = i.capture.as_mut().filter(|c| c.public.id == capture_id) else { return };
                let Some(identity) = current.target.as_mut() else { return };
                identity.selection_start = Some(selection_start);
                identity.win32 = win32;
                current.public.can_replace = can_replace;
            }
            let _ = app.emit_to("overlay", "capture-target", CaptureTarget { capture_id, can_replace });
        });
    }
    Ok(public)
}

/// The glass is transparent to the desktop: a notice is a pill alone at the bottom of
/// the cursor's screen, hidden four seconds later, or a line in the open glass. No
/// MessageBox any more (2026-09-14).
const NOTICE_SIZE: (f64, f64) = (420., 64.);
const NOTICE_MS: u64 = 4_000;
fn show_notice(app: &AppHandle, message: &str) {
    let state = app.state::<AppState>();
    let generation = {
        let Ok(mut i) = state.inner.lock() else { return };
        i.notice_generation = i.notice_generation.wrapping_add(1);
        if i.visible { None } else { Some(i.notice_generation) }
    };
    let notice = CaptureNotice { message: message.to_string() };
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
        show_notice(app, "Aucune traduction récente.");
        return Ok(());
    };
    let public = Capture {
        id: Uuid::new_v4().to_string(),
        text: result.source_text.clone(),
        source: CaptureSource::Clipboard,
        can_replace: false,
        anchor: None,
        replay: Some(Replay {
            request_id: result.request_id.clone(),
            translated_text: result.translated_text.clone(),
            mode: result.mode,
            target_language: result.target_language,
        }),
    };
    let capture_id = public.id.clone();
    store_capture(app, &state, StoredCapture { public, target: None }, host::foreground())?;
    let mut i = state.inner.lock().map_err(|_| lock_error())?;
    if i.capture.as_ref().is_some_and(|c| c.public.id == capture_id) {
        i.completed = Some(CompletedResult { capture_id, ..result });
    }
    Ok(())
}
#[tauri::command]
fn capture_text(app: AppHandle, state: State<'_, AppState>) -> Result<Capture, String> {
    let source = host::foreground();
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
    let result = store_capture(&app, &state, captured, source);
    if result.is_ok() {
        reset_tray_tooltip(&app, state.simulated);
    }
    result
}
#[tauri::command]
fn frontend_ready(state: State<'_, AppState>) -> Result<Option<Capture>, String> {
    let mut i = state.inner.lock().map_err(|_| lock_error())?;
    i.frontend_ready = true;
    Ok(i.pending_capture.take())
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
    let (profile, cancel, inner, history, demo, demo_long) = {
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
        let profile = i.settings.profile(request.mode)?.clone();
        i.cancel(None);
        i.completed = None;
        let cancel = CancellationToken::new();
        i.active = Some(Active {
            id: request.id.clone(),
            cancel: cancel.clone(),
        });
        (
            profile,
            cancel,
            state.inner.clone(),
            state.history.clone(),
            state.simulated,
            state.demo_long,
        )
    };
    tauri::async_runtime::spawn(async move {
        let id = request.id.clone();
        let result = if demo {
            let output = if demo_long {
                "Voici une réponse synthétique suffisamment longue pour exercer le lecteur bas. Elle contient plusieurs phrases, des retours naturels et assez de texte pour vérifier que la surface principale reste stable lorsque la pilule et le menu se chevauchent visuellement. Aucun appel d’inférence réel n’est effectué dans ce mode de démonstration."
            } else { match request.target_language {
                Language::Fr => "Pourriez-vous envoyer la proposition mise à jour avant jeudi ?",
                Language::En => "Could you send the updated proposal before Thursday?",
            }};
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
                            },
                        );
                    }
                }
                tokio::select! {_=cancel.cancelled()=>break,_=tokio::time::sleep(std::time::Duration::from_millis(65))=>{}}
            }
            if cancel.is_cancelled() {
                Err("Traduction annulée.".into())
            } else {
                Ok(out)
            }
        } else {
            inference::stream(
                profile,
                request.text.clone(),
                request.target_language,
                cancel,
                |chunk| {
                    let i = inner.lock().map_err(|_| lock_error())?;
                    if !i.current(&id) {
                        return Err("Requête remplacée.".into());
                    }
                    app.emit_to(
                        "overlay",
                        "translation",
                        StreamEvent {
                            request_id: id.clone(),
                            kind: chunk.kind,
                            text: chunk.text,
                            message: chunk.message,
                        },
                    )
                    .map_err(|_| "Flux d’affichage indisponible.".into())
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
        match result {
            Ok(text) => {
                i.completed = Some(CompletedResult {
                    request_id: id.clone(),
                    capture_id: request.capture_id,
                    source_text: request.text.clone(),
                    translated_text: text.clone(),
                    target_language: request.target_language,
                    mode: request.mode,
                    complete: true,
                });
                i.active = None;
                if i.settings.history_enabled && !demo {
                    let _ = history.add(&HistoryEntry {
                        id: Uuid::new_v4().to_string(),
                        source_text: request.text,
                        translated_text: text,
                        target_language: request.target_language,
                        mode: request.mode,
                        created_at: Utc::now().to_rfc3339(),
                    });
                }
                let _ = app.emit_to(
                    "overlay",
                    "translation",
                    StreamEvent {
                        request_id: id,
                        kind: StreamKind::Done,
                        text: None,
                        message: None,
                    },
                );
            }
            Err(message) => {
                i.active = None;
                let _ = app.emit_to(
                    "overlay",
                    "translation",
                    StreamEvent {
                        request_id: id,
                        kind: StreamKind::Error,
                        text: None,
                        message: Some(message),
                    },
                );
            }
        }
    });
    Ok(())
}
#[tauri::command]
fn cancel_translation(state: State<'_, AppState>, request_id: String) -> Result<(), String> {
    state
        .inner
        .lock()
        .map_err(|_| lock_error())?
        .cancel(Some(&request_id));
    Ok(())
}
fn result_for(state: &AppState, id: &str) -> Result<CompletedResult, String> {
    let i = state.inner.lock().map_err(|_| lock_error())?;
    i.completed
        .clone()
        .filter(|r| r.request_id == id && r.complete && i.visible)
        .ok_or_else(|| "Aucun résultat complet pour cette requête.".into())
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
#[tauri::command]
async fn replace_result(state: State<'_, AppState>, request_id: String) -> Result<(), String> {
    let r = result_for(&state, &request_id)?;
    let target = {
        let i = state.inner.lock().map_err(|_| lock_error())?;
        let c = i
            .capture
            .as_ref()
            .filter(|c| c.public.id == r.capture_id && c.public.can_replace)
            .ok_or_else(|| "La cible modifiable n’est plus valide. Utilisez Copier.".to_string())?;
        c.target
            .clone()
            .ok_or_else(|| "La cible modifiable n’est plus valide.".to_string())?
    };
    // UI Automation uses an MTA worker, never the WebView's STA UI thread.
    tauri::async_runtime::spawn_blocking(move || capture::replace(&target, &r.translated_text))
        .await.map_err(|_| "Le remplacement a été interrompu. Utilisez Copier.".to_string())?
}
fn schedule_finish_dismiss(app: AppHandle, capture_id: String, generation: u64) -> Result<(), String> {
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let state = handle.state::<AppState>();
        let should_hide = state.inner.lock().map(|mut i| i.complete_pending_dismiss(&capture_id, generation)).unwrap_or(false);
        if should_hide {
            for label in ["overlay", "capsule"] {
                if let Some(window) = handle.get_webview_window(label) { let _ = host::hide(&window); }
            }
        }
    }).map_err(|_| "Fermeture de la traduction indisponible.".to_string())
}

fn dismiss(app: &AppHandle, state: &AppState) -> Result<(), String> {
    host::close_escape_scope();
    let pending = {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if i.pending_dismiss.is_some() { return Ok(()); }
        let capture_id = i.capture.as_ref().map(|capture| capture.public.id.clone());
        i.cancel(None);
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
#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
    let w = app
        .get_webview_window("settings")
        .ok_or_else(|| "Réglages indisponibles.".to_string())?;
    w.show()
        .and_then(|_| w.set_focus())
        .map_err(|_| "Ouverture des réglages impossible.".into())
}
#[tauri::command]
fn resize_settings(window: tauri::WebviewWindow, height: f64) -> Result<(), String> {
    // The settings window has no system frame: its height follows the React content,
    // capped to the work area so the document scrolls instead of leaving the screen.
    if window.label() != "settings" { return Err("Fenêtre inattendue.".into()); }
    if !height.is_finite() || height < 120. || height > 2000. { return Err("Hauteur invalide.".into()); }
    let scale = window.scale_factor().map_err(|_| "Fenêtre indisponible.".to_string())?;
    let (work, _) = host::monitor(host::window_rect(host::handle(&window)));
    let logical_height = height.min((work.height / scale - 40.).max(120.)).round();
    window
        .set_size(tauri::LogicalSize::new(520., logical_height))
        .map_err(|_| "Redimensionnement indisponible.".to_string())
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
#[tauri::command]
fn focus_overlay(app: AppHandle) -> Result<(), String> {
    let capture_id = {
        let state = app.state::<AppState>();
        let i = state.inner.lock().map_err(|_| lock_error())?;
        if !i.visible || i.pending_dismiss.is_some() {
            return Err("La capture n’est plus active.".into());
        }
        i.capture
            .as_ref()
            .map(|capture| capture.public.id.clone())
            .ok_or_else(|| "La capture n’est plus active.".to_string())?
    };
    let w = app
        .get_webview_window("overlay")
        .ok_or_else(|| "Traduction indisponible.".to_string())?;
    host::activate(&w)?;
    let (current, should_hide) = {
        let state = app.state::<AppState>();
        let i = state.inner.lock().map_err(|_| lock_error())?;
        let current = i.visible
            && i.pending_dismiss.is_none()
            && i.capture
                .as_ref()
                .is_some_and(|capture| capture.public.id == capture_id);
        let should_hide = !i.visible || i.pending_dismiss.is_some() || i.capture.is_none();
        (current, should_hide)
    };
    if !current {
        if should_hide {
            let _ = host::hide(&w);
        }
        return Err("La capture n’est plus active.".into());
    }
    Ok(())
}
#[tauri::command]
async fn resize_overlay(
    app: AppHandle,
    state: State<'_, AppState>,
    width: f64,
    height: f64,
    capture_id: Option<String>,
    presentation: Option<Presentation>,
    regions: Option<Vec<SurfaceRegion>>,
) -> Result<(), String> {
    // The window reserves the menu and, docked, the enlarged glass: 484 × 758 at rest.
    if !width.is_finite() || !height.is_finite() || width <= 0. || height <= 0. || width > 640. || height > 800. {
        return Err("Dimensions invalides.".into());
    }
    if let Some(items) = regions.as_ref() { validate_regions(items, width, height)?; }
    {
        let mut i = state.inner.lock().map_err(|_| lock_error())?;
        if capture_id.as_ref().is_some_and(|id| i.capture.as_ref().is_none_or(|capture| &capture.public.id != id)) {
            return Ok(());
        }
        if let Some(presentation) = presentation { i.presentation = presentation; }
        if let Some(regions) = regions { i.regions = regions; i.measured = true; }
    }
    let (placed_tx, placed_rx) = tokio::sync::oneshot::channel();
    position(&app, &state, width, height, Some(placed_tx))?;
    placed_rx.await.map_err(|_| "Placement interrompu.".to_string())?
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
        },
        Err(message) => ConnectionStatus {
            connected: false,
            message,
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
    let (capture_id, rect, capsule, scale, regions, apply_rect, apply_regions, apply_capsule) = {
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
        let surface = regions.first().copied().unwrap_or(SurfaceRegion { x: 0., y: 0., width, height, radius: 28. });
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
        // Docked glass and unanchored captures rest bottom-centre on the tab; the capsule
        // window is no longer shown. Anchored glass keeps its drag position or its anchor.
        // How far the window reaches below the glass top: the menu space reserved under
        // the pill counts when the side is chosen (the glass would otherwise be pushed up
        // over its anchor by the clamp near the bottom edge).
        let extent = h - surface.y * s;
        let mut regions = regions;
        let result: (Rect, Option<Rect>, f64) = match (i.presentation == Presentation::Docked || cap.anchor.is_none(), i.manual, cap.anchor) {
            (true, _, _) | (_, _, None) => {
                let rect = placement::docked(work, w, h);
                // A work area shorter than the reserved window truncates it from the top
                // while the frontend keeps its root on the window's bottom edge.
                if rect.height < h {
                    regions = shift_regions(&regions, (rect.height - h) / s);
                }
                (rect, None, s)
            }
            (false, Some(manual), _) => (to_host(Rect { x: manual.x, y: manual.y, width: glass_w, height: glass_h }), None, s),
            (false, None, Some(anchor)) => {
                // Design « 1a »: compact and enlarged glass share the anchored top-left
                // corner; a larger glass is shifted by the clamp, never recentred.
                if i.side.is_none() {
                    i.side = Some(placement::overlay(anchor, work, glass_w, 220. * s, extent, None).1);
                }
                let (glass, side) = placement::overlay(anchor, work, glass_w, glass_h, extent, i.side);
                i.side = Some(side);
                (to_host(glass), None, s)
            }
        };
        let apply_rect = i.last_overlay.as_ref().is_none_or(|last| last.0 != result.0);
        let apply_regions = i.last_overlay.as_ref().is_none_or(|last| last.1 != regions);
        let apply_capsule = i.last_capsule.as_ref() != Some(&result.1);
        (capture_id, result.0, result.1, result.2, regions, apply_rect, apply_regions, apply_capsule)
    };
    finish_position(app, capture_id, rect, capsule, scale, regions, apply_rect, apply_regions, apply_capsule, placed)
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
    capsule: Option<Rect>,
    scale: f64,
    regions: Vec<SurfaceRegion>,
    apply_rect: bool,
    apply_regions: bool,
    apply_capsule: bool,
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
          if apply_capsule {
            if let Some(window) = handle.get_webview_window("capsule") {
                if let Some(capsule) = capsule { host::show(&window, capsule, &[], scale)?; }
                else { host::hide(&window)?; }
            } else {
                return Err("Capsule indisponible.".into());
            }
          }
          host::escape_scope(source_window,
            handle.get_webview_window("overlay").map(|window|host::handle(&window)).unwrap_or(0),
            handle.get_webview_window("capsule").map(|window|host::handle(&window)).unwrap_or(0));
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
          if apply_capsule { i.last_capsule = Some(capsule); }
          Ok(())
        })();
        if let Some(placed) = placed { let _ = placed.send(result); }
    }).map_err(|_| "Placement indisponible.".to_string())
}
fn reset_tray_tooltip(app: &AppHandle, simulated: bool) {
    if let Some(tray) = app.tray_by_id("flowtranslate") {
        let tooltip = if simulated {
            "FlowTranslate — Démonstration simulée"
        } else {
            "FlowTranslate"
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}
fn capture_error(app: &AppHandle, message: &str, notify: bool) {
    if let Some(tray) = app.tray_by_id("flowtranslate") {
        let _ = tray.set_tooltip(Some(format!("FlowTranslate — {message}")));
    }
    if notify {
        show_notice(app, message);
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
                (i.source_window, i.source_rect, i.capture.clone(), i.size)
            };
            let fg = host::foreground();
            let ours = ["overlay", "capsule"].iter().any(|l| {
                app.get_webview_window(l)
                    .is_some_and(|w| host::belongs_to(&w, fg))
            });
            let down = host::escape_down();
            if host::take_escape() || (down && !escape_was_down && (fg == snapshot.0 || ours)) {
                let _ = dismiss(&app, &state);
            }
            escape_was_down = down;
            if ticks % 12 != 0 || state.demo {
                continue;
            }
            let Some(captured) = snapshot.2 else { continue };
            if captured.public.anchor.is_none() {
                continue;
            }
            let moved = host::window_rect(snapshot.0) != snapshot.1;
            let switched = fg != snapshot.0 && !ours;
            let changed = fg == snapshot.0
                && captured
                    .target
                    .as_ref()
                    .is_some_and(|t| capture::validate_target(t).is_err());
            if moved || switched || changed {
                let id = captured.public.id;
                {
                    let Ok(mut i) = state.inner.lock() else {
                        continue;
                    };
                    if let Some(c) = i.capture.as_mut().filter(|c| c.public.id == id) {
                        c.public.anchor = None;
                        c.public.can_replace = false;
                        c.target = None;
                    } else {
                        continue;
                    }
                    i.side = None;
                }
                let _ = app.emit_to(
                    "overlay",
                    "target-invalidated",
                    TargetInvalidated {
                        capture_id: id,
                        anchor_lost: true,
                        message: "La sélection a changé. Utilisez Copier.".into(),
                    },
                );
                let _ = position(&app, &state, snapshot.3 .0, snapshot.3 .1, None);
            }
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let _ = open_settings(app.clone());
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            let root = app.path().app_data_dir()?;
            let store = SettingsStore::new(&root);
            let settings = store.load()?;
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
            let shortcut = settings.shortcut.clone();
            let simulated = demo || args.iter().any(|a| a == "--simulate-inference");
            app.manage(AppState {
                inner: Arc::new(Mutex::new(Inner::new(settings))),
                settings_store: store,
                history,
                demo,
                demo_clipboard,
                demo_long,
                simulated,
            });
            // Commands may arrive as soon as the WebView loads. State must exist first.
            for config in app.config().app.windows.clone() {
                tauri::WebviewWindowBuilder::from_config(app, &config)?.build()?;
            }
            use tauri::{
                menu::{Menu, MenuItem},
                tray::TrayIconBuilder,
            };
            let replay = MenuItem::with_id(app, "replay", "Revoir la dernière traduction", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Réglages", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&replay, &settings_item, &quit])?;
            let mut tray = TrayIconBuilder::with_id("flowtranslate")
                .tooltip(if simulated {
                    "FlowTranslate — Démonstration simulée"
                } else {
                    "FlowTranslate"
                })
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "replay" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            if let Err(message) = replay_last(&app) {
                                capture_error(&app, &message, true);
                            }
                        });
                    }
                    "settings" => {
                        let _ = open_settings(app.clone());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            for label in ["overlay", "capsule"] {
                if let Some(w) = app.get_webview_window(label) {
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
            }
            host::start_hit_tester(app.handle().clone(), app.get_webview_window("overlay").map(|w| host::handle(&w)).unwrap_or(0));
            if let Some(w) = app.get_webview_window("settings") {
                let window = w.clone();
                w.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                });
            }
            if let Err(message) = register_shortcut(app.handle(), &shortcut) {
                capture_error(app.handle(), &message, false);
                let _ = open_settings(app.handle().clone());
            }
            host::install_escape_hook()?;
            watch_context(app.handle().clone());
            if demo {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let state = handle.state::<AppState>();
                    let _ = capture_text(handle.clone(), state);
                });
            }
            if args.iter().any(|a| a == "--settings") {
                let _ = open_settings(app.handle().clone());
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
            dismiss_overlay,
            complete_overlay_dismiss,
            open_settings,
            focus_overlay,
            override_cursor,
            resize_overlay,
            resize_settings,
            drag_settings,
            quit_app,
            start_drag,
            check_connection,
            get_history,
            delete_history
        ])
        .run(tauri::generate_context!())
        .expect("Impossible de démarrer FlowTranslate");
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn regions_reject_nan_and_out_of_bounds() {
        let valid = SurfaceRegion { x: 0., y: 14., width: 280., height: 100., radius: 26. };
        assert!(validate_regions(&[valid], 280., 114.).is_ok());
        assert!(validate_regions(&[SurfaceRegion { x: f64::NAN, ..valid }], 280., 114.).is_err());
        assert!(validate_regions(&[SurfaceRegion { width: 281., ..valid }], 280., 114.).is_err());
    }
}
