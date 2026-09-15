use crate::types::{Capture, CaptureOrigin, CaptureSource, Rect, StoredCapture, TargetIdentity, Win32Target};
use arboard::Clipboard;
use uiautomation::{patterns::UITextPattern, variants::SafeArray, UIAutomation, UIElement};
use uiautomation::{
    patterns::UIValuePattern,
    types::{TextAttribute, TextPatternRangeEndpoint},
};
use uuid::Uuid;
use std::time::Duration;

/// A copy the user made himself counts as fresh this long (Lucas, 2026-09-14).
const FRESH_COPY_MS: u64 = 3_000;
/// The shortcut chord must be released before the synthetic copy chord is sent.
const CHORD_RELEASE: Duration = Duration::from_millis(600);
/// How long the target may take to serve the synthetic copy.
const COPY_SETTLE: Duration = Duration::from_millis(350);
/// Our own clipboard traffic (copy, restoration) is invisible to the freshness watcher.
const OWN_TRAFFIC: Duration = Duration::from_millis(1_500);

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

/// Text, last visible rectangle, document offset (only when `with_offset`: reading the
/// whole document is the slow part, deferred behind the shown window), length and
/// editability of the current UIA selection.
fn selection(
    element: &UIElement,
    with_offset: bool,
) -> Result<(String, Option<Rect>, Option<usize>, usize, bool), String> {
    let pattern = element
        .get_pattern::<UITextPattern>()
        .map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?;
    let mut ranges = pattern.get_selection().map_err(|_| "La sélection est inaccessible.".to_string())?;
    if ranges.len() != 1 { return Err("Sélection multiple : sélectionnez une seule plage de texte.".into()); }
    let range = ranges.remove(0);
    let text = range
        .get_text(6001)
        .map_err(|_| "Impossible de lire la sélection.".to_string())?;
    if text.is_empty() {
        return Err("Aucune sélection active.".into());
    }
    if text.encode_utf16().count() >= 6001 {
        return Err("La sélection dépasse 6 000 unités de texte et pourrait être tronquée.".into());
    }
    let selection_start = with_offset.then(|| pattern.get_document_range().ok()).flatten().and_then(|document| {
        document
            .move_endpoint_by_range(
                TextPatternRangeEndpoint::End,
                &range,
                TextPatternRangeEndpoint::Start,
            )
            .ok()?;
        Some(document.get_text(-1).ok()?.chars().count())
    });
    let selection_len = text.chars().count();
    let range_editable = range
        .get_attribute_value(TextAttribute::IsReadOnly)
        .ok()
        .and_then(|v| <uiautomation::variants::Variant as TryInto<bool>>::try_into(v).ok())
        .is_some_and(|v| !v);
    let anchor = unsafe { range.as_ref().GetBoundingRectangles() }
        .ok()
        .and_then(|raw| <SafeArray as TryInto<Vec<f64>>>::try_into(SafeArray::from(raw)).ok())
        .and_then(|values| {
            values.chunks_exact(4).last().map(|last| Rect {
                x: last[0],
                y: last[1],
                width: last[2],
                height: last[3],
            }).filter(|r| r.x.is_finite() && r.y.is_finite() && r.width.is_finite() && r.height.is_finite() && r.width > 0.0 && r.height > 0.0)
        });
    Ok((text, anchor, selection_start, selection_len, range_editable))
}

