//! Lot 12, phase B: the hidden Acrylic trial (`settings.glassMaterial` = `acrylic`, never shown
//! in the settings; docs/DA-PLAN.md lot 12, the findings in docs/ACRYLIC-TRIAL.md). The WebView
//! cannot blur what lies behind its window, so the default glass is painted (phase A). Here one
//! native window of our own carries a real Windows Acrylic (`DWMSBT_TRANSIENTWINDOW`) right
//! under the overlay, sized to the Îlot's surface at rest: the shape the frontend published
//! last, a single region. Windows has no native morph: the material is cloaked as soon as the
//! overlay changes shape, place or capture, or starts to leave, and it comes back `SETTLE`
//! after the last change. While it shows, `data-backdrop="acrylic"` on the overlay's <html>
//! lets the surface through (the rule at the end of src/theme.css); without it, the painted
//! glass is unchanged. The window is never activated and lets every click through (layered and
//! transparent to the mouse: its corners outside the Îlot's rounded region would otherwise take
//! them, measured on 2026-09-24); it is shown once and then only cloaked (hiding it loses the
//! material, tauri#12854). Where Windows cannot draw the material as meant, the painted glass
//! stays (`fallback`).
use crate::types::{GlassMaterial, Rect};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// How long the shape must rest before the material comes back: the slowest spring of the
/// Îlot settles in 775 ms (src/motion/tokens.ts, bouncy morph), the entrance in 700 ms.
pub const SETTLE: std::time::Duration = std::time::Duration::from_millis(800);
/// The first build with `DWMWA_SYSTEMBACKDROP_TYPE` (Windows 11 22H2).
pub const FIRST_BUILD: u32 = 22621;
/// Test injection for the real window (docs/BRIDGE.md): forces one fallback condition.
pub const FORCE_FALLBACK: &str = "FLOWTRANSLATE_ACRYLIC_FALLBACK";
const SHOW: &str = "document.documentElement.setAttribute('data-backdrop','acrylic')";
const CONCEAL: &str = "document.documentElement.removeAttribute('data-backdrop')";

/// Why Windows would not draw the material as meant: the painted glass stays.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Fallback {
    /// Windows 10, or Windows 11 before 22H2: no system backdrop.
    OldWindows,
    /// Remote desktop: the material is drawn flat, and costs bandwidth.
    RemoteDesktop,
    /// High contrast: no transparency at all.
    HighContrast,
    /// « Effets de transparence » off: Windows draws a flat colour instead.
    Transparency,
    /// Energy saver (battery saver): Windows turns transparency off.
    EnergySaver,
}

/// What Windows says right now; read each time the material would show.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Conditions {
    pub build: u32,
    pub transparency: bool,
    pub energy_saver: bool,
    pub high_contrast: bool,
    pub remote: bool,
}

pub fn fallback(c: Conditions) -> Option<Fallback> {
    if c.build < FIRST_BUILD { return Some(Fallback::OldWindows); }
    if c.remote { return Some(Fallback::RemoteDesktop); }
    if c.high_contrast { return Some(Fallback::HighContrast); }
    if !c.transparency { return Some(Fallback::Transparency); }
    if c.energy_saver { return Some(Fallback::EnergySaver); }
    None
}

/// Why a shape keeps the painted glass.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Painted {
    /// `glassMaterial` is `painted` (the default).
    Setting,
    /// Not the Îlot's single surface (the v4 glass, several regions, no capture).
    Shape,
    Fallback(Fallback),
}

/// Whether the material shows under this shape. Windows is only read for an Îlot shape with
/// the setting on.
pub fn material(setting: GlassMaterial, ilot_shape: bool, conditions: impl FnOnce() -> Conditions) -> Result<(), Painted> {
    if setting != GlassMaterial::Acrylic { return Err(Painted::Setting); }
    if !ilot_shape { return Err(Painted::Shape); }
    match fallback(conditions()) {
        Some(reason) => Err(Painted::Fallback(reason)),
        None => Ok(()),
    }
}

/// `FLOWTRANSLATE_ACRYLIC_FALLBACK`: `windows10`, `remote`, `contrast`, `transparency` or
/// `energy` forces that condition over what Windows says; anything else changes nothing.
pub fn forced(injection: Option<&str>, mut c: Conditions) -> Conditions {
    match injection {
        Some("windows10") => c.build = 19045,
        Some("remote") => c.remote = true,
        Some("contrast") => c.high_contrast = true,
        Some("transparency") => c.transparency = false,
        Some("energy") => c.energy_saver = true,
        _ => {}
    }
    c
}

