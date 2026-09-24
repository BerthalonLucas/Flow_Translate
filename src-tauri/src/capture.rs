use crate::selection_lines;
use crate::types::{Capture, CaptureOrigin, CaptureSource, Rect, StoredCapture, TargetIdentity};
use arboard::Clipboard;
use uiautomation::{patterns::UITextPattern, variants::SafeArray, UIAutomation, UIElement};
use uiautomation::{patterns::UIValuePattern, types::TextAttribute};
use uuid::Uuid;
use std::time::{Duration, Instant};

/// A copy the user made himself counts as fresh this long (Lucas, 2026-09-14).
const FRESH_COPY_MS: u64 = 3_000;
/// The shortcut chord must be released before a synthetic chord is sent.
const CHORD_RELEASE: Duration = Duration::from_millis(600);
/// How long the target may take to serve the synthetic copy.
const COPY_SETTLE: Duration = Duration::from_millis(350);
/// Our own clipboard traffic (copy, restoration) is invisible to the freshness watcher.
const OWN_TRAFFIC: Duration = Duration::from_millis(1_500);
/// After the paste chord: how long a readable field gets to show the result, and the
/// least time the target keeps our clipboard when nothing can read it back.
const PASTE_CONFIRM: Duration = Duration::from_millis(800);
const PASTE_SETTLE: Duration = Duration::from_millis(300);

thread_local! {
    // uiautomation::UIAutomation::new initializes COM every time without balancing
    // that call. The context watcher validates several times per second, so retain
    // one automation client per MTA worker thread instead of growing that count.
    static UI_AUTOMATION: std::cell::OnceCell<UIAutomation> = const { std::cell::OnceCell::new() };
}

fn ui_automation() -> Result<UIAutomation, ()> {
    UI_AUTOMATION.with(|cell| {
        if let Some(automation) = cell.get() {
            return Ok(automation.clone());
        }
        let automation = UIAutomation::new().map_err(|_| ())?;
        let _ = cell.set(automation.clone());
        Ok(automation)
    })
}

/// What `selection` answers when the control is readable but holds no selection (none,
/// or collapsed to the caret by a click or an arrow key).
const NO_SELECTION: &str = "Aucune sélection active.";

/// Text, visible rectangles (physical, one per run as `GetBoundingRectangles` gives
/// them), length and editability of the current UIA selection.
fn selection(element: &UIElement) -> Result<(String, Vec<Rect>, usize, bool), String> {
    let pattern = element
        .get_pattern::<UITextPattern>()
        .map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?;
    let range = pattern
        .get_selection()
        .map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?
        .into_iter()
        .next()
        .ok_or_else(|| NO_SELECTION.to_string())?;
    let text = range
        .get_text(6001)
        .map_err(|_| "Impossible de lire la sélection.".to_string())?;
    if text.is_empty() {
        return Err(NO_SELECTION.into());
    }
    if text.encode_utf16().count() >= 6001 {
        return Err("La sélection dépasse 6 000 unités de texte et pourrait être tronquée.".into());
    }
    let selection_len = text.chars().count();
    let range_editable = range
        .get_attribute_value(TextAttribute::IsReadOnly)
        .ok()
        .and_then(|v| <uiautomation::variants::Variant as TryInto<bool>>::try_into(v).ok())
        .is_some_and(|v| !v);
    let rects = unsafe { range.as_ref().GetBoundingRectangles() }
        .ok()
        .and_then(|raw| <SafeArray as TryInto<Vec<f64>>>::try_into(SafeArray::from(raw)).ok())
        .map(|values| selection_lines::from_flat(&values))
        .unwrap_or_default();
    Ok((text, rects, selection_len, range_editable))
}

/// The anchor of a capture: the last visible rectangle as UI Automation gives it (none
/// when that one is unusable). Physical; the placement and `validate_target` compare it.
fn anchor_of(rects: &[Rect]) -> Option<Rect> {
    rects.last().copied().filter(selection_lines::drawable)
}

fn ensure_source_unchanged(source_window: isize) -> Result<(), String> {
    if source_window == 0 || crate::host::foreground() != source_window {
        return Err("La fenêtre source a changé pendant la capture. Réessayez.".into());
    }
    Ok(())
}