fn ensure_source_unchanged(source_window: isize) -> Result<(), String> {
    if source_window == 0 || crate::host::foreground() != source_window {
        return Err("La fenêtre source a changé pendant la capture. Réessayez.".into());
    }
    Ok(())
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
            replay: None,
            execution: None,
        };
        return Ok(StoredCapture {
            public,
            target: None,
        });
    }
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
            {
                // Keep the selection position now; defer the full document and native
                // control snapshot to complete_target after the overlay is shown.
                match selection(&element, true) {
                    Ok((text, anchor, selection_start, selection_len, range_editable)) => {
                        ensure_source_unchanged(source_window)?;
                        let runtime_id = element.get_runtime_id().map_err(|_| {
                            "Impossible d’identifier le contrôle source.".to_string()
                        })?;
                        let native_window = source_window;
                        let value_editable = element
                            .get_pattern::<UIValuePattern>()
                            .ok()
                            .and_then(|p| p.is_readonly().ok())
                            .is_some_and(|v| !v);
                        let editable = native_window != 0 && (value_editable || range_editable);
                        let mut public = Capture {
                            id: Uuid::new_v4().to_string(),
                            text: text.clone(),
                            source: CaptureSource::Selection,
                            origin: CaptureOrigin::Uia,
                            can_replace: false,
                            anchor,
                            screen: None,
                            replay: None,
            execution: None,
                        };
                        let mut identity = TargetIdentity {
                            runtime_id,
                            native_window,
                            selected_text: text,
                            anchor,
                            selection_start,
                            selection_len,
                            editable,
                            win32: None,
                            document: None,
                            copied_selection: false,
                            document_from_value: false,
                        };
                        if editable && win32_target(source_window, &identity.selected_text).is_none() {
                            validate_target(&identity)?;
                            let actual = synthetic_copy(source_window).map_err(|_| "L’éditeur ne permet pas de vérifier sa sélection par copie. Réessayez après avoir copié du texte.".to_string())?;
                            if actual.encode_utf16().count() > 6000 { return Err("Sélection trop longue (6 000 unités de texte).".into()); }
                            if actual != identity.selected_text {
                                // Some rich UIA providers overrun inline-node boundaries.
                                // The editor's copy is authoritative; never translate nearby words.
                                let value_document = document_text(&element, true).ok().filter(|doc| unique_offset(doc, &actual).is_some());
                                let from_value = value_document.is_some();
                                let document = value_document.or_else(|| document_text(&element, false).ok()).ok_or("Le document ne peut pas être vérifié.")?;
                                let start = unique_offset(&document, &actual).ok_or("La sélection copiée n’a pas une position unique dans le document.")?;
                                public.text = actual.clone();
                                public.origin = CaptureOrigin::Copy;
                                public.anchor = None;
                                identity.selected_text = actual;
                                identity.selection_len = identity.selected_text.chars().count();
                                identity.selection_start = Some(start);
                                identity.anchor = None;
                                identity.document = Some(document);
                                identity.copied_selection = true;
                                identity.document_from_value = from_value;
                            }
                        }
                        let target = Some(identity);
                        ensure_source_unchanged(source_window)?;
                        return Ok(StoredCapture { public, target });
                    }
                    Err(message) if message.contains("6 000") => return Err(message),
                    Err(_) => {}
                }
            }
        }
    }
    clipboard_capture(source_window)
}

/// Second step of a selection capture, run behind the shown window: the document
/// offset of the selection and, for an editable control, the Win32 target that makes
/// a verifiable replacement possible. None when the focus or the selection moved.
pub fn complete_target(target: &TargetIdentity) -> Option<TargetIdentity> {
    let element = validate_target(target).ok()?;
    if !target.editable { return None; }
    let mut resolved = target.clone();
    if !target.copied_selection {
        let (_, _, start, _, _) = selection(&element, true).ok()?;
        resolved.selection_start = start;
    }
    let start = resolved.selection_start?;
    let document = document_text(&element, target.document_from_value).ok()?;
    // Providers must expose the same document and selection coordinate system.
    let actual = document.chars().skip(start).take(target.selection_len).collect::<String>();
    if actual != target.selected_text { return None; }
    resolved.document = Some(document);
    resolved.win32 = win32_target(target.native_window, &target.selected_text);
    validate_target(&resolved).ok()?;
    Some(resolved)
}

fn document_text(element: &UIElement, value_only: bool) -> Result<String, String> {
    let text = if value_only {
        element.get_pattern::<UIValuePattern>().and_then(|p| p.get_value())
    } else {
        element.get_pattern::<UITextPattern>().and_then(|p| p.get_document_range()).and_then(|r| r.get_text(1_000_001))
    }.map_err(|_| "Le document source n’est plus accessible.".to_string())?;
    if text.encode_utf16().count() > 1_000_000 { return Err("Document trop volumineux pour vérifier le remplacement.".into()); }
    Ok(text)
}

