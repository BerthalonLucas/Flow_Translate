# React ↔ Rust bridge, version 1

Rust structs serialize camelCase. Rust command names are snake_case; invoke arguments use camelCase. Strings returned as errors must be user-readable French and contain no payload or credentials.

## Types

```ts
type Mode = 'fast' | 'quality';
type Language = 'fr' | 'en';
type Rect = { x: number; y: number; width: number; height: number }; // physical screen pixels
type Capture = { id: string; text: string; source: 'selection'|'clipboard'; canReplace: boolean; anchor: Rect|null };
type Profile = { endpoint: string; model: string; apiKey: string }; // key decrypted only to settings; never browser mock persistence
type Settings = { targetLanguage: Language; mode: Mode; shortcut: string; historyEnabled: boolean; autostart: boolean; profiles: Record<Mode,Profile> };
type StreamEvent = { requestId: string; kind: 'delta'|'done'|'error'; text?: string; message?: string };
type HistoryEntry = { id: string; sourceText: string; translatedText: string; targetLanguage: Language; mode: Mode; createdAt: string };
type ConnectionStatus = { connected: boolean; message: string };
```

## Commands

- `get_settings() -> Settings`
- `save_settings({settings}) -> void` (validate URL/model/shortcut before saving; DPAPI-protect credentials)
- `capture_text() -> Capture` (also usable from preview/test controls)
- `translate({request:{id,captureId,text,targetLanguage,mode}}) -> void`: starts background streaming and returns promptly. Emits `translation` StreamEvent. Register listeners before invoking. At most one active request; starting another cancels the prior one. Validate capture/text identity. Desktop demo may be explicitly started through CLI `--demo`, never silently substitute a mock for failed inference.
- `cancel_translation({requestId}) -> void`
- `copy_result({requestId}) -> void`: Rust copies only a completed known translation, never arbitrary frontend-supplied replacement text.
- `replace_result({requestId}) -> void`: revalidate stored source target and selection; otherwise refuse safely.
- `dismiss_overlay() -> void`: cancel and hide overlay/capsule; keep settings independent.
- `open_settings() -> void`
- `focus_overlay() -> void`
- `resize_overlay({width,height}) -> void`: logical pixels, Rust clamps and repositions around stored anchor. Content must fit native window bounds (no giant transparent click-blocking surface).
- `check_connection({mode}) -> ConnectionStatus`
- `get_history() -> HistoryEntry[]`
- `delete_history({id: string|null}) -> void`: null deletes all.

## Events and windows

- `capture` carries Capture to overlay, after it is ready; selection starts translation automatically in React, clipboard waits for confirmation.
- `translation` carries StreamEvent. React ignores stale request IDs. Rust emits done only on normal, non-truncated completion.
- `settings-changed` carries Settings after successful persistence.
- `target-invalidated` carries `{message:string}`: disable replacement and native window moves to bottom when anchor lost.
- Window labels: `overlay` loads `/?window=overlay`, `capsule` loads `/?window=capsule`, `settings` loads `/?window=settings`.
- Capsule opens on clipboard/unanchored capture. Capsule invokes focus_overlay, dismiss_overlay and open_settings; it does not duplicate translation handling. A narrow pill with language indicator, clipboard icon, close.
- Frontend publishes no IPC command capable of executing a shell, opening arbitrary files, or injecting arbitrary keystrokes.

## Browser preview

`npm run dev` outside Tauri presents a clearly marked demo desktop with selectable examples, simulated selection/clipboard flow, settings and error scenarios. Same React components and reducer as production. `?window=overlay&demo=1` supports standalone screenshot tests. Desktop app must not show browser preview chrome.

