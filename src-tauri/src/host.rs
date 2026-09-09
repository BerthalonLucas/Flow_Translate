//! Windows geometry only: UIA rectangles and Win32 placement stay physical.
use crate::types::Rect;
use std::{
    sync::{atomic::{AtomicBool, AtomicIsize, Ordering}, LazyLock, Mutex},
    time::Instant,
};
use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};
use windows::Win32::{
    Foundation::{HWND, POINT, RECT},
    Graphics::Gdi::{
        CreateRoundRectRgn, DeleteObject, GetMonitorInfoW, MonitorFromPoint, SetWindowRgn,
        MONITORINFO, MONITOR_DEFAULTTONEAREST,
    },
    UI::{
        HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
        Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE},
        WindowsAndMessaging::{
            GetForegroundWindow, GetWindowLongPtrW, GetWindowRect, SetWindowLongPtrW,
            SetWindowPos, GWL_STYLE, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, WS_CAPTION, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
            WS_SYSMENU, WS_THICKFRAME,
        },
    },
};

pub fn foreground() -> isize {
    unsafe { GetForegroundWindow().0 as isize }
}
pub fn window_rect(handle: isize) -> Option<Rect> {
    let mut r = RECT::default();
    unsafe {
        GetWindowRect(HWND(handle as *mut _), &mut r).ok()?;
    }
    Some(Rect {
        x: r.left as f64,
        y: r.top as f64,
        width: (r.right - r.left) as f64,
        height: (r.bottom - r.top) as f64,
    })
}
pub fn escape_down() -> bool {
    unsafe { GetAsyncKeyState(VK_ESCAPE.0 as i32) < 0 }
}

static ESCAPE_PENDING:AtomicBool=AtomicBool::new(false);
static OVERLAY_VISIBLE:AtomicBool=AtomicBool::new(false);
static SOURCE:AtomicIsize=AtomicIsize::new(0);
static OVERLAY:AtomicIsize=AtomicIsize::new(0);
static CAPSULE:AtomicIsize=AtomicIsize::new(0);

#[derive(Clone, Copy)]
pub struct DragGesture {
    pub dx: i32,
    pub dy: i32,
    pub button_down: bool,
}
struct MouseGesture {
    started: Option<Instant>,
    start: POINT,
    current: POINT,
    button_down: bool,
}
static MOUSE_GESTURE: LazyLock<Mutex<MouseGesture>> = LazyLock::new(|| Mutex::new(MouseGesture {
    started: None,
    start: POINT::default(),
    current: POINT::default(),
    button_down: false,
}));

pub fn escape_scope(source:isize,overlay:isize,capsule:isize){
    SOURCE.store(source,Ordering::Relaxed);OVERLAY.store(overlay,Ordering::Relaxed);CAPSULE.store(capsule,Ordering::Relaxed);OVERLAY_VISIBLE.store(true,Ordering::Release);
}
pub fn close_escape_scope(){OVERLAY_VISIBLE.store(false,Ordering::Release);ESCAPE_PENDING.store(false,Ordering::Release);}
pub fn take_escape()->bool{ESCAPE_PENDING.swap(false,Ordering::AcqRel)}
pub fn handle(window:&WebviewWindow)->isize{window.hwnd().map(|h|h.0 as isize).unwrap_or(0)}

pub fn install_escape_hook()->Result<(),String>{
    use windows::Win32::{Foundation::{HINSTANCE,LRESULT,LPARAM,WPARAM},System::LibraryLoader::GetModuleHandleW,UI::WindowsAndMessaging::{CallNextHookEx,SetWindowsHookExW,KBDLLHOOKSTRUCT,MSLLHOOKSTRUCT,WH_KEYBOARD_LL,WH_MOUSE_LL,WM_KEYDOWN,WM_LBUTTONDOWN,WM_LBUTTONUP,WM_MOUSEMOVE,WM_SYSKEYDOWN,WM_KEYUP,WM_SYSKEYUP}};
    unsafe extern "system" fn keyboard(code:i32,wparam:WPARAM,lparam:LPARAM)->LRESULT{
        if code>=0&&OVERLAY_VISIBLE.load(Ordering::Acquire){
            let key=unsafe{&*(lparam.0 as *const KBDLLHOOKSTRUCT)};
            let fg=foreground();
            if key.vkCode==VK_ESCAPE.0 as u32&&fg!=0&&[SOURCE.load(Ordering::Relaxed),OVERLAY.load(Ordering::Relaxed),CAPSULE.load(Ordering::Relaxed)].contains(&fg){
                if [WM_KEYDOWN,WM_SYSKEYDOWN].contains(&(wparam.0 as u32)){ESCAPE_PENDING.store(true,Ordering::Release);return LRESULT(1);}
                if [WM_KEYUP,WM_SYSKEYUP].contains(&(wparam.0 as u32)){return LRESULT(1);}
            }
        }
        unsafe{CallNextHookEx(None,code,wparam,lparam)}
    }
    unsafe extern "system" fn mouse(code:i32,wparam:WPARAM,lparam:LPARAM)->LRESULT{
        if code>=0 {
            let event=unsafe{&*(lparam.0 as *const MSLLHOOKSTRUCT)};
            if let Ok(mut gesture)=MOUSE_GESTURE.lock(){
                match wparam.0 as u32 {
                    WM_LBUTTONDOWN=>{
                        gesture.started=Some(Instant::now());gesture.start=event.pt;gesture.current=event.pt;gesture.button_down=true;
                    }
                    WM_MOUSEMOVE if gesture.button_down=>gesture.current=event.pt,
                    WM_LBUTTONUP if gesture.started.is_some()=>{gesture.current=event.pt;gesture.button_down=false;}
                    _=>{}
                }
            }
        }
        unsafe{CallNextHookEx(None,code,wparam,lparam)}
    }
    unsafe{
        let module=GetModuleHandleW(None).map_err(|_|"Module clavier indisponible.".to_string())?;
        SetWindowsHookExW(WH_KEYBOARD_LL,Some(keyboard),Some(HINSTANCE(module.0)),0).map_err(|_|"La gestion d’Échap est indisponible.".to_string())?;
        // Drag still has a safe Tao fallback if the optional mouse hook is unavailable.
        let _=SetWindowsHookExW(WH_MOUSE_LL,Some(mouse),Some(HINSTANCE(module.0)),0);
    }
    Ok(())
}