pub fn conditions() -> Conditions {
    forced(std::env::var(FORCE_FALLBACK).ok().as_deref(), imp::read())
}

/// Where the material goes: `rect` is physical, right under `overlay` in the z-order.
pub struct Target {
    pub overlay: isize,
    pub rect: Rect,
    pub dark: bool,
}

struct Backdrop {
    hwnd: isize,
    shown: bool,
    generation: u64,
}
static STATE: Mutex<Backdrop> = Mutex::new(Backdrop { hwnd: 0, shown: false, generation: 0 });

/// The overlay changed shape, place or capture: the material leaves at once and, with the
/// trial on, comes back on the shape that rests `SETTLE` later. Any thread.
pub fn reshape(app: &AppHandle, trial: bool) {
    let generation = conceal(app);
    if !trial { return; }
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(SETTLE).await;
        let inner = handle.clone();
        let _ = handle.run_on_main_thread(move || settle(&inner, generation));
    });
}

/// The overlay starts to leave, or hides: the material leaves at once. Any thread.
pub fn hide(app: &AppHandle) {
    conceal(app);
}

/// Cloaks the material and gives the surface its painted glass back. The attribute goes first:
/// the painted fill covers the material while it disappears. Windows is called after the lock
/// is released (this may run off the main thread while `settle` holds it there); a later
/// `settle` needs a later change, `SETTLE` away. The window stays where it is, cloaked.
fn conceal(app: &AppHandle) -> u64 {
    let (generation, shown) = {
        let Ok(mut state) = STATE.lock() else { return 0 };
        state.generation = state.generation.wrapping_add(1);
        let shown = std::mem::take(&mut state.shown).then_some(state.hwnd);
        (state.generation, shown)
    };
    if let Some(hwnd) = shown {
        if let Some(overlay) = app.get_webview_window("overlay") { let _ = overlay.eval(CONCEAL); }
        imp::conceal(hwnd);
    }
    generation
}

/// On the main thread, once the shape rested: the material under it, unless something changed
/// since or the shape keeps the painted glass (`crate::backdrop_target`).
fn settle(app: &AppHandle, generation: u64) {
    let Ok(mut state) = STATE.lock() else { return };
    if state.generation != generation || state.shown { return; }
    let Some(target) = crate::backdrop_target(app) else { return };
    if state.hwnd == 0 {
        let Some(hwnd) = imp::create() else { return };
        state.hwnd = hwnd;
    }
    if !imp::show(state.hwnd, &target) { return; }
    state.shown = true;
    if let Some(overlay) = app.get_webview_window("overlay") { let _ = overlay.eval(SHOW); }
}

