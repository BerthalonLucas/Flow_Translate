# Native glass surfaces

The overlay window carries no Win32 region: Chromium paints the silhouette with per-pixel alpha and the frontend publishes up to six rounded rectangles in logical client pixels (the main glass is region zero). A hit tester polls the real cursor every 8 ms and toggles `WS_EX_TRANSPARENT | WS_EX_LAYERED` so the transparent gaps let clicks through. Since 2026-09-13 the window is also subclassed (`host::silence_frame`): `WM_NCACTIVATE` reaches `DefWindowProc` with lParam = -1 and the non-client paint requests are dropped, so Windows never paints a title band into the frameless surface when activation changes.

Contextual placement anchors region zero near the selection while preserving its chosen side. Reader placement centers region zero near the bottom of the monitor work area. Changing menu or pill bounds adjusts the host origin so the main text surface stays fixed. Manual dragging stores the main glass screen origin and survives later layout updates until the next capture.

`resize_overlay` validates finite positive bounds, a maximum 640×800 root and regions fully contained in that root. The frontend reserves the window (484×758 docked, at least 334 px anchored) so folds, unfolds and menus only change the regions; Rust then updates the surfaces without any `SetWindowPos`, and skips both when nothing changed. Application of queued geometry and dismissal is capture-guarded on the Tauri main thread.

Dismissal cancels work and actions immediately, emits `overlay-dismiss-requested`, and retains the native window for the frontend exit animation. `complete_overlay_dismiss` hides only the matching pending capture. A 300ms timeout provides the same guarded fallback. `--demo-long` supplies long synthetic content for reader-window checks without inference.

The resize command resolves only after native geometry has been applied successfully. CSS opacity animates the WebView content; the Win32 acrylic backdrop belongs to the native window and may remain visible until the final native hide.
