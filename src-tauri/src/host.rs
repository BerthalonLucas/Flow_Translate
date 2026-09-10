//! Windows geometry only: UIA rectangles and Win32 placement stay physical.
use crate::types::{Rect, SurfaceRegion};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::Mutex;
use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri::window::{Color, Effect, EffectsBuilder};
use windows::core::{s, w, BOOL};
use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
use windows::Win32::{
    Foundation::{HWND, POINT, RECT},
    Graphics::Gdi::{ClientToScreen, GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::{
        HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
        Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE, VK_LBUTTON},
        WindowsAndMessaging::{
            GetCursorPos, GetForegroundWindow, GetWindowLongPtrW, GetWindowRect, IsWindowVisible,
            SetForegroundWindow, SetWindowLongPtrW, ShowWindow, SW_HIDE,
            SetWindowPos, GWL_EXSTYLE, GWL_STYLE, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE,
            SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, WS_CAPTION, WS_EX_LAYERED,
            WS_EX_TRANSPARENT, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_SYSMENU, WS_THICKFRAME,
        },
    },
};

/// Material behind the glass. `DWMWA_SYSTEMBACKDROP_TYPE` (Tauri's `Effect::Acrylic`
/// on Windows 11) paints the material behind the *entire window bounds*, so the
/// window region never clips it: that was the grey frame around the bubble. Any
/// material also shows through DOM fades. The glass therefore paints itself (no
/// material); `FLOWTRANSLATE_GLASS=blur|acrylic|dwm` remains for experiments.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Glass { Blur, Acrylic, Dwm, None }

pub fn glass_mode() -> Glass {
    match std::env::var("FLOWTRANSLATE_GLASS").as_deref() {
        Ok("dwm") => Glass::Dwm,
        Ok("acrylic") => Glass::Acrylic,
        Ok("blur") => Glass::Blur,
        _ => Glass::None,
    }
}

#[repr(C)]
struct AccentPolicy { state: u32, flags: u32, gradient: u32, animation: u32 }
#[repr(C)]
struct CompositionAttribute { attribute: u32, data: *mut core::ffi::c_void, size: usize }

unsafe fn set_accent(hwnd: HWND, state: u32, flags: u32, gradient: u32) {
    type SetWindowCompositionAttribute = unsafe extern "system" fn(HWND, *mut CompositionAttribute) -> BOOL;
    unsafe {
        let Ok(user32) = GetModuleHandleW(w!("user32.dll")) else { return };
        let Some(entry) = GetProcAddress(user32, s!("SetWindowCompositionAttribute")) else { return };
        let set: SetWindowCompositionAttribute = std::mem::transmute(entry);
        let mut policy = AccentPolicy { state, flags, gradient, animation: 0 };
        let mut data = CompositionAttribute { attribute: 19, data: &mut policy as *mut _ as _, size: std::mem::size_of::<AccentPolicy>() };
        let _ = set(hwnd, &mut data);
    }
}

pub fn apply_glass(window: &WebviewWindow) {
    let hwnd = HWND(handle(window) as *mut _);
    // ABGR tint packed as r | g << 8 | b << 16 | a << 24 (graphite, light alpha).
    let tint = 29u32 | (31u32 << 8) | (36u32 << 16) | (48u32 << 24);
    match glass_mode() {
        Glass::Dwm => { let _ = window.set_effects(EffectsBuilder::new().effect(Effect::Acrylic).color(Color(29, 31, 36, 30)).build()); }
        Glass::Acrylic => unsafe { set_accent(hwnd, 4, 0, tint) },
        Glass::Blur => unsafe { set_accent(hwnd, 3, 2, tint) },
        Glass::None => {}
    }
}