fn unique_offset(document: &str, selected: &str) -> Option<usize> {
    if selected.is_empty() { return None; }
    // Check overlapping occurrences as well ("aa" in "aaa" is ambiguous).
    let mut matches = document.char_indices().filter(|(i, _)| document[*i..].starts_with(selected));
    let (offset, _) = matches.next()?;
    if matches.next().is_some() { return None; }
    Some(document[..offset].chars().count())
}

/// A copy made at `changed_at` is fresh at `now` when it is at most `limit` ms old.
pub fn fresh(changed_at: Option<u64>, now: u64, limit: u64) -> bool {
    changed_at.is_some_and(|at| at <= now && now - at <= limit)
}

fn read_clipboard() -> Option<String> {
    Clipboard::new().and_then(|mut c| c.get_text()).ok()
}

/// Without a UIA selection: copies for the user (synthetic Ctrl+Insert), else accepts a
/// copy he made himself in the last three seconds, else nothing to translate.
pub(crate) fn clipboard_capture(source_window: isize) -> Result<StoredCapture, String> {
    let pressed_at = crate::host::now_ms();
    let changed_at = crate::host::clipboard_changed_at();
    let candidate = ui_automation().ok().and_then(|a| a.get_focused_element().ok()).and_then(|element| {
        if element.is_password().ok()? || !element.is_enabled().ok()? { return None; }
        let pattern = element.get_pattern::<UIValuePattern>().ok()?;
        if pattern.is_readonly().ok()? { return None; }
        Some((element.get_runtime_id().ok()?, document_text(&element, true).ok()?))
    });
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
    let target = if copied.is_ok() {
        candidate.and_then(|(runtime_id, document)| {
            let start = unique_offset(&document, &text)?;
            Some(TargetIdentity { runtime_id, native_window: source_window, selected_text: text.clone(), anchor: None,
                selection_start: Some(start), selection_len: text.chars().count(), editable: true,
                win32: None, document: Some(document), copied_selection: true, document_from_value: true })
        })
    } else { None };
    let target = target.filter(|target| validate_target(target).is_ok());
    let public = Capture {
        id: Uuid::new_v4().to_string(),
        text,
        source: CaptureSource::Clipboard,
        origin,
        can_replace: false,
        anchor: None,
        screen: None,
        replay: None,
            execution: None,
    };
    Ok(StoredCapture { public, target })
}

/// Copy only after a complete clipboard snapshot; never discard image/HTML/RTF/file data.
fn synthetic_copy(source_window: isize) -> Result<String, &'static str> {
    ensure_source_unchanged(source_window).map_err(|_| "source window lost")?;
    if !crate::host::wait_modifiers_released(CHORD_RELEASE) { return Err("modifiers still down"); }
    let previous = crate::clipboard_guard::Snapshot::capture().map_err(|_| "clipboard cannot be preserved")?;
    crate::host::suppress_clipboard_tracking(OWN_TRAFFIC);
    ensure_source_unchanged(source_window).map_err(|_| "source window lost after the chord")?;
    if crate::host::clipboard_sequence() != previous.sequence { return Err("clipboard changed"); }
    crate::host::send_copy_chord().map_err(|_| "SendInput refused")?;
    let after = crate::host::wait_clipboard_change(previous.sequence, COPY_SETTLE).ok_or("no clipboard change")?;
    let copied = read_clipboard().filter(|text| !text.trim().is_empty());
    if crate::host::clipboard_sequence() != after { return Err("clipboard changed during copy"); }
    let _ = previous.restore(after);
    ensure_source_unchanged(source_window).map_err(|_| "source window lost after copy")?;
    copied.ok_or("copied nothing readable")
}

