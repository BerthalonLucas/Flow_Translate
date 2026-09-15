# React ↔ Rust bridge, version 1

Rust structs serialize camelCase. Rust command names are snake_case; invoke arguments use camelCase. Strings returned as errors must be user-readable French and contain no payload or credentials.

## Types

```ts
type Mode = 'fast' | 'quality';
type Language = 'fr' | 'en';
type Rect = { x: number; y: number; width: number; height: number }; // physical screen pixels, final visible character (or final visible line if character unavailable), logical text order
type Capture = { id: string; text: string; source: 'selection'|'clipboard'; canReplace: boolean; anchor: Rect|null };
type Profile = { endpoint: string; model: string; apiKey: string }; // key decrypted only to settings; never browser mock persistence
type Settings = { targetLanguage: Language; mode: Mode; shortcut: string; historyEnabled: boolean; autostart: boolean; connectionExpanded: boolean; profiles: Record<Mode,Profile> }; // connectionExpanded: settings UI fold state, persisted like any other field
type StreamEvent = { requestId: string; kind: 'delta'|'done'|'error'; text?: string; message?: string };
type HistoryEntry = { id: string; sourceText: string; translatedText: string; targetLanguage: Language; mode: Mode; createdAt: string };
type ConnectionStatus = { connected: boolean; message: string };
type Presentation = 'contextual'|'reader';
type SurfaceRegion = { x:number; y:number; width:number; height:number; radius:number };
```

## Commands

- `get_settings() -> Settings`
- `frontend_ready() -> Capture|null`: overlay-only handshake, called after event listeners register. Marks overlay ready and returns pending capture, if any. Frontend deduplicates capture IDs. Never recapture clipboard as a startup fallback.
- `save_settings({settings}) -> void` (validate URL/model/shortcut before saving; DPAPI-protect credentials)
- `capture_text() -> Capture` (also usable from preview/test controls)
- `translate({request:{id,captureId,text,targetLanguage,mode}}) -> void`: starts background streaming and returns promptly. Emits `translation` StreamEvent. Register listeners before invoking. At most one active request; starting another cancels the prior one. Validate capture/text identity. Desktop demo may be explicitly started through CLI `--demo`, never silently substitute a mock for failed inference.
- `cancel_translation({requestId}) -> void`
- `copy_result({requestId}) -> void`: Rust copies only a completed known translation, never arbitrary frontend-supplied replacement text.
- `replace_result({requestId}) -> void`: revalidate stored source target and selection; otherwise refuse safely.
- `dismiss_overlay() -> void`: cancel immediately and emit `overlay-dismiss-requested` with `{captureId}`. Native fallback hides after 300ms.
- `complete_overlay_dismiss({captureId}) -> void`: acknowledge the closing animation; stale acknowledgements do nothing.
- `open_settings() -> void`
- `focus_overlay() -> void`: kept for the (now unused) capsule window. Brings the already visible overlay HWND to the foreground (`SetForegroundWindow`) and repairs the frameless style. Overlay and capsule visibility never goes through Tao's `show()`/`hide()`: Tao 0.35 rebuilds the styles with `WS_CAPTION` on its deferred visibility diff, which DWM paints as a title.
- `start_drag({clientX,clientY}) -> void`: only overlay/capsule; starts native movement after a primary pointer press on non-interactive content. Coordinates are logical client pixels captured on pointerdown; Rust validates them and compensates pointer travel before IPC delivery, then uses native dragging while the button remains pressed. Retain the manual location across streaming/menu resizes until the next capture. Buttons and scrollbars keep their own interactions.
- `resize_overlay({width,height,captureId?,presentation?,regions?}) -> void`: logical pixels. Bounds are at most 640×800 and include the shadow halo (2026-09-10: root padding of 32 px each side, 20 px above, 44 px below; 16 px below when docked). Since 2026-09-13 the window is **reserved** (`src/layout.ts`): docked, it is always 484×758 (top halo, 236 px menu reserve above the pill, pill band, enlarged glass, tab, bottom halo) with the root projected centred on its bottom edge; anchored, it is never lower than 334 px (the menu reserve under the pill), so the ring, a compact result, a fold, an unfold or a menu only change the regions. Rust applies the rectangle (`host::place`) only when it changed and the surfaces (`host::set_regions`) whenever they changed: a regions-only update costs no `SetWindowPos`. A work area shorter than the reserve truncates the docked window from the top and Rust shifts the regions accordingly; anchored, only the glass is clamped into the work area, the transparent reserve may leave it. One to six regions describe the visible rounded surfaces (glass, pill, menu, feedback, tab) tightly, halo excluded. They feed the native hit-test only: the window carries **no Win32 region** any more (a 1-bit mask DWM clipped without anti-aliasing, dropping every shadow), Chromium paints the silhouette with per-pixel alpha, and `host::start_hit_tester` polls the real cursor every 8 ms to toggle `WS_EX_TRANSPARENT | WS_EX_LAYERED` on the HWND (nothing toggles while the primary button is down). Region zero is the main glass and remains screen-stable when accessories change the root bounds. Stale capture IDs do nothing. Design « 1a » (2026-09-09): the root is the glass plus a 14 px transparent band above it for the action pill (300×≤234 compact, 420×≤454 enlarged); the menu overlays the glass and the height grows to contain it. `presentation: 'reader'` now means the enlarged glass grown from the anchored top-left corner; only unanchored (clipboard) captures still use the bottom placement above the capsule.
- `presentation: 'docked'` (2026-09-10): the window rests bottom-centre on the work area (its 16 px bottom halo keeps the tab off the taskbar), and Rust anchors its **bottom edge**; the frontend keeps the root fixed to the window bottom so the tab never moves while the glass above it mounts, grows or leaves. The menu opens above the pill when docked and the window grows upward to hold it (the root reports the negative overhang in its height). Clipboard and unanchored captures open docked; an anchored glass docks once the pointer leaves it (500 ms) or after 10 s without any visit once the translation settled. Streaming, an open menu, a drag or a keyboard focus (`:focus-visible`) hold the glass; leaving with the pointer releases any focus left inside so the glass folds anyway.
- `resize_settings({height}) -> void`: settings window only; logical height of the React content, capped to the work area. The window has no system frame.
- `drag_settings() -> void`: settings window only; starts the native move from the home-made title bar.
- `quit_app() -> void`: exits the application (settings footer).
- `check_connection({mode}) -> ConnectionStatus`
- `get_history() -> HistoryEntry[]`
- `delete_history({id: string|null}) -> void`: null deletes all.