/// Whether a paste can replace what was captured (0.4.0, decided at the capture): the
/// selection UI Automation gave in an editable control, or the selection the synthetic
/// copy proved (a copy needs one). A copy the user made himself guarantees no selection;
/// a console never replaces its selection on Ctrl+V; a password field is never written.
pub fn replaceable(origin: CaptureOrigin, editable: bool, window_class: &str, password: bool) -> bool {
    if password || crate::host::is_console_class(window_class) { return false; }
    match origin {
        CaptureOrigin::Uia => editable,
        CaptureOrigin::Copy => true,
        CaptureOrigin::Fresh | CaptureOrigin::Replay | CaptureOrigin::Demo => false,
    }
}

pub fn capture_current(demo: bool, source_window: isize) -> Result<StoredCapture, String> {
    if demo {
        let public = Capture {
            id: Uuid::new_v4().to_string(),
            text: "Bonjour, ceci est une démonstration FlowTranslate.".into(),
            source: CaptureSource::Selection,
            origin: CaptureOrigin::Demo,
            can_replace: false,
            screen: None,
            anchor: Some(Rect {
                x: 640.0,
                y: 420.0,
                width: 280.0,
                height: 24.0,
            }),
            // Two lines ending on the anchor: the halo is exercised without UI Automation.
            selection_rects: vec![
                Rect { x: 640.0, y: 396.0, width: 360.0, height: 24.0 },
                Rect { x: 640.0, y: 420.0, width: 280.0, height: 24.0 },
            ],
            replay: None,
            execution: None,
            menu: None,
        };
        return Ok(StoredCapture {
            public,
            target: None,
        });
    }
    let source_class = crate::host::window_class(source_window);
    if let Ok(automation) = ui_automation() {
        if let Ok(element) = automation.get_focused_element() {
            match element.is_password() {
                Ok(true) => {
                    return Err("La capture est refusée dans un champ protégé.".into());
                }
                Err(_) => {
                    return Err(
                        "Impossible de vérifier si le champ actif est protégé; capture refusée."
                            .into(),
                    );
                }
                Ok(false) => {}
            }
            match selection(&element) {
                Ok((text, rects, selection_len, range_editable)) => {
                    ensure_source_unchanged(source_window)?;
                    let anchor = anchor_of(&rects);
                    let selection_rects = selection_lines::lines(&rects, crate::host::window_rect(source_window));
                    let runtime_id = element.get_runtime_id().map_err(|_| {
                        "Impossible d’identifier le contrôle source.".to_string()
                    })?;
                    let value_editable = element
                        .get_pattern::<UIValuePattern>()
                        .ok()
                        .and_then(|p| p.is_readonly().ok())
                        .is_some_and(|v| !v);
                    let editable = source_window != 0 && (value_editable || range_editable);
                    let control = crate::host::focused_control(source_window).map_or(0, |(handle, _)| handle);
                    let can_replace = replaceable(CaptureOrigin::Uia, editable, &source_class, false);
                    let public = Capture {
                        id: Uuid::new_v4().to_string(),
                        text: text.clone(),
                        source: CaptureSource::Selection,
                        origin: CaptureOrigin::Uia,
                        can_replace,
                        anchor,
                        selection_rects,
                        screen: None,
                        replay: None,
                        execution: None,
                        menu: None,
                    };
                    let target = Some(TargetIdentity {
                        runtime_id: Some(runtime_id),
                        native_window: source_window,
                        control,
                        selected_text: text,
                        anchor,
                        selection_len,
                        editable,
                    });
                    ensure_source_unchanged(source_window)?;
                    return Ok(StoredCapture { public, target });
                }
                Err(message) if message.contains("6 000") => return Err(message),
                Err(_) => {}
            }
        }
    }
    clipboard_capture(source_window, &source_class)
}

/// A copy made at `changed_at` is fresh at `now` when it is at most `limit` ms old.
pub fn fresh(changed_at: Option<u64>, now: u64, limit: u64) -> bool {
    changed_at.is_some_and(|at| at <= now && now - at <= limit)
}

fn read_clipboard() -> Option<String> {
    Clipboard::new().and_then(|mut c| c.get_text()).ok()
}

