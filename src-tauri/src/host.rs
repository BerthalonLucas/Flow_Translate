//! Windows geometry only: UIA rectangles and Win32 placement stay physical.
use crate::types::{Rect, SurfaceRegion};
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri::window::{Color, Effect, EffectsBuilder};
use windows::core::{s, w, BOOL};
use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
    Graphics::Gdi::{ClientToScreen, GetMonitorInfoW, MonitorFromPoint, HMONITOR, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::{
        HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
            KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE, MAPVK_VK_TO_VSC, VIRTUAL_KEY, VK_CONTROL, VK_ESCAPE,
            VK_INSERT, VK_LBUTTON, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
        },
        Shell::{DefSubclassProc, SetWindowSubclass},
        WindowsAndMessaging::{
            GetCursorPos, GetForegroundWindow, GetWindowLongPtrW, GetWindowRect, IsWindowVisible,
            SetForegroundWindow, SetWindowLongPtrW, ShowWindow, SW_HIDE,
            SetWindowPos, GWL_EXSTYLE, GWL_STYLE, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE,
            SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, WM_NCACTIVATE, WM_NCPAINT,
            WS_CAPTION, WS_EX_LAYERED, WS_EX_TRANSPARENT, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
            WS_SYSMENU, WS_THICKFRAME,
        },
    },
};

// Undocumented UxTheme requests to draw the caption or the frame (0x00AE / 0x00AF).
const WM_NCUAHDRAWCAPTION: u32 = 0x00AE;
const WM_NCUAHDRAWFRAME: u32 = 0x00AF;
const SILENT_FRAME_SUBCLASS: usize = 0x466C_6F77;

// Reproduced on 2026-09-13 (release/ui-evidence/band-repro): every activation change made
// DefWindowProc paint a basic title band over the top of the frameless overlay, caption
// styles or not, and nothing repainted it before the next resize. The same message with
// lParam = -1 (« do not repaint ») painted nothing. This subclass is installed after Tao's,
// so comctl32 calls it first: WM_NCACTIVATE still reaches Tao (activation bookkeeping,
// Focused events) but DefWindowProc receives -1; the non-client paint requests are dropped.
unsafe extern "system" fn silent_frame_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    unsafe {
        match msg {
            WM_NCACTIVATE => DefSubclassProc(hwnd, msg, wparam, LPARAM(-1)),
            WM_NCPAINT | WM_NCUAHDRAWCAPTION | WM_NCUAHDRAWFRAME => LRESULT(0),
            _ => DefSubclassProc(hwnd, msg, wparam, lparam),
        }
    }
}

/// Keeps Windows from ever painting a frame on this window. Call from the window's thread.
pub fn silence_frame(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = HWND(window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?.0);
    unsafe {
        SetWindowSubclass(hwnd, Some(silent_frame_proc), SILENT_FRAME_SUBCLASS, 0)
            .ok()
            .map_err(|_| "Cadre natif non neutralisé.".to_string())
    }
}

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

/// Work area and scale of the monitor holding `location`; without one, the monitor
/// under the cursor (the bottom band opens on the screen the mouse is on).
pub fn monitor(location: Option<Rect>) -> (Rect, f64) {
    let (work, scale, _) = monitor_at(location);
    (work, scale)
}

/// The monitor under `location` (its centre), or under the cursor when None: work area
/// in physical pixels, DPI scale and the HMONITOR that identifies the screen.
pub fn monitor_at(location: Option<Rect>) -> (Rect, f64, isize) {
    let location = location
        .or_else(|| cursor_position().map(|p| Rect { x: p.x as f64, y: p.y as f64, width: 1., height: 1. }))
        .unwrap_or(Rect { x: 0., y: 0., width: 1., height: 1. });
    let handle = unsafe {
        MonitorFromPoint(
            POINT {
                x: (location.x + location.width / 2.) as i32,
                y: (location.y + location.height / 2.) as i32,
            },
            MONITOR_DEFAULTTONEAREST,
        )
    };
    let (work, scale) = monitor_info(handle.0 as isize);
    (work, scale, handle.0 as isize)
}