## Events and windows

- `capture` carries Capture to overlay, after it is ready; every capture starts translation at once in React (the clipboard confirmation step was removed on 2026-09-10). The global shortcut always captures the current selection, clipboard fallback included; it no longer focuses an existing glass.
- `translation` carries StreamEvent. React ignores stale request IDs. Rust emits done only on normal, non-truncated completion.
- `settings-changed` carries Settings after successful persistence.
- `target-invalidated` carries `{captureId:string,anchorLost:boolean,message:string}`: ignore stale capture IDs; disable replacement and native window moves to bottom only when anchorLost.
- `overlay-dismiss-requested` carries `{captureId:string}`. Frontend completes its exit animation then acknowledges it; a new capture invalidates the old request and timeout.
- `glass-near` carries `{near:boolean}` to the overlay, emitted by the hit tester on change only: whether the real cursor rests within 32 logical px of one of the published regions (the silhouette and its shadow, never the whole reserved window). The frontend holds the glass open while `near` is true and starts its 500 ms fold once it turns false; a click grants two seconds regardless. No cursor position is ever logged or emitted.
- Window labels: `overlay` loads `/?window=overlay`, `capsule` loads `/?window=capsule`, `settings` loads `/?window=settings`.
- Only overlay subscribes to capture/translation and starts requests. Settings/capsule may subscribe to settings-changed, never trigger translation from global capture events.
- The capsule window is no longer shown (2026-09-10): the docked tab (44×20, inside the overlay window) replaced it. Its label, page and commands remain until the window is removed from the configuration.
- Frontend publishes no IPC command capable of executing a shell, opening arbitrary files, or injecting arbitrary keystrokes.
- Showing/resizing never activates the overlay. Repeated shortcut/click activates it deliberately. Escape is captured by a scoped native shortcut/hook only while overlay is open if the source retains focus; no unrelated keys are intercepted or logged.
- Glass calibration since 2026-09-10: `rgba(22,24,29,.92)` plus a radial sheen and a 1 px 12 % edge on the glass; the pill, menu and tab are opaque (`rgba(40,43,50,.96/.97)`). The packaged window paints **no native material**: `DWMWA_SYSTEMBACKDROP_TYPE` (Tauri `Effect::Acrylic`) is drawn behind the entire window bounds regardless of the window region (the grey frame Lucas reported) and any material shows through DOM fades. `FLOWTRANSLATE_GLASS=blur|acrylic|dwm` re-enables a material for experiments (`host::apply_glass`). The browser preview keeps its own `backdrop-filter`. Text stays fully opaque. Shadows live in the halo (`--glass-shadow: 0 12px 32px rgba(0,0,0,.34)`, glass.css sizes the halo to it); the halo never blocks a click since the hit-test reads the tight regions.
- Rust preserves the chosen above/below side during a stream; the glass height is content-driven (16 px / 21.6 px lines); since 2026-09-10 the deltas are buffered in `useTranslation`, the glass shows a ring and resizes once when the whole result lands (reveal in `clip-path` + opacity, paint only). `start_drag` is only invoked after 4 px of pointer travel; Rust still compensates the travel since the press. When geometry is genuinely lost, re-anchor to bottom explicitly.

## Browser preview

`npm run dev` outside Tauri presents a clearly marked demo desktop with selectable examples, simulated selection/clipboard flow, settings and error scenarios. Same React components and reducer as production. `?window=overlay&demo=1` supports standalone screenshot tests. Desktop app must not show browser preview chrome.