#[cfg(windows)]
mod imp {
    use super::{Conditions, Target};
    use windows::core::{s, w, PCWSTR};
    use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::Graphics::Dwm::{
        DwmExtendFrameIntoClientArea, DwmSetWindowAttribute, DWMSBT_TRANSIENTWINDOW, DWMWA_BORDER_COLOR, DWMWA_CLOAK,
        DWMWA_COLOR_NONE, DWMWA_SYSTEMBACKDROP_TYPE, DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_WINDOW_CORNER_PREFERENCE,
        DWMWCP_ROUND, DWMWINDOWATTRIBUTE,
    };
    use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
    use windows::Win32::System::Registry::{RegGetValueW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_DWORD, RRF_RT_REG_SZ};
    use windows::Win32::UI::Accessibility::{HCF_HIGHCONTRASTON, HIGHCONTRASTW};
    use windows::Win32::UI::Controls::MARGINS;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, GetSystemMetrics, RegisterClassExW, SendMessageW, SetLayeredWindowAttributes,
        SetWindowPos, ShowWindow, SystemParametersInfoW, LWA_ALPHA, MA_NOACTIVATE, SM_REMOTESESSION, SPI_GETHIGHCONTRAST,
        SWP_NOACTIVATE, SWP_SHOWWINDOW, SW_SHOWNOACTIVATE,
        SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS, WM_MOUSEACTIVATE, WM_NCACTIVATE, WNDCLASSEXW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_NOREDIRECTIONBITMAP, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
    };

    const CLASS: PCWSTR = w!("FlowTranslateBackdrop");
    // Where it is created, out of every screen, until its first shape.
    const PARKED: i32 = -32000;

    // DWM draws a system backdrop « active » only on an active frame, and this window never is
    // one (the source or the Îlot keeps the keyboard): every deactivation is answered as an
    // activation, with lParam -1 (nothing repainted; plan, lot 12). Never activated.
    unsafe extern "system" fn proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        unsafe {
            match msg {
                WM_NCACTIVATE => DefWindowProcW(hwnd, msg, WPARAM(1), LPARAM(-1)),
                WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
                _ => DefWindowProcW(hwnd, msg, wparam, lparam),
            }
        }
    }

    unsafe fn set<T>(hwnd: HWND, attribute: DWMWINDOWATTRIBUTE, value: T) -> bool {
        unsafe { DwmSetWindowAttribute(hwnd, attribute, &value as *const T as *const _, std::mem::size_of::<T>() as u32).is_ok() }
    }

    /// The backdrop window, on the main thread: a popup without a surface of its own
    /// (WS_EX_NOREDIRECTIONBITMAP), its whole area given to the frame, rounded by Windows
    /// without a border, layered at full opacity and transparent to the mouse (Windows routes
    /// the clicks under such a window), shown once while cloaked. None when Windows refuses
    /// the material.
    pub fn create() -> Option<isize> {
        unsafe {
            let instance = GetModuleHandleW(None).ok()?;
            let class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(proc),
                hInstance: instance.into(),
                lpszClassName: CLASS,
                ..Default::default()
            };
            // 0 once the class exists: CreateWindowExW tells whether it does.
            let _ = RegisterClassExW(&class);
            let hwnd = CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST | WS_EX_NOREDIRECTIONBITMAP | WS_EX_LAYERED | WS_EX_TRANSPARENT,
                CLASS,
                w!("FlowTranslate"),
                WS_POPUP,
                PARKED,
                PARKED,
                1,
                1,
                None,
                None,
                Some(instance.into()),
                None,
            )
            .ok()?;
            let ready = SetLayeredWindowAttributes(hwnd, COLORREF(0), 255, LWA_ALPHA).is_ok()
                && set(hwnd, DWMWA_CLOAK, 1i32)
                && set(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND)
                && set(hwnd, DWMWA_BORDER_COLOR, DWMWA_COLOR_NONE)
                && set(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, DWMSBT_TRANSIENTWINDOW)
                && DwmExtendFrameIntoClientArea(hwnd, &MARGINS { cxLeftWidth: -1, cxRightWidth: -1, cyTopHeight: -1, cyBottomHeight: -1 }).is_ok();
            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
            let _ = SendMessageW(hwnd, WM_NCACTIVATE, Some(WPARAM(1)), Some(LPARAM(0)));
            ready.then_some(hwnd.0 as isize)
        }
    }

    /// Under the overlay, on the shape, in the theme, then uncloaked (main thread).
    pub fn show(handle: isize, target: &Target) -> bool {
        let hwnd = HWND(handle as *mut _);
        let (x, y) = (target.rect.x.round() as i32, target.rect.y.round() as i32);
        let (width, height) = (target.rect.width.round().max(1.) as i32, target.rect.height.round().max(1.) as i32);
        unsafe {
            let _ = set(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, i32::from(target.dark));
            if SetWindowPos(hwnd, Some(HWND(target.overlay as *mut _)), x, y, width, height, SWP_NOACTIVATE | SWP_SHOWWINDOW).is_err() {
                return false;
            }
            set(hwnd, DWMWA_CLOAK, 0i32)
        }
    }

    /// Cloaked where it stands (any thread): no SetWindowPos while the surface springs, and
    /// the mouse goes through it anyway.
    pub fn conceal(handle: isize) {
        if handle == 0 { return; }
        unsafe {
            let _ = set(HWND(handle as *mut _), DWMWA_CLOAK, 1i32);
        }
    }

    fn dword(root: HKEY, key: PCWSTR, value: PCWSTR) -> Option<u32> {
        let mut data = 0u32;
        let mut size = std::mem::size_of::<u32>() as u32;
        unsafe { RegGetValueW(root, key, value, RRF_RT_REG_DWORD, None, Some(&mut data as *mut u32 as *mut _), Some(&mut size)) }
            .is_ok()
            .then_some(data)
    }

    fn build() -> u32 {
        let mut text = [0u16; 16];
        let mut size = std::mem::size_of_val(&text) as u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                w!("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"),
                w!("CurrentBuildNumber"),
                RRF_RT_REG_SZ,
                None,
                Some(text.as_mut_ptr() as *mut _),
                Some(&mut size),
            )
        };
        if status.is_err() { return 0; }
        let len = text.iter().position(|c| *c == 0).unwrap_or(text.len());
        String::from_utf16_lossy(&text[..len]).trim().parse().unwrap_or(0)
    }

    #[repr(C)]
    #[derive(Default)]
    struct PowerStatus { ac: u8, battery: u8, percent: u8, system: u8, life: u32, full: u32 }

    // GetSystemPowerStatus, looked up in kernel32: its SystemStatusFlag is 1 while the battery
    // (energy) saver is on. Found by name to keep the crate's feature list as the plan names it.
    fn energy_saver() -> bool {
        type GetSystemPowerStatus = unsafe extern "system" fn(*mut PowerStatus) -> i32;
        unsafe {
            let Ok(kernel32) = GetModuleHandleW(w!("kernel32.dll")) else { return false };
            let Some(entry) = GetProcAddress(kernel32, s!("GetSystemPowerStatus")) else { return false };
            let get: GetSystemPowerStatus = std::mem::transmute(entry);
            let mut status = PowerStatus::default();
            get(&mut status) != 0 && status.system == 1
        }
    }

    fn high_contrast() -> bool {
        let mut contrast = HIGHCONTRASTW { cbSize: std::mem::size_of::<HIGHCONTRASTW>() as u32, ..Default::default() };
        unsafe {
            SystemParametersInfoW(SPI_GETHIGHCONTRAST, contrast.cbSize, Some(&mut contrast as *mut _ as *mut _), SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0)).is_ok()
                && contrast.dwFlags.contains(HCF_HIGHCONTRASTON)
        }
    }

    pub fn read() -> Conditions {
        Conditions {
            build: build(),
            // Missing value: Windows' default, transparency on.
            transparency: dword(HKEY_CURRENT_USER, w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"), w!("EnableTransparency")) != Some(0),
            energy_saver: energy_saver(),
            high_contrast: high_contrast(),
            remote: unsafe { GetSystemMetrics(SM_REMOTESESSION) } != 0,
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::{Conditions, Target};
    pub fn create() -> Option<isize> { None }
    pub fn show(_: isize, _: &Target) -> bool { false }
    pub fn conceal(_: isize) {}
    pub fn read() -> Conditions { Conditions { build: 0, transparency: false, energy_saver: false, high_contrast: false, remote: false } }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOWS_11: Conditions = Conditions { build: 26200, transparency: true, energy_saver: false, high_contrast: false, remote: false };

    #[test]
    fn the_material_shows_only_for_the_ilot_shape_with_the_trial_on_and_windows_able_to_draw_it() {
        let read = std::cell::Cell::new(0);
        let conditions = || { read.set(read.get() + 1); WINDOWS_11 };
        assert_eq!(material(GlassMaterial::Painted, true, conditions), Err(Painted::Setting));
        assert_eq!(material(GlassMaterial::Acrylic, false, conditions), Err(Painted::Shape));
        assert_eq!(read.get(), 0, "Windows is read only when the material could show");
        assert_eq!(material(GlassMaterial::Acrylic, true, conditions), Ok(()));
        assert_eq!(read.get(), 1);
        let off = |c: Conditions| material(GlassMaterial::Acrylic, true, || c);
        assert_eq!(off(Conditions { build: 19045, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::OldWindows)));
        assert_eq!(off(Conditions { build: 22000, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::OldWindows)), "Windows 11 21H2 has no system backdrop");
        assert_eq!(off(Conditions { build: FIRST_BUILD, ..WINDOWS_11 }), Ok(()));
        assert_eq!(off(Conditions { remote: true, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::RemoteDesktop)));
        assert_eq!(off(Conditions { high_contrast: true, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::HighContrast)));
        assert_eq!(off(Conditions { transparency: false, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::Transparency)));
        assert_eq!(off(Conditions { energy_saver: true, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::EnergySaver)));
        assert_eq!(off(Conditions { build: 0, ..WINDOWS_11 }), Err(Painted::Fallback(Fallback::OldWindows)), "an unreadable build falls back");
    }

    #[test]
    fn the_test_injection_forces_one_condition_and_nothing_else() {
        let fallback_of = |injection| fallback(forced(injection, WINDOWS_11));
        assert_eq!(fallback_of(None), None);
        assert_eq!(fallback_of(Some("windows10")), Some(Fallback::OldWindows));
        assert_eq!(fallback_of(Some("remote")), Some(Fallback::RemoteDesktop));
        assert_eq!(fallback_of(Some("contrast")), Some(Fallback::HighContrast));
        assert_eq!(fallback_of(Some("transparency")), Some(Fallback::Transparency));
        assert_eq!(fallback_of(Some("energy")), Some(Fallback::EnergySaver));
        assert_eq!(fallback_of(Some("anything")), None);
        assert_eq!(forced(Some("energy"), WINDOWS_11), Conditions { energy_saver: true, ..WINDOWS_11 });
    }
}
