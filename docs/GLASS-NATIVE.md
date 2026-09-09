# Native glass surfaces

The overlay window is clipped with a Win32 region made from the union of up to four rounded rectangles supplied in logical client pixels. The main glass is region zero. Transparent gaps outside the union are absent from the native window region, so hit testing passes through them.

Contextual placement anchors region zero near the selection while preserving its chosen side. Reader placement centers region zero near the bottom of the monitor work area. Changing menu or pill bounds adjusts the host origin so the main text surface stays fixed. Manual dragging stores the main glass screen origin and survives later layout updates until the next capture.

`resize_overlay` validates finite positive bounds, a maximum 640×480 root and regions fully contained in that root. Native layout calls are skipped when geometry and regions are unchanged. Application of queued geometry and dismissal is capture-guarded on the Tauri main thread.

Dismissal cancels work and actions immediately, emits `overlay-dismiss-requested`, and retains the native window for the frontend exit animation. `complete_overlay_dismiss` hides only the matching pending capture. A 300ms timeout provides the same guarded fallback. `--demo-long` supplies long synthetic content for reader-window checks without inference.