pub fn validate_target(target: &TargetIdentity) -> Result<UIElement, String> {
    let automation =
        ui_automation().map_err(|_| "UI Automation est indisponible.".to_string())?;
    let element = automation
        .get_focused_element()
        .map_err(|_| "Le contrôle source n’est plus actif.".to_string())?;
    #[cfg(windows)]
    let hwnd = unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow().0 as isize };
    #[cfg(not(windows))]
    let hwnd = 0isize;
    if hwnd != target.native_window
        || element
            .get_runtime_id()
            .map_err(|_| "Le contrôle source est introuvable.".to_string())?
            != target.runtime_id
    {
        return Err("La cible a changé; remplacement refusé.".into());
    }
    if element.is_password().unwrap_or(true) || !element.is_enabled().unwrap_or(false) {
        return Err("Le champ est protégé ou désactivé.".into());
    }
    if let Some(expected) = &target.document {
        if document_text(&element, target.document_from_value)? != *expected {
            return Err("Le document a changé; remplacement refusé.".into());
        }
    }
    if target.copied_selection {
        let value_editable = element.get_pattern::<UIValuePattern>().and_then(|p| p.is_readonly()).is_ok_and(|readonly| !readonly);
        let range_editable = !target.document_from_value && selection(&element, false).is_ok_and(|(_, _, _, _, editable)| editable);
        if !value_editable && !range_editable {
            return Err("Le champ n’est plus modifiable.".into());
        }
        // Non-invasive watcher. Delivery additionally copies and compares the live selection.
        return Ok(element);
    }
    let (text, anchor, selection_start, selection_len, range_editable) = selection(&element, true)?;
    if target.editable && !range_editable && !element.get_pattern::<UIValuePattern>().and_then(|p| p.is_readonly()).is_ok_and(|v| !v) {
        return Err("Le champ n’est plus modifiable.".into());
    }
    let range_changed = target
        .selection_start
        .is_some_and(|expected| selection_start != Some(expected));
    if text != target.selected_text
        || range_changed
        || selection_len != target.selection_len
        || target.anchor.is_some_and(|old| Some(old) != anchor)
    {
        return Err("La sélection a changé; remplacement refusé.".into());
    }
    Ok(element)
}

pub fn replace(target: &TargetIdentity, value: &str) -> Result<(), String> {
    replace_checked(target, value, true)
}

pub fn replace_automatic(target: &TargetIdentity, value: &str) -> Result<(), String> {
    if crate::host::foreground() != target.native_window { return Err("La fenêtre source a changé.".into()); }
    replace_checked(target, value, false)
}

fn replace_checked(target: &TargetIdentity, value: &str, reactivate: bool) -> Result<(), String> {
    if value.contains('\0') { return Err("Le résultat contient un caractère nul; remplacement refusé.".into()); }
    if !target.editable || target.selection_start.is_none() || (target.win32.is_none() && target.document.is_none()) {
        return Err("La sélection ne peut pas être vérifiée. Utilisez Copier.".into());
    }
    #[cfg(windows)]
    unsafe {
        use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::{GetForegroundWindow,SetForegroundWindow}};
        if reactivate && GetForegroundWindow().0 as isize != target.native_window && !SetForegroundWindow(HWND(target.native_window as *mut _)).as_bool() {
            return Err("Impossible de réactiver la fenêtre source.".into());
        }
    }
    let element = validate_target(target)?;
    if let Some(expected) = &target.win32 { return replace_win32(expected, value); }
    replace_paste(target, &element, value)
}

fn patched_text(document: &str, start: usize, selected: &str, value: &str) -> Option<String> {
    let offset = document.char_indices().map(|(i, _)| i).chain(Some(document.len())).nth(start)?;
    if !document[offset..].starts_with(selected) { return None; }
    Some(format!("{}{}{}", &document[..offset], value, &document[offset + selected.len()..]))
}
// Chromium preserves boundary spaces in contenteditable by turning them into NBSP
// during native paste. Normalize that representation only for AFTER-write proof;
// pre-write document/selection identity remains byte-for-byte exact.
fn canonical(text: &str) -> String { text.replace("\r\n", "\n").replace('\r', "\n").replace('\u{a0}', " ") }