/// Without a UIA selection: copies for the user (synthetic Ctrl+Insert), else accepts a
/// copy he made himself in the last three seconds, else nothing to translate. A copy
/// that worked proves a selection: it can be pasted over (origin `copy`).
fn clipboard_capture(source_window: isize, source_class: &str) -> Result<StoredCapture, String> {
    let pressed_at = crate::host::now_ms();
    let changed_at = crate::host::clipboard_changed_at();
    let copied = synthetic_copy(source_window);
    let (text, origin) = match &copied {
        Ok(text) => (Some(text.clone()), CaptureOrigin::Copy),
        Err(_) => (fresh(changed_at, pressed_at, FRESH_COPY_MS).then(read_clipboard).flatten(), CaptureOrigin::Fresh),
    };
    let text = text
        .filter(|text| !text.trim().is_empty())
        .ok_or_else(|| {
            let mut message = "Rien à traduire dans la fenêtre active.".to_string();
            // For the real capture matrix only (FLOWTRANSLATE_CAPTURE_TRACE): which step of
            // the synthetic copy gave up and how old the user's last copy is. Never any text.
            if std::env::var_os("FLOWTRANSLATE_CAPTURE_TRACE").is_some() {
                let age = changed_at.map(|at| pressed_at.saturating_sub(at));
                message.push_str(&format!(" [copy: {}; last user copy: {:?} ms ago]", copied.as_ref().err().copied().unwrap_or("ok"), age));
            }
            message
        })?;
    if text.chars().count() > 6000 {
        return Err("Sélection trop longue (6 000 caractères).".into());
    }
    ensure_source_unchanged(source_window)?;
    let can_replace = replaceable(origin, true, source_class, false);
    let target = can_replace.then(|| TargetIdentity {
        runtime_id: ui_automation().ok().and_then(|a| a.get_focused_element().ok()).and_then(|e| e.get_runtime_id().ok()),
        native_window: source_window,
        control: crate::host::focused_control(source_window).map_or(0, |(handle, _)| handle),
        selected_text: text.clone(),
        anchor: None,
        selection_len: text.chars().count(),
        editable: true,
    });
    let public = Capture {
        id: Uuid::new_v4().to_string(),
        text,
        source: CaptureSource::Clipboard,
        origin,
        can_replace,
        anchor: None,
        selection_rects: Vec::new(),
        screen: None,
        replay: None,
        execution: None,
        menu: None,
    };
    Ok(StoredCapture { public, target })
}

/// Sends the copy chord to the source window and reads what it copied, then puts the
/// previous clipboard back (every format when Windows lets us keep them, else the text)
/// unless something else wrote the clipboard in between (SPEC: restoration never
/// overwrites newer content). The error names the step that gave up, for the matrix.
fn synthetic_copy(source_window: isize) -> Result<String, &'static str> {
    if source_window == 0 || crate::host::foreground() != source_window {
        return Err("source window lost");
    }
    let keeper = crate::clipboard_guard::Keeper::take(read_clipboard);
    crate::host::suppress_clipboard_tracking(OWN_TRAFFIC);
    let before = crate::host::clipboard_sequence();
    if !crate::host::wait_modifiers_released(CHORD_RELEASE) {
        return Err("modifiers still down");
    }
    if crate::host::foreground() != source_window {
        return Err("source window lost after the chord");
    }
    crate::host::send_copy_chord().map_err(|_| "SendInput refused")?;
    let after = crate::host::wait_clipboard_change(before, COPY_SETTLE).ok_or("no clipboard change")?;
    let copied = read_clipboard().filter(|text| !text.trim().is_empty());
    let _ = keeper.restore(after);
    copied.ok_or("copied nothing readable")
}

/// The identity check before a paste and for the watcher: the source window is still in
/// front, its focused control is the same and, when UI Automation gave the selection,
/// the focused element and its selection are unchanged. A UIA that stopped answering is
/// not a change (the paste goes to the same control).
pub fn validate_target(target: &TargetIdentity) -> Result<(), String> {
    if crate::host::foreground() != target.native_window {
        return Err("La fenêtre source a changé; remplacement refusé.".into());
    }
    if target.control != 0 && crate::host::focused_control(target.native_window).is_some_and(|(handle, _)| handle != target.control) {
        return Err("Le champ actif a changé; remplacement refusé.".into());
    }
    let Some(runtime_id) = &target.runtime_id else { return Ok(()) };
    let Some(element) = ui_automation().ok().and_then(|a| a.get_focused_element().ok()) else { return Ok(()) };
    if element.get_runtime_id().is_ok_and(|id| id != *runtime_id) {
        return Err("La cible a changé; remplacement refusé.".into());
    }
    if target.anchor.is_none() { return Ok(()); }
    if selection_changed(target, &selection(&element)) {
        return Err("La sélection a changé; remplacement refusé.".into());
    }
    Ok(())
}

/// Whether what UI Automation answers now differs from the captured selection: another
/// text, length or last rectangle, or no selection at all while the control still answers
/// (a click or an arrow collapsed it to the caret: a paste would insert there instead of
/// replacing). A control that stopped answering is not a change.
fn selection_changed(target: &TargetIdentity, now: &Result<(String, Vec<Rect>, usize, bool), String>) -> bool {
    match now {
        Ok((text, rects, selection_len, _)) => *text != target.selected_text || *selection_len != target.selection_len || target.anchor != anchor_of(rects),
        Err(message) => message == NO_SELECTION,
    }
}

