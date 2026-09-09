//! Windows geometry only: UIA rectangles and Win32 placement stay physical.
use crate::types::{Rect, SurfaceRegion};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};
use windows::Win32::{
    Foundation::{HWND, POINT, RECT},
    Graphics::Gdi::{
        ClientToScreen, CombineRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject,
        GetMonitorInfoW, MonitorFromPoint, SetWindowRgn, HRGN, MONITORINFO,
        MONITOR_DEFAULTTONEAREST, RGN_OR,
    },
    UI::{
        HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
        Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE, VK_LBUTTON},
        WindowsAndMessaging::{
            GetCursorPos, GetForegroundWindow, GetWindowLongPtrW, GetWindowRect, SetWindowLongPtrW,
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

pub fn escape_scope(source:isize,overlay:isize,capsule:isize){
    SOURCE.store(source,Ordering::Relaxed);OVERLAY.store(overlay,Ordering::Relaxed);CAPSULE.store(capsule,Ordering::Relaxed);OVERLAY_VISIBLE.store(true,Ordering::Release);
}
pub fn close_escape_scope(){OVERLAY_VISIBLE.store(false,Ordering::Release);ESCAPE_PENDING.store(false,Ordering::Release);}
pub fn take_escape()->bool{ESCAPE_PENDING.swap(false,Ordering::AcqRel)}
pub fn handle(window:&WebviewWindow)->isize{window.hwnd().map(|h|h.0 as isize).unwrap_or(0)}

pub fn install_escape_hook()->Result<(),String>{
    use windows::Win32::{Foundation::{HINSTANCE,LRESULT,LPARAM,WPARAM},System::LibraryLoader::GetModuleHandleW,UI::WindowsAndMessaging::{CallNextHookEx,SetWindowsHookExW,KBDLLHOOKSTRUCT,WH_KEYBOARD_LL,WM_KEYDOWN,WM_SYSKEYDOWN,WM_KEYUP,WM_SYSKEYUP}};
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
    unsafe{
        let module=GetModuleHandleW(None).map_err(|_|"Module clavier indisponible.".to_string())?;
        SetWindowsHookExW(WH_KEYBOARD_LL,Some(keyboard),Some(HINSTANCE(module.0)),0).map_err(|_|"La gestion d’Échap est indisponible.".to_string())?;
    }
    Ok(())
}
pub fn belongs_to(window: &WebviewWindow, handle: isize) -> bool {
    window.hwnd().is_ok_and(|h| h.0 as isize == handle)
}

pub fn compensate_pointer_drag(
    window: &WebviewWindow,
    client_x: f64,
    client_y: f64,
) -> Result<bool, String> {
    if !client_x.is_finite() || !client_y.is_finite() {
        return Err("Position de déplacement invalide.".into());
    }
    let scale = window
        .scale_factor()
        .map_err(|_| "Fenêtre indisponible.".to_string())?;
    let client = window
        .inner_size()
        .map_err(|_| "Fenêtre indisponible.".to_string())?;
    let (x, y) = (client_x * scale, client_y * scale);
    if x < 0. || y < 0. || x >= client.width as f64 || y >= client.height as f64 {
        return Err("Position de déplacement invalide.".into());
    }
    let hwnd = HWND(
        window
            .hwnd()
            .map_err(|_| "Fenêtre indisponible.".to_string())?
            .0,
    );
    let mut client_origin = POINT::default();
    let mut cursor = POINT::default();
    unsafe {
        ClientToScreen(hwnd, &mut client_origin)
            .ok()
            .map_err(|_| "Fenêtre indisponible.".to_string())?;
        GetCursorPos(&mut cursor).map_err(|_| "Déplacement indisponible.".to_string())?;
    }
    let dx = cursor.x - (client_origin.x + x.round() as i32);
    let dy = cursor.y - (client_origin.y + y.round() as i32);
    if dx != 0 || dy != 0 {
        let rect = window_rect(hwnd.0 as isize)
            .ok_or_else(|| "Fenêtre indisponible.".to_string())?;
        unsafe {
            SetWindowPos(
                hwnd,
                None,
                rect.x.round() as i32 + dx,
                rect.y.round() as i32 + dy,
                0,
                0,
                SWP_NOACTIVATE | SWP_NOSIZE | SWP_NOZORDER,
            )
            .map_err(|_| "Déplacement indisponible.".to_string())?;
        }
    }
    Ok(unsafe { GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0 })
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

pub fn show(
    window: &WebviewWindow,
    rect: Rect,
    radius: f64,
    regions: &[SurfaceRegion],
    scale: f64,
) -> Result<(), String> {
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
        let _ = strip_chrome_hwnd(hwnd);
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
        // One native region defines acrylic, silhouette and pass-through gaps.
        let region = make_region(width, height, radius, regions, scale);
        if SetWindowRgn(hwnd, Some(region), true) == 0 {
            let _ = DeleteObject(region.into());
            return Err("Découpe de la fenêtre indisponible.".into());
        }
    }
    Ok(())
}

unsafe fn make_region(width: u32, height: u32, radius: f64, regions: &[SurfaceRegion], scale: f64) -> HRGN {
    unsafe {
        if regions.is_empty() {
            CreateRoundRectRgn(0, 0, width as i32 + 1, height as i32 + 1, (radius * 2.).round() as i32, (radius * 2.).round() as i32)
        } else {
            let union = CreateRectRgn(0, 0, 0, 0);
            for item in regions {
                let piece = CreateRoundRectRgn(
                    (item.x * scale).round() as i32,
                    (item.y * scale).round() as i32,
                    ((item.x + item.width) * scale).round() as i32 + 1,
                    ((item.y + item.height) * scale).round() as i32 + 1,
                    (item.radius * scale * 2.).round() as i32,
                    (item.radius * scale * 2.).round() as i32,
                );
                let _ = CombineRgn(Some(union), Some(union), Some(piece), RGN_OR);
                let _ = DeleteObject(piece.into());
            }
            union
        }
    }
}

pub fn strip_chrome(window: &WebviewWindow) -> Result<(), String> {
    let handle = window
        .hwnd()
        .map_err(|_| "Fenêtre indisponible.".to_string())?
        .0 as isize;
    strip_chrome_handle(handle)
}

pub fn strip_chrome_handle(handle: isize) -> Result<(), String> {
    let hwnd = HWND(handle as *mut _);
    unsafe {
        if !strip_chrome_hwnd(hwnd) {
            return Ok(());
        }
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

unsafe fn strip_chrome_hwnd(hwnd: HWND) -> bool {
    // Tao 0.35 rebuilds top-level styles from its window flags when visibility
    // changes. Strip every caption-producing style at the HWND boundary too.
    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) };
    let chrome = (WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX).0;
    let frameless = style & !(chrome as isize);
    if style == frameless {
        return false;
    }
    unsafe { SetWindowLongPtrW(hwnd, GWL_STYLE, frameless) };
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::Graphics::Gdi::PtInRegion;

    #[test]
    fn union_region_keeps_surfaces_and_pass_through_gap() {
        let regions = [
            SurfaceRegion { x: 0., y: 20., width: 280., height: 80., radius: 26. },
            SurfaceRegion { x: 210., y: 0., width: 60., height: 18., radius: 9. },
        ];
        unsafe {
            let region = make_region(280, 100, 26., &regions, 1.);
            assert!(PtInRegion(region, 140, 50).as_bool());
            assert!(PtInRegion(region, 240, 9).as_bool());
            assert!(!PtInRegion(region, 100, 9).as_bool());
            assert!(!PtInRegion(region, 0, 20).as_bool());
            let _ = DeleteObject(region.into());
        }
    }
}