fn replace_paste(target: &TargetIdentity, element: &UIElement, value: &str) -> Result<(), String> {
    if !crate::host::wait_modifiers_released(CHORD_RELEASE) { return Err("Relâchez les touches du raccourci puis réessayez.".into()); }
    validate_target(target)?;
    if target.copied_selection {
        let selected = synthetic_copy(target.native_window).map_err(|_| "La sélection ne peut pas être revérifiée.".to_string())?;
        if selected != target.selected_text { return Err("La sélection a changé; remplacement refusé.".into()); }
    }
    let document = target.document.as_deref().ok_or("Le document source est indisponible.")?;
    let wanted = patched_text(document, target.selection_start.ok_or("Sélection sans position.")?, &target.selected_text, value)
        .ok_or("La sélection a changé; remplacement refusé.")?;
    if document == wanted { return Ok(()); }
    let previous = crate::clipboard_guard::Snapshot::capture()?;
    crate::host::suppress_clipboard_tracking(Duration::from_secs(4));
    let sequence = previous.put_text(value)?;
    if let Err(error) = validate_target(target) {
        let _ = previous.restore(sequence);
        return Err(error);
    }
    if crate::host::clipboard_sequence() != sequence {
        return Err("Le presse-papiers a changé; collage annulé et nouveau contenu conservé.".into());
    }
    if crate::host::modifiers_down() {
        let _ = previous.restore(sequence);
        return Err("Les touches actives ont changé; collage annulé.".into());
    }
    // Never send a second paste, even after timeout/partial injection. Leave the
    // result on the clipboard until it was actually observed in the document.
    if let Err(sent) = crate::host::send_paste_chord() {
        if sent == 0 { let _ = previous.restore(sequence); }
        return Err("Collage bloqué ou partiel (Windows ou application protégée). Vérifiez le champ avant de réessayer.".into());
    }
    let deadline = std::time::Instant::now() + Duration::from_secs(2);
    loop {
        // Rich editors may move accessibility focus to a new child after editing.
        // Read the original validated provider, not whichever child is focused now.
        if document_text(element, target.document_from_value).is_ok_and(|after| canonical(&after) == canonical(&wanted)) {
            let _ = previous.restore(sequence);
            return Ok(());
        }
        if std::time::Instant::now() >= deadline { break; }
        std::thread::sleep(Duration::from_millis(25));
    }
    #[cfg(test)]
    {
        let after = document_text(element, target.document_from_value);
        let focused = ui_automation().ok().and_then(|a| a.get_focused_element().ok());
        eprintln!("paste proof: original_provider_readable={}, original_length={:?}, expected_length={}, focused_identity_same={}",
            after.is_ok(), after.as_ref().ok().map(|s| s.chars().count()), wanted.chars().count(),
            focused.as_ref().and_then(|e| e.get_runtime_id().ok()).as_ref() == Some(&target.runtime_id));
        if let Ok(after) = after {
            eprintln!("paste proof: NBSP_equivalent={}, paragraph_equivalent={}",
                canonical(&after).replace('\u{a0}', " ") == canonical(&wanted).replace('\u{a0}', " "),
                canonical(&after).replace('\u{2029}', "\n") == canonical(&wanted).replace('\u{2029}', "\n"));
        }
    }
    Err("Collage envoyé mais non confirmé. Vérifiez le champ avant de réessayer ; le résultat reste dans le presse-papiers et la bulle.".into())
}

#[cfg(windows)]
fn message(hwnd: windows::Win32::Foundation::HWND, msg: u32, wparam: usize, lparam: isize) -> Result<usize,String> {
    use windows::Win32::{Foundation::{LPARAM,WPARAM},UI::WindowsAndMessaging::{SendMessageTimeoutW,SMTO_ABORTIFHUNG,SMTO_BLOCK}};
    let mut result=0usize;
    let sent=unsafe{SendMessageTimeoutW(hwnd,msg,WPARAM(wparam),LPARAM(lparam),SMTO_ABORTIFHUNG|SMTO_BLOCK,250,Some(&mut result))};
    if sent.0==0 {Err("Le contrôle source ne répond pas; remplacement refusé.".into())} else {Ok(result)}
}

#[cfg(windows)]
fn focused_control(source:isize)->Option<(isize,String)> {
    use windows::Win32::{Foundation::HWND,UI::WindowsAndMessaging::{GetClassNameW,GetGUIThreadInfo,GetWindowThreadProcessId,GUITHREADINFO}};
    let source=HWND(source as *mut _);let thread=unsafe{GetWindowThreadProcessId(source,None)};if thread==0{return None;}
    let mut info=GUITHREADINFO{cbSize:std::mem::size_of::<GUITHREADINFO>() as u32,..Default::default()};unsafe{GetGUIThreadInfo(thread,&mut info).ok()?;}
    if info.hwndFocus.0.is_null(){return None;}let mut class=[0u16;256];let len=unsafe{GetClassNameW(info.hwndFocus,&mut class)};if len<=0{return None;}
    let name=String::from_utf16_lossy(&class[..len as usize]);
    supported_class(&name).then_some((info.hwndFocus.0 as isize,name))
}