/// The screen under the cursor (test override honoured), as an HMONITOR value.
pub fn cursor_monitor() -> isize {
    let Some(p) = cursor_position() else { return 0 };
    unsafe { MonitorFromPoint(POINT { x: p.x, y: p.y }, MONITOR_DEFAULTTONEAREST).0 as isize }
}

/// Work area (physical) and DPI scale of a screen known by its HMONITOR.
pub fn monitor_info(handle: isize) -> (Rect, f64) {
    let m = HMONITOR(handle as *mut _);
    unsafe {
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

/// Whether a client point lies within `margin` logical pixels of one of the surfaces
/// (their bounding boxes, inflated): the glass counts a pointer resting in its shadow as
/// still there, so leaving is judged on the silhouette rather than on the tight boxes.
pub fn near(regions: &[SurfaceRegion], scale: f64, x: f64, y: f64, margin: f64) -> bool {
    let m = margin * scale;
    regions.iter().any(|region| {
        x >= region.x * scale - m
            && y >= region.y * scale - m
            && x <= (region.x + region.width) * scale + m
            && y <= (region.y + region.height) * scale + m
    })
}

const NEAR_MARGIN: f64 = 32.;

/// Cursor in client coordinates (physical pixels, pixel centre).
unsafe fn cursor_client(hwnd: HWND) -> Option<(f64, f64)> {
    let cursor = cursor_position()?;
    let mut origin = POINT::default();
    if unsafe { !ClientToScreen(hwnd, &mut origin).as_bool() } {
        return None;
    }
    Some(((cursor.x - origin.x) as f64 + 0.5, (cursor.y - origin.y) as f64 + 0.5))
}

unsafe fn cursor_inside(hwnd: HWND, surface: &Surface) -> bool {
    unsafe { cursor_client(hwnd) }
        .is_some_and(|(x, y)| contains(&surface.regions, surface.scale, x, y))
}

#[derive(Clone, serde::Serialize)]
struct GlassNear {
    near: bool,
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
/// its window through the drag, a press outside never lands on it. The overlay also
/// learns, on change only, whether the cursor rests within 32 px of one of its surfaces
/// (`glass-near`): the frontend holds the glass open while it does. No point is logged.
/// `on_screen` is called from the poller's thread whenever the cursor changes screen
/// while a surface is visible (2026-09-14): the bottom forms follow the mouse.
pub fn start_hit_tester(app: AppHandle, overlay: isize, on_screen: impl Fn(&AppHandle, isize) + Send + 'static) {
    let _ = std::thread::Builder::new().name("hit-tester".into()).spawn(move || {
        let mut was_near: Option<bool> = None;
        let mut last_monitor = 0isize;
        loop {
            let mut any_visible = false;
            for (handle, surface) in surfaces() {
                let hwnd = HWND(handle as *mut _);
                unsafe {
                    if !IsWindowVisible(hwnd).as_bool() {
                        if handle == overlay {
                            was_near = None;
                        }
                        continue;
                    }
                    any_visible = true;
                    let client = cursor_client(hwnd);
                    if handle == overlay {
                        let near = client.is_some_and(|(x, y)| near(&surface.regions, surface.scale, x, y, NEAR_MARGIN));
                        if was_near != Some(near) {
                            was_near = Some(near);
                            let _ = app.emit_to("overlay", "glass-near", GlassNear { near });
                        }
                    }
                    if GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0 {
                        continue;
                    }
                    let inside = client.is_some_and(|(x, y)| contains(&surface.regions, surface.scale, x, y));
                    pass_through(hwnd, !inside);
                }
            }
            if any_visible {
                let monitor = cursor_monitor();
                if monitor != 0 && monitor != last_monitor {
                    last_monitor = monitor;
                    on_screen(&app, monitor);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(if any_visible { 8 } else { 50 }));
        }
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

/// Sizes, moves and shows the window (frameless, topmost, never activated). Only called
/// when the rectangle changes: the reserved window keeps its size through every fold,
/// unfold or menu, so those cost no `SetWindowPos` at all.
pub fn place(window: &WebviewWindow, rect: Rect) -> Result<(), String> {
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
        let hwnd = HWND(window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?.0);
        let chrome_changed = strip_chrome_hwnd(hwnd);
        let mut flags = SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW;
        if chrome_changed {
            flags |= SWP_FRAMECHANGED;
        }
        SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags)
            .map_err(|_| "Placement indisponible.".to_string())?;
    }
    Ok(())
}

/// Publishes the surfaces the hit tester reads. The pass-through state is set at once:
/// the cursor is almost always outside the glass when it appears, and a surface that
/// just vanished under the pointer must stop catching clicks before the next poll.
pub fn set_regions(window: &WebviewWindow, regions: &[SurfaceRegion], scale: f64) -> Result<(), String> {
    let h = window.hwnd().map_err(|_| "Fenêtre indisponible.".to_string())?;
    let hwnd = HWND(h.0);
    let surface = Surface { regions: regions.to_vec(), scale };
    unsafe { pass_through(hwnd, !cursor_inside(hwnd, &surface)) };
    remember_surface(h.0 as isize, surface);
    Ok(())
}

pub fn show(
    window: &WebviewWindow,
    rect: Rect,
    regions: &[SurfaceRegion],
    scale: f64,
) -> Result<(), String> {
    place(window, rect)?;
    set_regions(window, regions, scale)
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


// ---------------------------------------------------------------------------------
// Clipboard freshness and the synthetic copy (2026-09-14, direct capture)
//
// Without a UIA selection the shortcut used to read whatever the clipboard held,
// silently: hence Lucas's Ctrl+C reflex. The capture now copies for him with a
// synthetic Ctrl+Insert (the CUA copy chord: every Windows control, Chromium, Office,
// Qt, Java and both consoles honour it, and unlike Ctrl+C it never becomes SIGINT in a
// terminal), then reads and restores the clipboard. `GetClipboardSequenceNumber` tells
// whether the target actually copied; the context watcher samples the same counter so
// a copy the user made himself less than three seconds ago still counts as fresh.
// Nothing here logs or keeps any clipboard text.

static CLIPBOARD_SEEN: AtomicU32 = AtomicU32::new(0);
static CLIPBOARD_CHANGED_AT: AtomicU64 = AtomicU64::new(0);
static CLIPBOARD_SUPPRESSED_UNTIL: AtomicU64 = AtomicU64::new(0);
static CLOCK: OnceLock<Instant> = OnceLock::new();

/// Milliseconds since the first call: a monotonic clock shared by the watcher and the
/// capture, never 0 (0 means « never » in the atomics above).
pub fn now_ms() -> u64 {
    let start = CLOCK.get_or_init(Instant::now);
    start.elapsed().as_millis() as u64 + 1
}

pub fn clipboard_sequence() -> u32 {
    unsafe { GetClipboardSequenceNumber() }
}

/// Called by the context watcher every 35 ms: dates the last clipboard change that is
/// not one of ours (the synthetic copy and the restoration are suppressed).
pub fn track_clipboard() {
    let sequence = clipboard_sequence();
    let previous = CLIPBOARD_SEEN.swap(sequence, Ordering::AcqRel);
    if previous == 0 || previous == sequence {
        return;
    }
    let now = now_ms();
    if now >= CLIPBOARD_SUPPRESSED_UNTIL.load(Ordering::Acquire) {
        CLIPBOARD_CHANGED_AT.store(now, Ordering::Release);
    }
}

/// When the clipboard last changed by the user's hand, in `now_ms` time (None: never seen).
pub fn clipboard_changed_at() -> Option<u64> {
    match CLIPBOARD_CHANGED_AT.load(Ordering::Acquire) {
        0 => None,
        at => Some(at),
    }
}

/// The clipboard changes of the next `window` are ours: the watcher must not date them.
pub fn suppress_clipboard_tracking(window: Duration) {
    CLIPBOARD_SUPPRESSED_UNTIL.store(now_ms() + window.as_millis() as u64, Ordering::Release);
    // Resynchronise so the next sample compares against the current counter.
    CLIPBOARD_SEEN.store(clipboard_sequence(), Ordering::Release);
}

pub fn modifiers_down() -> bool {
    [VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN]
        .iter()
        .any(|key| unsafe { GetAsyncKeyState(key.0 as i32) } < 0)
}

/// The shortcut chord is still physically held when its handler runs: an Insert sent
/// under Ctrl+Alt would be another chord. Waits, at most `timeout`, for every modifier
/// to be released; false when the user keeps them down.
pub fn wait_modifiers_released(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while modifiers_down() {
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    true
}

/// `extended`: the navigation Insert is E0 52; without the flag the same scan code is
/// the numpad 0/Ins, which Chromium reads as Ctrl+Numpad0 (matrix of 2026-09-14).
fn key_input(key: VIRTUAL_KEY, extended: bool, up: bool) -> INPUT {
    let scan = unsafe { MapVirtualKeyW(key.0 as u32, MAPVK_VK_TO_VSC) } as u16;
    let mut flags = KEYEVENTF_SCANCODE;
    if extended { flags |= KEYEVENTF_EXTENDEDKEY; }
    if up { flags |= KEYEVENTF_KEYUP; }
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: scan,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// Sends Ctrl+Insert to the foreground window: the copy chord, never SIGINT.
pub fn send_copy_chord() -> Result<(), String> {
    let inputs = [
        key_input(VK_CONTROL, false, false),
        key_input(VK_INSERT, true, false),
        key_input(VK_INSERT, true, true),
        key_input(VK_CONTROL, false, true),
    ];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        if sent > 0 {
            let release = [key_input(VK_INSERT, true, true), key_input(VK_CONTROL, false, true)];
            unsafe { SendInput(&release, std::mem::size_of::<INPUT>() as i32); }
        }
        return Err("La copie synthétique a été bloquée.".into());
    }
    Ok(())
}

/// One serial batch, no Ctrl+A and no Enter: the target editor handles paste/undo.
pub fn send_paste_chord() -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::VK_V;
    let inputs = [key_input(VK_CONTROL, false, false), key_input(VK_V, false, false),
        key_input(VK_V, false, true), key_input(VK_CONTROL, false, true)];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        let release = [key_input(VK_V, false, true), key_input(VK_CONTROL, false, true)];
        if sent > 0 { unsafe { SendInput(&release, std::mem::size_of::<INPUT>() as i32); } }
        return Err("Collage non confirmé (Windows ou application protégée). Vérifiez le champ avant de réessayer.".into());
    }
    Ok(())
}

/// Waits, at most `timeout`, for the clipboard counter to leave `before`.
pub fn wait_clipboard_change(before: u32, timeout: Duration) -> Option<u32> {
    let deadline = Instant::now() + timeout;
    loop {
        let now = clipboard_sequence();
        if now != before {
            return Some(now);
        }
        if Instant::now() >= deadline {
            return None;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn the_clipboard_sequence_is_readable_from_a_worker_thread() {
        // Zero means no access to the window station's clipboard: on a desktop the
        // freshness rule and the synthetic copy would both be blind, so a worker thread
        // must read it too. A CI runner without an interactive desktop reads zero from
        // every thread; there is nothing to check there.
        if clipboard_sequence() == 0 {
            eprintln!("no clipboard sequence in this session (no interactive window station): skipped");
            return;
        }
        let sequence = std::thread::spawn(clipboard_sequence).join().unwrap();
        assert_ne!(sequence, 0);
    }

    #[test]
    fn the_pointer_counts_as_near_within_the_margin_around_any_surface() {
        let regions = [
            SurfaceRegion { x: 32., y: 34., width: 300., height: 120., radius: 28. },
            SurfaceRegion { x: 160., y: 200., width: 44., height: 20., radius: 10. },
        ];
        // Just outside the glass box, inside the margin; the corner is judged on the box.
        assert!(near(&regions, 1., 20., 40., 32.));
        assert!(near(&regions, 1., 32., 34., 32.));
        assert!(near(&regions, 1., 340., 160., 32.));
        // Beyond the margin, and in the gap between the two surfaces once the margin is spent.
        assert!(!near(&regions, 1., -1., 40., 32.));
        assert!(!near(&regions, 1., 500., 500., 32.));
        assert!(!near(&regions, 1., 100., 300., 32.));
        // The margin is logical: at 150 % it stretches with the surfaces.
        assert!(near(&regions, 1.5, 0., 51., 32.));
        assert!(!near(&regions, 1.5, 0., 0., 32.));
    }

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
