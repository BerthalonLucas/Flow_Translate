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
- `focus_overlay() -> void`
- `start_drag({clientX,clientY}) -> void`: only overlay/capsule; starts native movement after a primary pointer press on non-interactive content. Coordinates are logical client pixels captured on pointerdown; Rust validates them and compensates pointer travel before IPC delivery, then uses native dragging while the button remains pressed. Retain the manual location across streaming/menu resizes until the next capture. Buttons and scrollbars keep their own interactions.
- `resize_overlay({width,height,captureId?,presentation?,regions?}) -> void`: logical pixels. Bounds are at most 640×480; one to four regions describe the visible rounded surfaces. Region zero is the main glass and remains screen-stable when accessories change the root bounds. Stale capture IDs do nothing. Design « 1a » (2026-09-09): the root is the glass plus a 14 px transparent band above it for the action pill (300×≤234 compact, 420×≤454 enlarged); the menu overlays the glass and the height grows to contain it. `presentation: 'reader'` now means the enlarged glass grown from the anchored top-left corner; only unanchored (clipboard) captures still use the bottom placement above the capsule.
- `resize_settings({height}) -> void`: settings window only; logical height of the React content, capped to the work area. The window has no system frame.
- `drag_settings() -> void`: settings window only; starts the native move from the home-made title bar.
- `quit_app() -> void`: exits the application (settings footer).
- `check_connection({mode}) -> ConnectionStatus`
- `get_history() -> HistoryEntry[]`
- `delete_history({id: string|null}) -> void`: null deletes all.

## Events and windows

- `capture` carries Capture to overlay, after it is ready; selection starts translation automatically in React, clipboard waits for confirmation.
- `translation` carries StreamEvent. React ignores stale request IDs. Rust emits done only on normal, non-truncated completion.
- `settings-changed` carries Settings after successful persistence.
- `target-invalidated` carries `{captureId:string,anchorLost:boolean,message:string}`: ignore stale capture IDs; disable replacement and native window moves to bottom only when anchorLost.
- `overlay-dismiss-requested` carries `{captureId:string}`. Frontend completes its exit animation then acknowledges it; a new capture invalidates the old request and timeout.
- Window labels: `overlay` loads `/?window=overlay`, `capsule` loads `/?window=capsule`, `settings` loads `/?window=settings`.
- Only overlay subscribes to capture/translation and starts requests. Settings/capsule may subscribe to settings-changed, never trigger translation from global capture events.
- Capsule opens on clipboard/unanchored capture. Capsule invokes focus_overlay, dismiss_overlay and open_settings; it does not duplicate translation handling. A narrow pill with language indicator, clipboard icon, close.
- Frontend publishes no IPC command capable of executing a shell, opening arbitrary files, or injecting arbitrary keystrokes.
- Showing/resizing never activates the overlay. Repeated shortcut/click activates it deliberately. Escape is captured by a scoped native shortcut/hook only while overlay is open if the source retains focus; no unrelated keys are intercepted or logged.
- Glass calibration since the « 1a » handoff: `rgba(22,24,29,.76)` plus a radial sheen and a 1 px 12 % edge on the glass; the pill and menu are opaque (`rgba(40,43,50,.96/.97)`). The native acrylic backdrop replaces CSS `backdrop-filter` in the packaged app (the browser preview keeps its own blur). If acrylic proves unavailable on a machine, raise the glass alpha to .82. Text stays fully opaque. Transparent corners and small native bounds must not create a large invisible click-blocking area.
- Rust preserves the chosen above/below side during a stream; the glass height is content-driven (16 px / 21.6 px lines) so each resize is a whole line, batched through ResizeObserver + rAF. `start_drag` is only invoked after 4 px of pointer travel; Rust still compensates the travel since the press. When geometry is genuinely lost, re-anchor to bottom explicitly.

## Browser preview

`npm run dev` outside Tauri presents a clearly marked demo desktop with selectable examples, simulated selection/clipboard flow, settings and error scenarios. Same React components and reducer as production. `?window=overlay&demo=1` supports standalone screenshot tests. Desktop app must not show browser preview chrome.