fn supported_class(name:&str)->bool{let lower=name.to_ascii_lowercase();lower=="edit"||lower.starts_with("richedit")}

fn patched(document:&[u16],start:usize,end:usize,value:&str)->Option<Vec<u16>>{if start>end||end>document.len(){return None;}let mut wanted=document[..start].to_vec();wanted.extend(value.encode_utf16());wanted.extend_from_slice(&document[end..]);Some(wanted)}

#[cfg(windows)]
fn read_control(hwnd:isize)->Result<(Vec<u16>,u32,u32),String>{
    use windows::Win32::{Foundation::HWND,UI::WindowsAndMessaging::{WM_GETTEXT,WM_GETTEXTLENGTH}};
    const EM_GETSEL:u32=0x00B0;let hwnd=HWND(hwnd as *mut _);
    let len=message(hwnd,WM_GETTEXTLENGTH,0,0)?;if len>1_000_000{return Err("Le document source est trop volumineux pour un remplacement vérifiable.".into());}
    let mut text=vec![0u16;len+1];let copied=message(hwnd,WM_GETTEXT,text.len(),text.as_mut_ptr() as isize)?;text.truncate(copied.min(len));
    let(mut start,mut end)=(0u32,0u32);message(hwnd,EM_GETSEL,&mut start as *mut u32 as usize,&mut end as *mut u32 as isize)?;
    if start>end||end as usize>text.len(){return Err("La sélection native est invalide.".into());}Ok((text,start,end))
}

#[cfg(windows)]
fn win32_target(source:isize,selected:&str)->Option<Win32Target>{let(control_window,class_name)=focused_control(source)?;let(document_utf16,selection_start,selection_end)=read_control(control_window).ok()?;let wanted=selected.encode_utf16().collect::<Vec<_>>();(document_utf16.get(selection_start as usize..selection_end as usize)==Some(wanted.as_slice())).then_some(Win32Target{control_window,class_name,selection_start,selection_end,document_utf16})}
#[cfg(not(windows))] fn win32_target(_source:isize,_selected:&str)->Option<Win32Target>{None}

