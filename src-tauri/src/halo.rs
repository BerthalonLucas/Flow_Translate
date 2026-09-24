//! The `halo` window (« Îlot », lot 6): the light sweep over the selection's lines while
//! an action works, then (lot 9) the marks on the changed words while Undo is offered. Transparent, never hit (`WS_EX_TRANSPARENT | WS_EX_LAYERED` set once,
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
/// What the window shows: the marks of lot 9 (true) or the sweep.
static MARKS: AtomicBool = AtomicBool::new(false);
/// A `leave` is under way for the current generation: a second one sends nothing.
static LEAVING: AtomicBool = AtomicBool::new(false);
/// The generation whose fade `leave` started (0: none yet): its window hides by itself once the
/// fade is over, unless a newer generation overtook it.
static FADING: AtomicU64 = AtomicU64::new(0);
/// The sweep fades out in 150 ms, the marks in 900 ms; the window hides once that is over.
const LEAVE: Duration = Duration::from_millis(200);
const LEAVE_MARKS: Duration = Duration::from_millis(950);

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HaloPhase {
    /// The work started: draw the lines (the page waits 250 ms, like the orb).
    Work,
    /// The result was pasted (lot 9): mark the changed words (260 ms in), held until `leave`.
    Marks,
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
    show(app, lines, HaloPhase::Work);
}

/// Marks the changed words of a paste (lot 9) over `lines` (physical), until `leave` (900 ms
/// fade) or `hide`.
pub fn marks(app: &AppHandle, lines: &[Rect]) {
    show(app, lines, HaloPhase::Marks);
}

fn show(app: &AppHandle, lines: &[Rect], phase: HaloPhase) {
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
        LEAVING.store(false, Ordering::Release);
        MARKS.store(phase == HaloPhase::Marks, Ordering::Release);
        let _ = handle.emit_to("halo", "halo", HaloEvent { generation, phase, lines: frame.lines, width: frame.width, height: frame.height });
    });
}

/// The response arrived (a result or an error), or Undo ended (the marks): the page fades,
/// then the window hides.
pub fn leave(app: &AppHandle) {
    if !visible() || LEAVING.swap(true, Ordering::AcqRel) { return; }
    let generation = GENERATION.load(Ordering::Acquire);
    FADING.store(generation, Ordering::Release);
    let delay = if MARKS.load(Ordering::Acquire) { LEAVE_MARKS } else { LEAVE };
    let _ = app.emit_to("halo", "halo", HaloEvent::empty(generation, HaloPhase::Leave));
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(delay);
        hide_window(&handle, generation);
    });
}

/// The marks of lot 9 are shown (not fading, not hidden).
pub fn marking() -> bool {
    visible() && MARKS.load(Ordering::Acquire) && !LEAVING.load(Ordering::Acquire)
}

/// The overlay is dismissed: the halo hides at once, unless it is already fading out (`leave`:
/// the marks' 900 ms at the end of Undo's countdown, which the pill's own leaving follows in the
/// same turn). That fade ends as promised, then its window hides by itself (review of lot 9,
/// finding 4).
pub fn dismiss(app: &AppHandle) {
    if !fading(&GENERATION, &FADING) { hide(app); }
}

/// Whether the current generation is fading out: `leave` started it and nothing overtook it.
fn fading(generation: &AtomicU64, faded: &AtomicU64) -> bool {
    let current = generation.load(Ordering::Acquire);
    current != 0 && faded.load(Ordering::Acquire) == current
}

/// Hides at once: a new capture, a cancelled request, a selection that moved, scrolled or
/// changed, an Undo. Never waits for the page.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dismissal_lets_a_halo_that_already_fades_out_end_its_fade() {
        let (generation, faded) = (AtomicU64::new(0), AtomicU64::new(0));
        assert!(!fading(&generation, &faded), "nothing shown yet: a dismissal hides");
        // The marks of a paste are shown (generation 3): a dismissal hides them at once.
        generation.store(3, Ordering::Release);
        assert!(!fading(&generation, &faded));
        // Undo's countdown ended: `leave` fades them out (900 ms), then hides the window. The
        // pill's dismissal that follows in the same turn leaves that fade alone.
        faded.store(3, Ordering::Release);
        assert!(fading(&generation, &faded));
        // A newer generation (the next capture's sweep, a hide) is not fading: hidden at once.
        generation.store(4, Ordering::Release);
        assert!(!fading(&generation, &faded));
    }
}