/// How a paste ended: the field read the result back (`confirmed`), or the chord went
/// through and nothing could read the field (assumed, like Wispr Flow).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Delivery { pub confirmed: bool }

/// Line endings and the non-breaking spaces Chromium makes of boundary spaces in a
/// contenteditable: the readback proof only, never the identity checks.
pub fn canonical(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n").replace('\u{a0}', " ")
}

/// Whether a field's readback shows the pasted value (None: nothing readable).
pub fn readback_confirms(field_text: Option<&str>, value: &str) -> Option<bool> {
    field_text.map(|text| canonical(text).contains(&canonical(value)))
}

/// Reads the focused field: UI Automation first (its value, else its document), then
/// WM_GETTEXT on a Win32 Edit/RichEdit control. None when nothing can read it.
fn field_text(target: &TargetIdentity) -> Option<String> {
    if let Some(element) = ui_automation().ok().and_then(|a| a.get_focused_element().ok()) {
        if let Ok(value) = element.get_pattern::<UIValuePattern>().and_then(|p| p.get_value()) {
            return Some(value);
        }
        if let Ok(document) = element.get_pattern::<UITextPattern>().and_then(|p| p.get_document_range()).and_then(|r| r.get_text(200_000)) {
            return Some(document);
        }
    }
    #[cfg(windows)]
    {
        let (control, class) = crate::host::focused_control(target.native_window)?;
        let lower = class.to_ascii_lowercase();
        if lower == "edit" || lower.starts_with("richedit") {
            return control_text(control).ok();
        }
    }
    #[cfg(not(windows))]
    let _ = target;
    None
}

/// Pastes `value` over the captured selection (0.4.0, the Wispr Flow route): checks the
/// identity, waits for the shortcut chord to be released, keeps the clipboard, writes
/// the result, sends one Ctrl+V, then reads the field back when something can read it
/// and puts the clipboard back while it still holds our write. `reactivate` (the menu
/// of the glass) brings the source window back to the front first.
pub fn paste(target: &TargetIdentity, value: &str, reactivate: bool) -> Result<Delivery, String> {
    if value.contains('\0') { return Err("Le résultat contient un caractère nul; remplacement refusé.".into()); }
    if !target.editable { return Err("Ce champ n’est pas modifiable; utilisez Copier.".into()); }
    #[cfg(windows)]
    if reactivate && crate::host::foreground() != target.native_window {
        use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::SetForegroundWindow};
        // Not under a held chord: released over the source, Alt would first move its
        // focus to its menu bar (Win11 Notepad) and the revalidation would refuse.
        if !crate::host::wait_modifiers_released(CHORD_RELEASE) {
            return Err("Relâchez les touches du raccourci, puis réessayez depuis la bulle.".into());
        }
        if !unsafe { SetForegroundWindow(HWND(target.native_window as *mut _)) }.as_bool() {
            return Err("Impossible de réactiver la fenêtre source; utilisez Copier.".into());
        }
        std::thread::sleep(Duration::from_millis(60));
    }
    #[cfg(not(windows))]
    let _ = reactivate;
    validate_target(target)?;
    if !crate::host::wait_modifiers_released(CHORD_RELEASE) {
        return Err("Relâchez les touches du raccourci, puis réessayez depuis la bulle.".into());
    }
    validate_target(target)?;
    let keeper = crate::clipboard_guard::Keeper::take(read_clipboard);
    crate::host::suppress_clipboard_tracking(Duration::from_secs(4));
    let sequence = keeper.put_text(value)?;
    if let Err(error) = validate_target(target) {
        let _ = keeper.restore(sequence);
        return Err(error);
    }
    if let Err(sent) = crate::host::send_paste_chord() {
        if sent == 0 { let _ = keeper.restore(sequence); }
        return Err("Le collage a été bloqué par Windows ou par l’application; utilisez Copier.".into());
    }
    let started = Instant::now();
    let mut readable = true;
    let confirmed = loop {
        match readback_confirms(field_text(target).as_deref(), value) {
            Some(true) => break true,
            Some(false) => {}
            None => readable = false,
        }
        let elapsed = started.elapsed();
        if (!readable && elapsed >= PASTE_SETTLE) || elapsed >= PASTE_CONFIRM { break false; }
        std::thread::sleep(Duration::from_millis(40));
    };
    if started.elapsed() < PASTE_SETTLE { std::thread::sleep(PASTE_SETTLE - started.elapsed()); }
    let _ = keeper.restore(sequence);
    Ok(Delivery { confirmed })
}

