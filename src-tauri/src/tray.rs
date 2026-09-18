//! The notification area icon: three states, two taskbar variants, two scales.
//!
//! The glyphs belong to another unit and are shipped as resources, so they are read at
//! run time and never with `include_bytes!`: a missing file leaves the icon in place
//! instead of breaking the build of the whole repository.
//!
//! The variant follows the **taskbar** theme (`SystemUsesLightTheme`), never the app
//! theme and never `AppsUseLightTheme`: Windows 11 sets them apart, and what matters is
//! the surface the glyph is drawn on.

use std::sync::atomic::{AtomicU8, Ordering};
use tauri::{image::Image, AppHandle, Manager};

pub const TRAY_ID: &str = "flowtranslate";

/// `Busy` while a result is being produced; `Alert` only for a failure that asks for
/// something — engine, paste, unreadable settings, refused shortcut. « Rien à traiter »
/// is an advice and touches neither the glyph nor the tooltip.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TrayState {
    Idle,
    Busy,
    Alert,
}

impl TrayState {
    fn slug(self) -> &'static str {
        match self {
            TrayState::Idle => "idle",
            TrayState::Busy => "busy",
            TrayState::Alert => "alert",
        }
    }
    fn code(self) -> u8 {
        match self {
            TrayState::Idle => 0,
            TrayState::Busy => 1,
            TrayState::Alert => 2,
        }
    }
    fn from_code(code: u8) -> Self {
        match code {
            1 => TrayState::Busy,
            2 => TrayState::Alert,
            _ => TrayState::Idle,
        }
    }
}

static STATE: AtomicU8 = AtomicU8::new(0);

pub fn state() -> TrayState {
    TrayState::from_code(STATE.load(Ordering::Acquire))
}

pub fn set_state(app: &AppHandle, state: TrayState) {
    STATE.store(state.code(), Ordering::Release);
    apply(app);
}

/// Back to rest, but never over an alert: an alert stays until the next success.
pub fn clear_busy(app: &AppHandle) {
    if state() == TrayState::Busy {
        set_state(app, TrayState::Idle);
    }
}

/// A success clears everything, alert included.
pub fn succeeded(app: &AppHandle) {
    set_state(app, TrayState::Idle);
}

/// 0 or missing: dark taskbar, which is the Windows default.
#[cfg(windows)]
pub fn taskbar_light() -> bool {
    use windows::core::w;
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
    let mut value: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"),
            w!("SystemUsesLightTheme"),
            RRF_RT_REG_DWORD,
            None,
            Some(std::ptr::addr_of_mut!(value).cast()),
            Some(&mut size),
        )
    };
    status.is_ok() && value == 1
}

#[cfg(not(windows))]
pub fn taskbar_light() -> bool {
    false
}

/// The file for a state, as the brand unit names it.
pub fn glyph_path(state: TrayState, light: bool, scale: f64) -> String {
    let variant = if light { "light" } else { "dark" };
    let retina = if scale >= 1.5 { "@2x" } else { "" };
    format!("icons/tray/tray-{}-{variant}-taskbar{retina}.png", state.slug())
}

fn read_glyph(app: &AppHandle, relative: &str) -> Option<Image<'static>> {
    let path = app
        .path()
        .resolve(relative, tauri::path::BaseDirectory::Resource)
        .ok()?;
    let bytes = std::fs::read(path).ok()?;
    Image::from_bytes(&bytes).ok().map(|image| image.to_owned())
}

/// Draws the current state. A file that is missing or unreadable keeps the icon that is
/// already there — including the application icon the tray was built with.
pub fn apply(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let scale = crate::host::primary_scale();
    let light = taskbar_light();
    let mut image = read_glyph(app, &glyph_path(state(), light, scale));
    if image.is_none() && scale >= 1.5 {
        image = read_glyph(app, &glyph_path(state(), light, 1.));
    }
    if let Some(image) = image {
        let _ = tray.set_icon(Some(image));
    }
}

#[cfg(windows)]
mod watcher {
    use super::*;
    use std::sync::OnceLock;
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        TranslateMessage, MSG, WINDOW_EX_STYLE, WINDOW_STYLE, WM_SETTINGCHANGE, WNDCLASSW,
    };

    static APP: OnceLock<AppHandle> = OnceLock::new();

    /// `lParam` of WM_SETTINGCHANGE is a string for some notifications and meaningless
    /// for others: it is read defensively, bounded, and only « ImmersiveColorSet » acts.
    unsafe fn is_color_set(lparam: LPARAM) -> bool {
        let pointer = lparam.0 as *const u16;
        if pointer.is_null() {
            return false;
        }
        let mut text = Vec::new();
        for offset in 0..64 {
            let unit = unsafe { *pointer.add(offset) };
            if unit == 0 {
                break;
            }
            text.push(unit);
        }
        String::from_utf16_lossy(&text) == "ImmersiveColorSet"
    }

    unsafe extern "system" fn proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if msg == WM_SETTINGCHANGE && unsafe { is_color_set(lparam) } {
            if let Some(app) = APP.get() {
                apply(app);
            }
        }
        unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
    }

    /// A hidden top-level window, on its own thread, with its own message loop.
    /// WM_SETTINGCHANGE is broadcast to top-level windows only, so a message-only
    /// window (HWND_MESSAGE) would never hear it.
    pub fn watch(app: AppHandle) {
        if APP.set(app).is_err() {
            return;
        }
        let _ = std::thread::Builder::new()
            .name("taskbar-theme".into())
            .spawn(|| unsafe {
                let instance = match GetModuleHandleW(None) {
                    Ok(instance) => instance,
                    Err(_) => return,
                };
                let class = WNDCLASSW {
                    lpfnWndProc: Some(proc),
                    hInstance: instance.into(),
                    lpszClassName: w!("FlowTranslateThemeWatcher"),
                    ..Default::default()
                };
                if RegisterClassW(&class) == 0 {
                    return;
                }
                let window = CreateWindowExW(
                    WINDOW_EX_STYLE(0),
                    w!("FlowTranslateThemeWatcher"),
                    PCWSTR::null(),
                    WINDOW_STYLE(0),
                    0,
                    0,
                    0,
                    0,
                    None,
                    None,
                    Some(instance.into()),
                    None,
                );
                if window.is_err() {
                    return;
                }
                let mut message = MSG::default();
                while GetMessageW(&mut message, None, 0, 0).as_bool() {
                    let _ = TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
            });
    }
}

#[cfg(windows)]
pub use watcher::watch;

#[cfg(not(windows))]
pub fn watch(_app: AppHandle) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_six_glyphs_are_named_as_the_brand_unit_ships_them() {
        assert_eq!(glyph_path(TrayState::Idle, false, 1.), "icons/tray/tray-idle-dark-taskbar.png");
        assert_eq!(glyph_path(TrayState::Idle, true, 1.25), "icons/tray/tray-idle-light-taskbar.png");
        assert_eq!(glyph_path(TrayState::Busy, false, 1.5), "icons/tray/tray-busy-dark-taskbar@2x.png");
        assert_eq!(glyph_path(TrayState::Alert, true, 2.), "icons/tray/tray-alert-light-taskbar@2x.png");
    }
}
