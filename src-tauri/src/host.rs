//! Windows geometry only: UIA rectangles and Win32 placement stay physical.
use crate::types::Rect;
use tauri::WebviewWindow;
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
            GetForegroundWindow, GetWindowRect, SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE,
            SWP_SHOWWINDOW,
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
    unsafe {
        let h = window
            .hwnd()
            .map_err(|_| "Fenêtre indisponible.".to_string())?;
        let hwnd = HWND(h.0);
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            rect.x.round() as i32,
            rect.y.round() as i32,
            rect.width.round() as i32,
            rect.height.round() as i32,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
        .map_err(|_| "Placement indisponible.".to_string())?;
        // Clip native acrylic and hit testing to the same round silhouette as CSS.
        let region = CreateRoundRectRgn(
            0,
            0,
            rect.width.round() as i32 + 1,
            rect.height.round() as i32 + 1,
            (radius * 2.).round() as i32,
            (radius * 2.).round() as i32,
        );
        if SetWindowRgn(hwnd, Some(region), true) == 0 {
            let _ = DeleteObject(region.into());
        }
    }
    Ok(())
}