#[cfg(windows)]
fn control_text(hwnd: isize) -> Result<String, String> {
    use windows::Win32::{Foundation::{HWND, LPARAM, WPARAM}, UI::WindowsAndMessaging::{SendMessageTimeoutW, SMTO_ABORTIFHUNG, SMTO_BLOCK, WM_GETTEXT, WM_GETTEXTLENGTH}};
    let hwnd = HWND(hwnd as *mut _);
    let message = |msg: u32, wparam: usize, lparam: isize| -> Result<usize, String> {
        let mut result = 0usize;
        let sent = unsafe { SendMessageTimeoutW(hwnd, msg, WPARAM(wparam), LPARAM(lparam), SMTO_ABORTIFHUNG | SMTO_BLOCK, 250, Some(&mut result)) };
        if sent.0 == 0 { Err("Le contrôle source ne répond pas.".into()) } else { Ok(result) }
    };
    let len = message(WM_GETTEXTLENGTH, 0, 0)?;
    if len > 200_000 { return Err("Le document source est trop volumineux.".into()); }
    let mut text = vec![0u16; len + 1];
    let copied = message(WM_GETTEXT, text.len(), text.as_mut_ptr() as isize)?;
    text.truncate(copied.min(len));
    Ok(String::from_utf16_lossy(&text))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_selection_collapsed_to_the_caret_is_a_change_but_a_silent_control_is_not() {
        let line = Rect { x: 100., y: 200., width: 300., height: 18. };
        let target = TargetIdentity { runtime_id: Some(vec![1]), native_window: 1, control: 0, selected_text: "Deux lignes".into(), anchor: Some(line), selection_len: 11, editable: true };
        let same: Result<(String, Vec<Rect>, usize, bool), String> = Ok(("Deux lignes".into(), vec![Rect { y: 182., ..line }, line], 11, true));
        assert!(!selection_changed(&target, &same));
        assert!(selection_changed(&target, &Err(NO_SELECTION.into())), "collapsed by a click: a paste would insert at the caret");
        assert!(selection_changed(&target, &Ok(("Deux lignes".into(), vec![Rect { y: 230., ..line }], 11, true))), "scrolled: the anchor moved");
        assert!(selection_changed(&target, &Ok(("Autre".into(), vec![line], 5, true))));
        assert!(!selection_changed(&target, &Err("La sélection n’est pas accessible par UI Automation.".into())), "a control that stopped answering is not a change");
    }

    #[test]
    fn a_paste_replaces_a_uia_selection_or_a_proved_copy_but_never_a_console_or_a_password() {
        assert!(replaceable(CaptureOrigin::Uia, true, "Chrome_WidgetWin_1", false));
        assert!(!replaceable(CaptureOrigin::Uia, false, "Chrome_WidgetWin_1", false));
        assert!(replaceable(CaptureOrigin::Copy, true, "Notepad", false));
        assert!(!replaceable(CaptureOrigin::Copy, true, "CASCADIA_HOSTING_WINDOW_CLASS", false));
        assert!(!replaceable(CaptureOrigin::Copy, true, "ConsoleWindowClass", false));
        assert!(!replaceable(CaptureOrigin::Uia, true, "Edit", true));
        for origin in [CaptureOrigin::Fresh, CaptureOrigin::Replay, CaptureOrigin::Demo] {
            assert!(!replaceable(origin, true, "Notepad", false));
        }
    }

    #[test]
    fn the_readback_proof_tolerates_line_endings_and_editor_spaces_only() {
        assert_eq!(readback_confirms(Some("Début\u{a0}équipe\r\nfin"), "Début équipe\nfin"), Some(true));
        assert_eq!(readback_confirms(Some("avant équipe après"), "équipe"), Some(true));
        assert_eq!(readback_confirms(Some("deux  espaces"), "deux espaces"), Some(false));
        assert_eq!(readback_confirms(None, "x"), None);
    }

    #[test]
    fn a_copy_is_fresh_for_three_seconds_only() {
        assert!(fresh(Some(1_000), 3_500, 3_000));
        assert!(fresh(Some(1_000), 4_000, 3_000));
        assert!(!fresh(Some(1_000), 4_001, 3_000));
        assert!(!fresh(None, 4_000, 3_000));
        assert!(!fresh(Some(5_000), 4_000, 3_000));
    }
}