pub fn take_drag_gesture() -> Option<DragGesture> {
    let mut gesture = MOUSE_GESTURE.lock().ok()?;
    let started = gesture.started.take()?;
    if started.elapsed() > std::time::Duration::from_millis(1500) {
        return None;
    }
    Some(DragGesture {
        dx: gesture.current.x - gesture.start.x,
        dy: gesture.current.y - gesture.start.y,
        button_down: gesture.button_down,
    })
}

pub fn compensate_drag(window: &WebviewWindow, gesture: DragGesture) -> Result<(), String> {
    if gesture.dx == 0 && gesture.dy == 0 {
        return Ok(());
    }
    let hwnd = HWND(window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?.0);
    let rect = window_rect(hwnd.0 as isize).ok_or_else(|| "Fenêtre indisponible.".to_string())?;
    unsafe {
        SetWindowPos(
            hwnd,
            None,
            rect.x.round() as i32 + gesture.dx,
            rect.y.round() as i32 + gesture.dy,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOSIZE | SWP_NOZORDER,
        )
        .map_err(|_| "Déplacement indisponible.".to_string())?;
    }
    Ok(())
}
pub fn belongs_to(window: &WebviewWindow, handle: isize) -> bool {
    window.hwnd().is_ok_and(|h| h.0 as isize == handle)
}

pub fn monitor(anchor: Option<Rect>, source: isize) -> (Rect, f64) {
    let location = anchor.or_else(|| window_rect(source)).unwrap_or(Rect {
        x: 0.,
        y: 0.,
        width: 1.,
        height: 1.,
    });
    unsafe {
        let m = MonitorFromPoint(
            POINT {
                x: (location.x + location.width / 2.) as i32,
                y: (location.y + location.height / 2.) as i32,
            },
            MONITOR_DEFAULTTONEAREST,
        );
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let (mut dx, mut dy) = (96, 96);
        let _ = GetDpiForMonitor(m, MDT_EFFECTIVE_DPI, &mut dx, &mut dy);
        let scale = (dx as f64 / 96.).clamp(1., 4.);
        if GetMonitorInfoW(m, &mut info).as_bool() {
            let r = info.rcWork;
            return (
                Rect {
                    x: r.left as f64,
                    y: r.top as f64,
                    width: (r.right - r.left) as f64,
                    height: (r.bottom - r.top) as f64,
                },
                scale,
            );
        }
    }
    (
        Rect {
            x: 0.,
            y: 0.,
            width: 1920.,
            height: 1080.,
        },
        1.,
    )
}

pub fn show(window: &WebviewWindow, rect: Rect, radius: f64) -> Result<(), String> {
    let width = rect.width.round().max(1.) as u32;
    let height = rect.height.round().max(1.) as u32;
    window
        .set_size(PhysicalSize::new(width, height))
        .and_then(|_| {
            window.set_position(PhysicalPosition::new(
                rect.x.round() as i32,
                rect.y.round() as i32,
            ))
        })
        .map_err(|_| "Placement indisponible.".to_string())?;
    unsafe {
        let h = window
            .hwnd()
            .map_err(|_| "Fenêtre indisponible.".to_string())?;
        let hwnd = HWND(h.0);
        strip_chrome_hwnd(hwnd);
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
        )
        .map_err(|_| "Placement indisponible.".to_string())?;
        // Clip native acrylic and hit testing to the same round silhouette as CSS.
        let region = CreateRoundRectRgn(
            0,
            0,
            width as i32 + 1,
            height as i32 + 1,
            (radius * 2.).round() as i32,
            (radius * 2.).round() as i32,
        );
        if SetWindowRgn(hwnd, Some(region), true) == 0 {
            let _ = DeleteObject(region.into());
        }
    }
    Ok(())
}

pub fn strip_chrome(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = HWND(
        window
            .hwnd()
            .map_err(|_| "Fenêtre indisponible.".to_string())?
            .0,
    );
    unsafe {
        strip_chrome_hwnd(hwnd);
        SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
        )
        .map_err(|_| "Fenêtre indisponible.".to_string())?;
    }
    Ok(())
}

unsafe fn strip_chrome_hwnd(hwnd: HWND) {
    // Tao 0.35 rebuilds top-level styles from its window flags when visibility
    // changes. Strip every caption-producing style at the HWND boundary too.
    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) };
    let chrome = (WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX).0;
    unsafe { SetWindowLongPtrW(hwnd, GWL_STYLE, style & !(chrome as isize)) };
}
