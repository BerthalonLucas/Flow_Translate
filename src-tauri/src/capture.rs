use crate::types::{Capture, CaptureSource, Rect, StoredCapture, TargetIdentity};
use arboard::Clipboard;
use uiautomation::{patterns::UIValuePattern, types::{TextAttribute,TextPatternRangeEndpoint}};
use uiautomation::{patterns::UITextPattern, variants::SafeArray, UIAutomation, UIElement};
use uuid::Uuid;

fn selection(element: &UIElement) -> Result<(String, Option<Rect>, Option<usize>, usize, bool), String> {
    let pattern = element.get_pattern::<UITextPattern>().map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?;
    let range = pattern.get_selection().map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?
        .into_iter().next().ok_or_else(|| "Aucune sélection active.".to_string())?;
    let text = range.get_text(6001).map_err(|_| "Impossible de lire la sélection.".to_string())?;
    if text.is_empty() { return Err("Aucune sélection active.".into()); }
    if text.encode_utf16().count() >= 6001 { return Err("La sélection dépasse 6 000 unités de texte et pourrait être tronquée.".into()); }
    let selection_start=pattern.get_document_range().ok().and_then(|document| {
        document.move_endpoint_by_range(TextPatternRangeEndpoint::End,&range,TextPatternRangeEndpoint::Start).ok()?;
        Some(document.get_text(-1).ok()?.chars().count())
    });
    let selection_len=text.chars().count();
    let range_editable=range.get_attribute_value(TextAttribute::IsReadOnly).ok().and_then(|v|<uiautomation::variants::Variant as TryInto<bool>>::try_into(v).ok()).is_some_and(|v|!v);
    let anchor = unsafe { range.as_ref().GetBoundingRectangles() }.ok()
        .and_then(|raw| <SafeArray as TryInto<Vec<f64>>>::try_into(SafeArray::from(raw)).ok())
        .and_then(|values| values.chunks_exact(4).last().map(|last| Rect { x:last[0],y:last[1],width:last[2],height:last[3] }));
    Ok((text, anchor, selection_start, selection_len, range_editable))
}

pub fn capture_current(demo: bool) -> Result<StoredCapture, String> {
    if demo {
        let public = Capture { id: Uuid::new_v4().to_string(), text: "Bonjour, ceci est une démonstration FlowTranslate.".into(), source: CaptureSource::Selection, can_replace: false, anchor: Some(Rect { x: 640.0, y: 420.0, width: 280.0, height: 24.0 }) };
        return Ok(StoredCapture { public, target: None });
    }
    if let Ok(automation) = UIAutomation::new() {
        if let Ok(element) = automation.get_focused_element() {
            if !element.is_password().unwrap_or(true) {
                match selection(&element) {
                Ok((text, anchor, selection_start, selection_len, range_editable)) => {
                    let runtime_id = element.get_runtime_id().map_err(|_| "Impossible d’identifier le contrôle source.".to_string())?;
                    #[cfg(windows)] let native_window = unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow().0 as isize };
                    #[cfg(not(windows))] let native_window = 0isize;
                    let value_editable=element.get_pattern::<UIValuePattern>().ok().and_then(|p|p.is_readonly().ok()).is_some_and(|v|!v);
                    let editable=native_window!=0 && (value_editable||range_editable);
                    let can_replace=editable && selection_start.is_some();
                    let public = Capture { id: Uuid::new_v4().to_string(), text: text.clone(), source: CaptureSource::Selection, can_replace, anchor };
                    let target=Some(TargetIdentity { runtime_id, native_window, selected_text: text, anchor, selection_start, selection_len, editable });
                    return Ok(StoredCapture { public, target });
                },
                Err(message) if message.contains("6 000") => return Err(message),
                Err(_) => {}
                }
            }
        }
    }
    let text = Clipboard::new().and_then(|mut c| c.get_text()).map_err(|_| "Aucune sélection UIA; le presse-papiers texte est vide ou inaccessible.".to_string())?;
    if text.is_empty() { return Err("Le presse-papiers texte est vide.".into()); }
    if text.chars().count() > 6000 { return Err("Le texte du presse-papiers dépasse 6 000 caractères.".into()); }
    let public = Capture { id: Uuid::new_v4().to_string(), text, source: CaptureSource::Clipboard, can_replace: false, anchor: None };
    Ok(StoredCapture { public, target: None })
}

pub fn validate_target(target: &TargetIdentity) -> Result<UIElement, String> {
    let automation = UIAutomation::new().map_err(|_| "UI Automation est indisponible.".to_string())?;
    let element = automation.get_focused_element().map_err(|_| "Le contrôle source n’est plus actif.".to_string())?;
    #[cfg(windows)] let hwnd=unsafe{windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow().0 as isize};
    #[cfg(not(windows))] let hwnd=0isize;
    if hwnd != target.native_window || element.get_runtime_id().map_err(|_| "Le contrôle source est introuvable.".to_string())? != target.runtime_id {
        return Err("La cible a changé; remplacement refusé.".into());
    }
    let (text, anchor, selection_start, selection_len, _) = selection(&element)?;
    let range_changed=target.selection_start.is_some_and(|expected|selection_start!=Some(expected));
    if text != target.selected_text || range_changed || selection_len != target.selection_len || target.anchor.is_some_and(|old| Some(old) != anchor) {
        return Err("La sélection a changé; remplacement refusé.".into());
    }
    Ok(element)
}

pub fn replace(target: &TargetIdentity, value: &str) -> Result<(), String> {
    if !target.editable || target.selection_start.is_none() { return Err("L’édition sûre de cette sélection n’est pas démontrée; utilisez Copier.".into()); }
    #[cfg(windows)] unsafe {
        use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::SetForegroundWindow};
        if !SetForegroundWindow(HWND(target.native_window as *mut _)).as_bool() { return Err("Impossible de réactiver la fenêtre source.".into()); }
    }
    std::thread::sleep(std::time::Duration::from_millis(50));
    let _element = validate_target(target)?;
    #[cfg(windows)] unsafe {
        use windows::Win32::UI::Input::KeyboardAndMouse::{SendInput,INPUT,INPUT_0,INPUT_KEYBOARD,KEYBDINPUT,KEYEVENTF_KEYUP,KEYEVENTF_UNICODE,VIRTUAL_KEY};
        let mut inputs=Vec::with_capacity(value.encode_utf16().count()*2);
        for unit in value.encode_utf16(){for flags in [KEYEVENTF_UNICODE,KEYEVENTF_UNICODE|KEYEVENTF_KEYUP]{inputs.push(INPUT{r#type:INPUT_KEYBOARD,Anonymous:INPUT_0{ki:KEYBDINPUT{wVk:VIRTUAL_KEY(0),wScan:unit,dwFlags:flags,time:0,dwExtraInfo:0}}});}}
        if SendInput(&inputs,std::mem::size_of::<INPUT>() as i32) != inputs.len() as u32 { return Err("L’application source a refusé l’insertion; utilisez Copier.".into()); }
    }
    Ok(())
}