#[cfg(windows)]
fn replace_win32(expected:&Win32Target,value:&str)->Result<(),String>{
    use windows::Win32::Foundation::HWND;const EM_REPLACESEL:u32=0x00C2;
    let(control,class)=focused_control(crate::host::foreground()).ok_or_else(||"Le contrôle natif actif a changé.".to_string())?;
    if control!=expected.control_window||class!=expected.class_name{return Err("Le contrôle natif actif a changé.".into());}
    let(document,start,end)=read_control(control)?;if document!=expected.document_utf16||start!=expected.selection_start||end!=expected.selection_end{return Err("Le document ou sa sélection a changé; remplacement refusé.".into());}
    let mut replacement=value.encode_utf16().chain(Some(0)).collect::<Vec<_>>();message(HWND(control as *mut _),EM_REPLACESEL,1,replacement.as_mut_ptr() as isize)?;
    let(after,_,_)=read_control(control)?;let wanted=patched(&document,start as usize,end as usize,value).ok_or_else(||"La sélection native est invalide.".to_string())?;
    if after!=wanted{return Err("Le contrôle n’a pas confirmé le remplacement complet.".into());}Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paste_proof_normalizes_only_editor_space_and_line_endings() {
        assert_eq!(canonical("Début\u{a0}équipe\r\nfin"), canonical("Début équipe\nfin"));
        assert_ne!(canonical("deux  espaces"), canonical("deux espaces"));
        assert_ne!(canonical("avant\naprès"), canonical("avant après"));
        assert_ne!(canonical("mot\u{3000}mot"), canonical("mot mot"));
    }

    #[test]
    fn text_patch_preserves_surroundings_and_unicode() {
        assert_eq!(patched_text("Début 😀 café\r\nfin", 8, "café", "équipe 🚀\nmerci").unwrap(), "Début 😀 équipe 🚀\nmerci\r\nfin");
        assert!(patched_text("abc", 1, "wrong", "x").is_none());
        assert!(patched_text("abc", 5, "", "x").is_none());
    }
    #[test]
    fn copy_fallback_requires_an_unambiguous_document_position() {
        assert_eq!(unique_offset("😀 un café ici", "café"), Some(5));
        assert_eq!(unique_offset("un un", "un"), None);
        assert_eq!(unique_offset("aaa", "aa"), None);
        assert_eq!(unique_offset("abc", ""), None);
    }

    #[test]
    fn only_known_edit_classes() {
        assert!(supported_class("Edit"));
        assert!(supported_class("RichEditD2DPT"));
        assert!(supported_class("RICHEDIT50W"));
        assert!(!supported_class("Chrome_RenderWidgetHostHWND"));
    }

    #[test]
    fn a_copy_is_fresh_for_three_seconds_only() {
        assert!(fresh(Some(1_000), 3_500, 3_000));
        assert!(fresh(Some(1_000), 4_000, 3_000));
        assert!(!fresh(Some(1_000), 4_001, 3_000));
        assert!(!fresh(None, 4_000, 3_000), "never copied");
        assert!(!fresh(Some(5_000), 4_000, 3_000), "clock went backwards");
    }

    #[test]
    fn utf16_patch_is_exact() {
        let document = "Bonjour monde".encode_utf16().collect::<Vec<_>>();
        assert_eq!(
            String::from_utf16(&patched(&document, 8, 13, "équipe").unwrap()).unwrap(),
            "Bonjour équipe"
        );
        assert!(patched(&document, 9, 2, "x").is_none());
    }

    #[cfg(windows)]
    #[test]
    fn invisible_edit_replaces_unicode_selection_by_message() {
        use windows::{
            core::w,
            Win32::{
                Foundation::HWND,
                UI::WindowsAndMessaging::{
                    CreateWindowExW, DestroyWindow, ES_MULTILINE, WINDOW_EX_STYLE,
                    IsWindowUnicode, WINDOW_STYLE, WM_SETTEXT, WS_OVERLAPPED,
                },
            },
        };
        const EM_SETSEL: u32 = 0x00B1;
        const EM_REPLACESEL: u32 = 0x00C2;
        const EM_SETLIMITTEXT: u32 = 0x00C5;

        struct Window(HWND);
        impl Drop for Window {
            fn drop(&mut self) {
                unsafe {
                    let _ = DestroyWindow(self.0);
                }
            }
        }

        let edit = Window(unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("EDIT"),
                w!(""),
                WS_OVERLAPPED | WINDOW_STYLE(ES_MULTILINE as u32),
                0,
                0,
                640,
                480,
                None,
                None,
                None,
                None,
            )
            .unwrap()
        });
        assert!(unsafe { IsWindowUnicode(edit.0).as_bool() });

        let original = "Début\r\ncafé 😀 fin";
        message(edit.0, EM_SETLIMITTEXT, 1_000_000, 0).unwrap();
        let original_utf16 = original
            .encode_utf16()
            .chain(Some(0))
            .collect::<Vec<_>>();
        message(edit.0, WM_SETTEXT, 0, original_utf16.as_ptr() as isize).unwrap();
        let start = "Début\r\n".encode_utf16().count();
        let end = start + "café 😀".encode_utf16().count();
        message(edit.0, EM_SETSEL, start, end as isize).unwrap();

        let (before, selected_start, selected_end) = read_control(edit.0.0 as isize).unwrap();
        assert_eq!(selected_start as usize, start);
        assert_eq!(selected_end as usize, end);
        assert_eq!(
            String::from_utf16(&before[start..end]).unwrap(),
            "café 😀"
        );

        let replacement = "équipe 🚀";
        let mut replacement_utf16 = replacement.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        message(edit.0, EM_REPLACESEL, 1, replacement_utf16.as_mut_ptr() as isize).unwrap();
        let (after, _, _) = read_control(edit.0.0 as isize).unwrap();
        assert_eq!(String::from_utf16(&after).unwrap(), "Début\r\néquipe 🚀 fin");
    }
}

