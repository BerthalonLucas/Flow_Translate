//! The `halo` window (« Îlot », lot 6): the light sweep over the selection's lines while
//! an action works. Transparent, never hit (`WS_EX_TRANSPARENT | WS_EX_LAYERED` set once,
//! outside the 8 ms hit tester), never activated, above the source and right under the
//! overlay. Rust places it on the lines of the capture (`selection_lines`) and hands the
//! page their logical rectangles; the page only draws. Every window call runs on the main
//! thread, in order, and a generation drops the calls a newer one overtook.
use crate::host;
use crate::selection_lines::{bounds, halo_frame, HALO_MARGIN};
use crate::types::Rect;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

static GENERATION: AtomicU64 = AtomicU64::new(0);
static VISIBLE: AtomicBool = AtomicBool::new(false);
/// The page fades out in 150 ms; the window hides once that is over.
const LEAVE: Duration = Duration::from_millis(200);

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HaloPhase {
    /// The work started: draw the lines (the page waits 250 ms, like the orb).
    Work,
    /// The response arrived: fade out.
    Leave,
    /// Hidden: draw nothing.
    Clear,
}

/// What the page draws: logical pixels relative to the window, which is `width` × `height`.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HaloEvent {
    pub generation: u64,
    pub phase: HaloPhase,
    pub lines: Vec<Rect>,
    pub width: f64,
    pub height: f64,
}

impl HaloEvent {
    fn empty(generation: u64, phase: HaloPhase) -> Self {
        Self { generation, phase, lines: Vec::new(), width: 0., height: 0. }
    }
}

/// Shown, or about to be: the context watcher checks the selection faster meanwhile.
pub fn visible() -> bool {
    VISIBLE.load(Ordering::Acquire)
}

/// Shows the sweep over `lines` (physical screen pixels, `Capture.selectionRects`) for the
/// work that starts. Placed at the DPI of the screen under the lines; when Windows gives
/// the window another one (lines across two screens), placed again at the window's own.
pub fn work(app: &AppHandle, lines: &[Rect]) {
    let generation = GENERATION.fetch_add(1, Ordering::AcqRel) + 1;
    let Some(union) = bounds(lines) else { return hide(app) };
    let (_, scale, _) = host::monitor_at(Some(union));
    let Some(first) = halo_frame(lines, scale, HALO_MARGIN) else { return hide(app) };
    let lines = lines.to_vec();
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if GENERATION.load(Ordering::Acquire) != generation { return; }
        let Some(halo) = handle.get_webview_window("halo") else { return };
        let overlay = handle.get_webview_window("overlay").map(|window| host::handle(&window)).unwrap_or(0);
        let mut frame = first;
        if host::place_below(&halo, frame.window, overlay).is_err() { return; }
        if let Some(again) = halo.scale_factor().ok().filter(|actual| (actual - scale).abs() > 1e-3).and_then(|actual| halo_frame(&lines, actual, HALO_MARGIN)) {
            frame = again;
            if host::place_below(&halo, frame.window, overlay).is_err() { return; }
        }
        VISIBLE.store(true, Ordering::Release);
        let _ = handle.emit_to("halo", "halo", HaloEvent { generation, phase: HaloPhase::Work, lines: frame.lines, width: frame.width, height: frame.height });
    });
}

/// The response arrived (a result or an error): the page fades, then the window hides.
pub fn leave(app: &AppHandle) {
    if !visible() { return; }
    let generation = GENERATION.load(Ordering::Acquire);
    let _ = app.emit_to("halo", "halo", HaloEvent::empty(generation, HaloPhase::Leave));
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(LEAVE);
        hide_window(&handle, generation);
    });
}

/// Hides at once: dismissal, a new capture, a cancelled request, a selection that moved,
/// scrolled or changed. Never waits for the page.
pub fn hide(app: &AppHandle) {
    let generation = GENERATION.fetch_add(1, Ordering::AcqRel) + 1;
    hide_window(app, generation);
}

fn hide_window(app: &AppHandle, generation: u64) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if GENERATION.load(Ordering::Acquire) != generation { return; }
        if let Some(halo) = handle.get_webview_window("halo") { let _ = host::hide(&halo); }
        if VISIBLE.swap(false, Ordering::AcqRel) {
            let _ = handle.emit_to("halo", "halo", HaloEvent::empty(generation, HaloPhase::Clear));
        }
    });
}