pub fn foreground() -> isize {
    unsafe { GetForegroundWindow().0 as isize }
}
pub fn show_capture_error(message: &str) {
    use windows::{
        core::{w, HSTRING},
        Win32::UI::WindowsAndMessaging::{
            MessageBoxW, MB_ICONWARNING, MB_OK, MB_SETFOREGROUND,
        },
    };
    let message = HSTRING::from(message);
    unsafe {
        let _ = MessageBoxW(
            None,
            &message,
            w!("FlowTranslate"),
            MB_OK | MB_ICONWARNING | MB_SETFOREGROUND,
        );
    }
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

// The overlay and the capsule never go through Tao's show()/hide(): show() uses
// SetWindowPos directly so the source keeps its focus, and any later Tao
// visibility diff rebuilds the styles with WS_CAPTION | WS_SYSMENU (Tao 0.35
// `WindowFlags::apply_diff`), which DWM then paints as a « FlowTranslate » title.
// Every visibility and focus change therefore stays at the HWND boundary, and
// `repair_handle` strips the caption whenever Tao or Windows touched the frame.
//
// The window carries no Win32 region (2026-09-10): a region is a 1-bit mask that DWM
// clips without anti-aliasing and that drops every shadow outside it (the jagged
// « cut with a cutter » edges Lucas reported). Chromium paints the silhouette with
// per-pixel alpha through Tao's DwmEnableBlurBehindWindow transparency; the tight
// regions the frontend publishes only feed the hit-test below.
#[derive(Clone)]
struct Surface {
    regions: Vec<SurfaceRegion>,
    scale: f64,
}

static SURFACES: Mutex<Vec<(isize, Surface)>> = Mutex::new(Vec::new());

fn remember_surface(handle: isize, surface: Surface) {
    if let Ok(mut surfaces) = SURFACES.lock() {
        match surfaces.iter_mut().find(|(known, _)| *known == handle) {
            Some(entry) => entry.1 = surface,
            None => surfaces.push((handle, surface)),
        }
    }
}

fn surfaces() -> Vec<(isize, Surface)> {
    SURFACES.lock().map(|surfaces| surfaces.clone()).unwrap_or_default()
}

/// Whether a client point (physical pixels) lies in one of the rounded surfaces.
pub fn contains(regions: &[SurfaceRegion], scale: f64, x: f64, y: f64) -> bool {
    regions.iter().any(|region| {
        let (left, top) = (region.x * scale, region.y * scale);
        let (width, height) = (region.width * scale, region.height * scale);
        if x < left || y < top || x > left + width || y > top + height {
            return false;
        }
        let radius = (region.radius * scale).min(width / 2.).min(height / 2.);
        let cx = x.clamp(left + radius, left + width - radius);
        let cy = y.clamp(top + radius, top + height - radius);
        (x - cx).powi(2) + (y - cy).powi(2) <= radius * radius
    })
}

static CURSOR_OVERRIDE: Mutex<Option<(i32, i32)>> = Mutex::new(None);

/// Test hook, honoured only under the WebView2 probe (`FLOWTRANSLATE_CDP_URL` set by
/// `scripts/test-native-ui.ps1`): a locked session neither moves nor reports the real
/// cursor, so the probe feeds the hit tester a screen point instead.
pub fn override_cursor(point: Option<(i32, i32)>) -> Result<(), String> {
    if std::env::var_os("FLOWTRANSLATE_CDP_URL").is_none() {
        return Err("Indisponible hors test.".into());
    }
    *CURSOR_OVERRIDE.lock().map_err(|_| "Verrou indisponible.".to_string())? = point;
    Ok(())
}

fn cursor_position() -> Option<POINT> {
    if let Some((x, y)) = CURSOR_OVERRIDE.lock().ok().and_then(|point| *point) {
        return Some(POINT { x, y });
    }
    let mut cursor = POINT::default();
    unsafe { GetCursorPos(&mut cursor).ok()? };
    Some(cursor)
}

unsafe fn cursor_inside(hwnd: HWND, surface: &Surface) -> bool {
    let Some(cursor) = cursor_position() else { return false };
    let mut origin = POINT::default();
    if unsafe { !ClientToScreen(hwnd, &mut origin).as_bool() } {
        return false;
    }
    contains(&surface.regions, surface.scale, (cursor.x - origin.x) as f64 + 0.5, (cursor.y - origin.y) as f64 + 0.5)
}

/// Windows routes the mouse under a layered window that carries WS_EX_TRANSPARENT;
/// both styles are set and cleared together, only when the state changes.
unsafe fn pass_through(hwnd: HWND, on: bool) {
    let mask = (WS_EX_TRANSPARENT | WS_EX_LAYERED).0 as isize;
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let next = if on { current | mask } else { current & !mask };
        if next != current {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
        }
    }
}

