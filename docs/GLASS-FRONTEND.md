# Glass frontend C

Implementation of the approved `docs/design/glass-reader/c-overlapping-pill.png` reference. This replaces the earlier inline-action bubble. No dependency or package version changed: Motion, Radix and Lucide remain the interaction foundation.

## Surfaces

- Contextual glass: 280px wide, 26px corners, 15/21px text, 16px vertical and 18px horizontal padding. Text only; short results use 55–118px of glass height.
- Reader: 560px wide, 15/22px text, 22px vertical and 24px horizontal padding, 112–280px of glass height. Browser previews adapt to narrow viewports; native placement/clamping belongs to Rust.
- Overlapping pill: 60×28px, radius 14px, 18px inset from the right edge. Its top is 14px above the glass. Copy and More are the only buttons. More always offers Close; clipboard confirmation also has Cancel.
- Independent menu: 192px wide, radius 16px. It opens below contextual glass and above reader glass, separated by 8px. It never compresses or overlays the translated text.
- Feedback: a separate small surface, radius 12px, below contextual glass or above the reader. It disappears after three seconds and yields to an open menu.

Graphite uses 78% background alpha, a 12% white border, a restrained inset reflection, and a constant CSS backdrop blur of 32px. Text stays fully opaque outside transient fades. There is no animated blur, no scaling of text, and no opaque rectangle behind the surfaces. CSS backdrop blur in a browser does not demonstrate blur of other desktop applications.

## Streaming and long text

The source is measured with the system font before translation starts. More than four contextual lines chooses reader mode. Streaming keeps that geometry fixed. Delta events accumulate for 32ms before dispatch; done/error flushes the final batch synchronously. At completion, one contextual-to-reader promotion is allowed if translation expanded beyond the estimate. A reader never automatically demotes. Explicit enlarge/reduce remains available when the complete text fits the requested format.

All text remains in the scrollable reading region. Wheel, touchpad, PageDown/PageUp, Home/End and normal keyboard focus work; scrollbar chrome is hidden. Subtle edge fades indicate undisplayed content. The pill remains outside the scrolling region. Text reading/selection is excluded from native drag initiation; dragging uses the glass margins and the existing `start_drag({clientX,clientY})` bridge. Copy/replacement still require a completed response; replacement is still validated by Rust.

## Motion and closure

Appearance fades in over 180ms. A format or height change fades out for 80ms, commits the measured geometry, waits for the native resize promise, then fades in for 140ms. The measured root never uses transforms or layout/FLIP animations. Menu/comparison/feedback use Motion presence. Reduced motion makes transitions immediate.

`dismiss_overlay()` requests cancellation and emits `overlay-dismiss-requested({captureId})`. The frontend fades the existing session for 120ms, then calls `complete_overlay_dismiss({captureId})`. It retains the menu geometry during that fade. Each capture owns its own mounted session; a new capture cancels old presentation animations and cannot be hidden by an old dismissal completion. Rust supplies the separate 300ms timeout fallback. This is a fade around a geometry change, not interpolated native resizing or native window movement.

## Native geometry contract

`bridge.resize(width,height,{captureId,presentation,regions})` invokes flattened `resize_overlay({width,height,captureId,presentation,regions})`.

The transparent root encloses only the needed surfaces. Regions are logical pixels relative to that root, in this invariant order: glass first, pill second, then menu and feedback if present. Each region includes `x`, `y`, `width`, `height`, `radius`; radius is bounded by half the smaller dimension. There are at most four regions. Current maximal reader plus menu uses 472px of host height, below the 480px contract limit.

Rust must anchor **region zero**, not the enclosing rectangle. The reader menu grows the host upwards while the glass stays still. The same rule applies to feedback. Native clipping/hit testing must use the union of supplied rounded regions; CSS pointer events alone cannot pass an invisible host area through to another Windows application.

The first geometry is published synchronously from `useLayoutEffect`, including while a hidden WebView suspends requestAnimationFrame. Later ResizeObserver work is batched by animation frame; identical dimensions and region offsets are deduplicated. A failed resize clears the cached signature, shows brief feedback, and releases the fade instead of leaving an invisible session. Stale capture IDs must also be rejected by Rust.

## Preview and verification

Run `npm run dev` in the integrated repository (port 5173):

- `/?window=overlay&demo=1`: contextual selection.
- `/?window=overlay&demo=1&scenario=long`: reader chosen from a long source.
- `/?window=overlay&demo=1&scenario=very-long`: several thousand characters with scrolling.
- `/?window=overlay&demo=1&scenario=confirmation`: clipboard confirmation.
- `/?window=overlay&demo=1&scenario=error`: failure and Close.
- `/`: replayable browser playground; its controls do not cover the contextual glass.

The browser background, source email and responses are simulations. Browser tests validate geometry, accessibility and IPC payloads; they do not prove native transparency, hit testing, focus preservation, monitor placement or rendering performance. Those require the integrated Windows application.

Validation executed on 2026-09-09: production build passed; seven reducer tests passed; all thirty Playwright tests passed on isolated port 5176. The IPC fixture verified 120 delta events without any streaming resize, ordered bounded regions, first geometry without requestAnimationFrame, dismissal acknowledgements, capture races, and format fades. Browser screenshots for short glass and the reader menu were reviewed. No native rendering/performance claim is inferred from those checks.
