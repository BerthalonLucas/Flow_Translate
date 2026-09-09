use crate::types::{Capture, CaptureSource, Rect, StoredCapture, TargetIdentity, Win32Target};
use arboard::Clipboard;
use uiautomation::{patterns::UITextPattern, variants::SafeArray, UIAutomation, UIElement};
use uiautomation::{
    patterns::UIValuePattern,
    types::{TextAttribute, TextPatternRangeEndpoint},
};
use uuid::Uuid;

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

fn selection(
    element: &UIElement,
) -> Result<(String, Option<Rect>, Option<usize>, usize, bool), String> {
    let pattern = element
        .get_pattern::<UITextPattern>()
        .map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?;
    let range = pattern
        .get_selection()
        .map_err(|_| "La sélection n’est pas accessible par UI Automation.".to_string())?
        .into_iter()
        .next()
        .ok_or_else(|| "Aucune sélection active.".to_string())?;
    let text = range
        .get_text(6001)
        .map_err(|_| "Impossible de lire la sélection.".to_string())?;
    if text.is_empty() {
        return Err("Aucune sélection active.".into());
    }
    if text.encode_utf16().count() >= 6001 {
        return Err("La sélection dépasse 6 000 unités de texte et pourrait être tronquée.".into());
    }
    let selection_start = pattern.get_document_range().ok().and_then(|document| {
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
            can_replace: false,
            anchor: Some(Rect {
                x: 640.0,
                y: 420.0,
                width: 280.0,
                height: 24.0,
            }),
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
                match selection(&element) {
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
                        let win32 = editable.then(|| win32_target(native_window, &text)).flatten();
                        let can_replace = win32.is_some() && selection_start.is_some();
                        let public = Capture {
                            id: Uuid::new_v4().to_string(),
                            text: text.clone(),
                            source: CaptureSource::Selection,
                            can_replace,
                            anchor,
                        };
                        let target = Some(TargetIdentity {
                            runtime_id,
                            native_window,
                            selected_text: text,
                            anchor,
                            selection_start,
                            selection_len,
                            editable,
                            win32,
                        });
                        ensure_source_unchanged(source_window)?;
                        return Ok(StoredCapture { public, target });
                    }
                    Err(message) if message.contains("6 000") => return Err(message),
                    Err(_) => {}
                }
            }
        }
    }
    let text = Clipboard::new()
        .and_then(|mut c| c.get_text())
        .map_err(|_| {
            "Aucune sélection UIA; le presse-papiers texte est vide ou inaccessible.".to_string()
        })?;
    if text.is_empty() {
        return Err("Le presse-papiers texte est vide.".into());
    }
    if text.chars().count() > 6000 {
        return Err("Le texte du presse-papiers dépasse 6 000 caractères.".into());
    }
    ensure_source_unchanged(source_window)?;
    let public = Capture {
        id: Uuid::new_v4().to_string(),
        text,
        source: CaptureSource::Clipboard,
        can_replace: false,
        anchor: None,
    };
    Ok(StoredCapture {
        public,
        target: None,
    })
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
    let (text, anchor, selection_start, selection_len, _) = selection(&element)?;
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
    let expected = target.win32.as_ref().filter(|_| target.editable && target.selection_start.is_some()).ok_or_else(||
        "Ce contrôle ne permet pas un remplacement natif vérifiable; utilisez Copier.".to_string())?;
    #[cfg(windows)]
    unsafe {
        use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::{GetForegroundWindow,SetForegroundWindow}};
        if GetForegroundWindow().0 as isize != target.native_window && !SetForegroundWindow(HWND(target.native_window as *mut _)).as_bool() {
            return Err("Impossible de réactiver la fenêtre source.".into());
        }
    }
    let _element = validate_target(target)?;
    #[cfg(windows)]
    replace_win32(expected, value)?;
    Ok(())
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
    fn only_known_edit_classes() {
        assert!(supported_class("Edit"));
        assert!(supported_class("RichEditD2DPT"));
        assert!(supported_class("RICHEDIT50W"));
        assert!(!supported_class("Chrome_RenderWidgetHostHWND"));
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