/// Hit-testing without a region: while a surface window is visible, the real cursor is
/// compared with its rounded surfaces every 8 ms and the pass-through styles follow.
/// Nothing toggles while the primary button is down: a press inside the glass keeps
/// its window through the drag, a press outside never lands on it.
pub fn start_hit_tester() {
    let _ = std::thread::Builder::new().name("hit-tester".into()).spawn(|| loop {
        let mut any_visible = false;
        for (handle, surface) in surfaces() {
            let hwnd = HWND(handle as *mut _);
            unsafe {
                if !IsWindowVisible(hwnd).as_bool() {
                    continue;
                }
                any_visible = true;
                if GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0 {
                    continue;
                }
                pass_through(hwnd, !cursor_inside(hwnd, &surface));
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(if any_visible { 8 } else { 50 }));
    });
}

pub fn hide(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?;
    unsafe { let _ = ShowWindow(HWND(hwnd.0), SW_HIDE); }
    Ok(())
}

/// Brings the already visible overlay to the foreground so the WebView receives
/// the keyboard, then re-establishes the frameless silhouette.
pub fn activate(window: &WebviewWindow) -> Result<(), String> {
    let handle = window
        .hwnd()
        .map_err(|_| "Fenêtre indisponible.".to_string())?
        .0 as isize;
    let hwnd = HWND(handle as *mut _);
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() {
            return Err("La capture n’est plus active.".into());
        }
        // The request comes from a click in the capsule, so this process owns the
        // foreground and Windows grants the switch; a refusal is not an error.
        if GetForegroundWindow() != hwnd {
            let _ = SetForegroundWindow(hwnd);
        }
    }
    repair_handle(handle)
}

pub fn show(
    window: &WebviewWindow,
    rect: Rect,
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
        let chrome_changed = strip_chrome_hwnd(hwnd);
        let mut flags = SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW;
        if chrome_changed {
            flags |= SWP_FRAMECHANGED;
        }
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            flags,
        )
        .map_err(|_| "Placement indisponible.".to_string())?;
        // The pass-through state is set before the first frame: the cursor is almost
        // always outside the glass when it appears, and the hit tester takes over.
        let surface = Surface { regions: regions.to_vec(), scale };
        pass_through(hwnd, !cursor_inside(hwnd, &surface));
        remember_surface(h.0 as isize, surface);
    }
    Ok(())
}

/// Strips any caption Tao rebuilt. Safe from any thread: both calls message the
/// window's thread.
pub fn repair_handle(handle: isize) -> Result<(), String> {
    let hwnd = HWND(handle as *mut _);
    unsafe {
        if strip_chrome_hwnd(hwnd) {
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

    #[test]
    fn rounded_surfaces_take_the_cursor_and_the_gaps_let_it_through() {
        let regions = [
            SurfaceRegion { x: 0., y: 20., width: 280., height: 80., radius: 26. },
            SurfaceRegion { x: 210., y: 0., width: 60., height: 18., radius: 9. },
        ];
        assert!(contains(&regions, 1., 140.5, 50.5), "glass");
        assert!(contains(&regions, 1., 240.5, 9.5), "pill");
        assert!(!contains(&regions, 1., 100.5, 9.5), "gap above the glass");
        assert!(!contains(&regions, 1., 0.5, 20.5), "outside the corner arc");
        assert!(contains(&regions, 1., 26.5, 46.5), "corner centre");
        assert!(contains(&regions, 2., 280.5, 100.5), "scaled glass");
        assert!(!contains(&regions, 2., 140.5, 19.5), "scaled gap");
        assert!(!contains(&[], 1., 10., 10.), "no surface");
    }
}
