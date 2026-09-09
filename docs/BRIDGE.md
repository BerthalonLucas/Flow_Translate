# React ↔ Rust bridge, version 1

Rust structs serialize camelCase. Rust command names are snake_case; invoke arguments use camelCase. Strings returned as errors must be user-readable French and contain no payload or credentials.

## Types

```ts
type Mode = 'fast' | 'quality';
type Language = 'fr' | 'en';
type Rect = { x: number; y: number; width: number; height: number }; // physical screen pixels, final visible character (or final visible line if character unavailable), logical text order
type Capture = { id: string; text: string; source: 'selection'|'clipboard'; canReplace: boolean; anchor: Rect|null };
type Profile = { endpoint: string; model: string; apiKey: string }; // key decrypted only to settings; never browser mock persistence
type Settings = { targetLanguage: Language; mode: Mode; shortcut: string; historyEnabled: boolean; autostart: boolean; profiles: Record<Mode,Profile> };
type StreamEvent = { requestId: string; kind: 'delta'|'done'|'error'; text?: string; message?: string };
type HistoryEntry = { id: string; sourceText: string; translatedText: string; targetLanguage: Language; mode: Mode; createdAt: string };
type ConnectionStatus = { connected: boolean; message: string };
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
- `dismiss_overlay() -> void`: cancel and hide overlay/capsule; keep settings independent.
- `open_settings() -> void`
- `focus_overlay() -> void`
- `start_drag({clientX,clientY}) -> void`: only overlay/capsule; starts native movement after a primary pointer press on non-interactive content. Coordinates are logical client pixels captured on pointerdown; Rust validates them and compensates pointer travel before IPC delivery, then uses native dragging while the button remains pressed. Retain the manual location across streaming/menu resizes until the next capture. Buttons and scrollbars keep their own interactions.
- `resize_overlay({width,height}) -> void`: logical pixels, Rust clamps and repositions around stored anchor. Content must fit native window bounds (no giant transparent click-blocking surface).
- `check_connection({mode}) -> ConnectionStatus`
- `get_history() -> HistoryEntry[]`
- `delete_history({id: string|null}) -> void`: null deletes all.

## Events and windows

- `capture` carries Capture to overlay, after it is ready; selection starts translation automatically in React, clipboard waits for confirmation.
- `translation` carries StreamEvent. React ignores stale request IDs. Rust emits done only on normal, non-truncated completion.
- `settings-changed` carries Settings after successful persistence.
- `target-invalidated` carries `{captureId:string,anchorLost:boolean,message:string}`: ignore stale capture IDs; disable replacement and native window moves to bottom only when anchorLost.
- Window labels: `overlay` loads `/?window=overlay`, `capsule` loads `/?window=capsule`, `settings` loads `/?window=settings`.
- Only overlay subscribes to capture/translation and starts requests. Settings/capsule may subscribe to settings-changed, never trigger translation from global capture events.
- Capsule opens on clipboard/unanchored capture. Capsule invokes focus_overlay, dismiss_overlay and open_settings; it does not duplicate translation handling. A narrow pill with language indicator, clipboard icon, close.
- Frontend publishes no IPC command capable of executing a shell, opening arbitrary files, or injecting arbitrary keystrokes.
- Showing/resizing never activates the overlay. Repeated shortcut/click activates it deliberately. Escape is captured by a scoped native shortcut/hook only while overlay is open if the source retains focus; no unrelated keys are intercepted or logged.
- Graphite alpha82% applies to the background only, not overall window/text opacity. Transparent corners and small native bounds must not create a large invisible click-blocking area.
- Rust preserves the chosen above/below side during a stream; frontend batches ResizeObserver updates to avoid per-token jitter. When geometry is genuinely lost, re-anchor to bottom explicitly.

## Browser preview

`npm run dev` outside Tauri presents a clearly marked demo desktop with selectable examples, simulated selection/clipboard flow, settings and error scenarios. Same React components and reducer as production. `?window=overlay&demo=1` supports standalone screenshot tests. Desktop app must not show browser preview chrome.
