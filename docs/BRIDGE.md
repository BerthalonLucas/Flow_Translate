# React ↔ Rust bridge, version 2 (FlowTranslate 0.3.0)

## Actions and shortcut migration (0.3.0)

The current `Settings` replaces the legacy `shortcut` field with `actions: ActionDefinition[]`, `shortcutBindings: ShortcutBinding[]`, and `defaultActionId: string`. `ActionDefinition` is `{id, name, promptTemplate}`; `ShortcutBinding` is `{id, shortcut, actionId, outputMode: 'display'|'replace', enabled}`. `src/types.ts` is authoritative for the current contract.

Each native capture includes `execution: {actionId, actionName, outputMode, mode, targetLanguage}`. Rust snapshots the corresponding action, prompt and profiles at capture time; the frontend sends `actionId` in `TranslationRequest`, never a prompt. Initial mode, language and action must match the capture. A comparison/retry may change the profile, but cannot perform another automatic replacement.

`result-delivery` emits `{requestId, status: 'applied'|'fallback', message}`. Stale IDs and closed overlays ignore it. Rust waits for both a complete response and the target resolver (bounded to two seconds after inference); it claims delivery once, revalidates the native target and writes under the session lock. Cancelling even a completed request revokes a pending delivery. Failure leaves the result in the bubble. `capture-target` cannot reactivate replacement after a successful automatic write.

Settings persist through a serialized save queue in React and a mutex in Rust. Registration and persistence errors roll back newly registered shortcuts. Existing API keys remain DPAPI-encrypted. Legacy settings retain their shortcut and profiles; newly reserved legacy shortcuts are disabled, not discarded. Prompts accept exactly one `{{text}}`, optional `{{targetLanguage}}`, no unknown variables, and at most 8,000 Unicode characters. Captured text is substituted last so its literal variables stay untouched.

The settings window is now user-resizable with a dedicated scroll viewport. `resize_settings` was removed; corner dragging calls Tauri `startResizeDragging('SouthEast')`, permitted only for the settings window. Native minimum dimensions are 460 × 420 logical pixels.

Rust structs serialize camelCase. Rust command names are snake_case; invoke arguments use camelCase. Strings returned as errors must be user-readable French and contain no payload or credentials.

## Types

```ts
type Mode = 'fast' | 'quality';
type Language = 'fr' | 'en';
type Rect = { x: number; y: number; width: number; height: number }; // physical screen pixels, final visible character (or final visible line if character unavailable), logical text order
type Replay = { requestId: string; translatedText: string; mode: Mode; targetLanguage: Language }; // a result shown again from the tray: complete at once, no translation
type Screen = { width: number; height: number; scale: number }; // logical work area of the screen the glass rests on, and its DPI scale (2026-09-14)
type Capture = { id: string; text: string; source: 'selection'|'clipboard'; origin?: 'uia'|'copy'|'fresh'|'replay'|'demo'; canReplace: boolean; anchor: Rect|null; replay?: Replay; screen?: Screen; execution?: ExecutionInfo };
// origin: how Rust obtained the text; shown nowhere, exposed as data-origin on .glass-overlay for the real capture matrix.
type CaptureTarget = { captureId: string; canReplace: boolean }; // second capture step
type CaptureNotice = { message: string };
type Profile = { endpoint: string; model: string; apiKey: string }; // key decrypted only to settings; never browser mock persistence
type TextSize = 'normal'|'large'|'xlarge'; // Réglages « Taille du texte »: short glass 16/24 · 18/27 · 20/30, reader 22/33 · 24/36 · 26/39 (font/line, px)
type AutoClose = 'fast'|'normal'|'slow'|'never'; // Réglages « Fermeture automatique »: reading budget × 0.7 · × 1 · × 1.5 · none
type Settings = { targetLanguage: Language; mode: Mode; actions: ActionDefinition[]; shortcutBindings: ShortcutBinding[]; defaultActionId: string; historyEnabled: boolean; autostart: boolean; connectionExpanded: boolean; textSize: TextSize; autoClose: AutoClose; profiles: Record<Mode,Profile> }; // connectionExpanded: settings UI fold state, persisted like any other field; textSize/autoClose default to 'normal' when absent
type StreamEvent = { requestId: string; kind: 'delta'|'done'|'error'; text?: string; message?: string };
type HistoryEntry = { id: string; sourceText: string; translatedText: string; targetLanguage: Language; mode: Mode; createdAt: string };
type ConnectionStatus = { connected: boolean; message: string };
type Presentation = 'anchored'|'bottom'; // 2026-09-14: the short glass beside its selection, or the band on the bottom of the cursor's screen
type SurfaceRegion = { x:number; y:number; width:number; height:number; radius:number };
```

## Commands

- `get_settings() -> Settings`
- `frontend_ready() -> Capture|null`: overlay-only handshake, called after event listeners register. Marks overlay ready and returns pending capture, if any. Frontend deduplicates capture IDs. Never recapture clipboard as a startup fallback.
- `save_settings({settings}) -> void` (validate URL/model/shortcut before saving; DPAPI-protect credentials)
- `capture_text() -> Capture` (also usable from preview/test controls). Since 2026-09-14 the capture has two steps: the UIA selection (text, anchor) opens the window at once with `canReplace: false`; the document offsets and the Win32 control are read afterwards and published by `capture-target`. Without a UIA selection Rust copies for the user (synthetic Ctrl+Insert after the shortcut chord is released, clipboard sequence watched ≤ 350 ms, previous text restored without feeding Win+V unless something else wrote in between), else accepts a copy the user made himself less than 3 s before (`host::track_clipboard`), else fails with « Rien à traduire dans la fenêtre active. » shown as a notice, never as a MessageBox.
- `translate({request:{id,captureId,text,targetLanguage,mode,actionId}}) -> void`: starts background streaming and returns promptly. Emits `translation` StreamEvent. Register listeners before invoking. At most one active request; starting another cancels the prior one. Validate capture/text identity. Desktop demo may be explicitly started through CLI `--demo`, never silently substitute a mock for failed inference.
- `cancel_translation({requestId}) -> void`
- `copy_result({requestId}) -> void`: Rust copies only a completed known translation, never arbitrary frontend-supplied replacement text.
- `replace_result({requestId}) -> void`: revalidate stored source target and selection; otherwise refuse safely.
- `dismiss_overlay() -> void`: cancel immediately and emit `overlay-dismiss-requested` with `{captureId}`. Native fallback hides after 300ms.
- `complete_overlay_dismiss({captureId}) -> void`: acknowledge the closing animation; stale acknowledgements do nothing.
- `open_settings() -> void`
- `focus_overlay() -> void`: kept for the (now unused) capsule window. Brings the already visible overlay HWND to the foreground (`SetForegroundWindow`) and repairs the frameless style. Overlay and capsule visibility never goes through Tao's `show()`/`hide()`: Tao 0.35 rebuilds the styles with `WS_CAPTION` on its deferred visibility diff, which DWM paints as a title.
- `start_drag({clientX,clientY}) -> void`: only overlay/capsule; starts native movement after a primary pointer press on non-interactive content. Coordinates are logical client pixels captured on pointerdown; Rust validates them and compensates pointer travel before IPC delivery, then uses native dragging while the button remains pressed. Retain the manual location across streaming/menu resizes until the next capture. Buttons and scrollbars keep their own interactions.
- `resize_overlay({width,height,captureId?,presentation?,regions?,frame?}) -> void`: logical pixels. Since 2026-09-14 the ceiling is the work area of the screen the window rests on (physical against logical, no more 640×800): a larger window is refused with « Dimensions invalides. ». The bounds include the shadow halo (32 px each side, 20 px above, 44 px below anchored, 16 px below the bottom band) and are **reserved** once per capture (`src/layout.ts`): anchored, 444 × max(measured glass, 334) so the wait pill, the short glass and the menu under its pill only change the regions; bottom, `bottomReserve(screen, preset)` (band width + 64, by top halo + 236 px menu reserve above the pill + pill band + tallest band + 16) with the root projected on the window's bottom edge. `frame` is the glass footprint Rust anchors and clamps into the work area: while waiting, the 380 × one-line footprint of the glass to come, so the pill alone already sits where the glass opens; afterwards region zero. Regions are unchanged (one to six tight rounded surfaces, hit-test only: the window carries no Win32 region, Chromium paints the silhouette with per-pixel alpha and `host::start_hit_tester` polls the cursor every 8 ms to toggle `WS_EX_TRANSPARENT | WS_EX_LAYERED`). Rust applies the rectangle (`host::place`) only when it changed and the surfaces (`host::set_regions`) whenever they changed: a regions-only update costs no `SetWindowPos`. A work area shorter than the reserve truncates the bottom window from the top and Rust shifts the regions accordingly; anchored, only the glass is clamped, the transparent reserve may leave the work area. Stale capture IDs do nothing.
- `presentation: 'anchored' | 'bottom'` (2026-09-14, replaces contextual/reader/docked): the form is decided once, on the settled result, and never switches afterwards (no « Agrandir », no tab, no fold). `anchored`: the short glass (≤ 8 lines at 380 px) opens from its wait pill beside the selection, keeps its chosen side and its drag position. `bottom`: the reader band (half the work area wide, at most 45 % of its height, whole lines, scrollable beyond) rests bottom-centre of the **cursor's** screen (`host::monitor_at(None)` at the switch, `manual` reset), bottom edge anchored, and follows the cursor across screens (see `work-area`). Clipboard and unanchored captures open bottom.
- `overlay_dimming({dimming}) -> void`: the reading budget is spent and the frontend starts the two-step exit (55 % in 600 ms, held 1.4 s, 300 ms fade) → Rust closes the Escape scope so Escape belongs to the user again; `dimming: false` (an approach, a wheel or a key restored the glass for 5 s) re-arms it while the window is visible. Then `dismiss_overlay` / `complete_overlay_dismiss` as before. Budget (`src/layout.ts`, `readingBudget`): orientation (1 s anchored, 1.5 s band) + 350 ms per word, between 5 s and 30 s (short) or 90 s (band), scaled by `autoClose`; a pointer visit of at least one second followed by a departure shortens what remains to 4 s, never below 2.5 s; a click, wheel or key restores the whole budget; the pill's pin (band only) suspends it.
- `drag_settings() -> void`: settings window only; starts the native move from the home-made title bar.
- `quit_app() -> void`: exits the application (settings footer).
- `check_connection({mode}) -> ConnectionStatus`
- `get_history() -> HistoryEntry[]`
- `delete_history({id: string|null}) -> void`: null deletes all.

## Events and windows

- `capture-target` carries `{captureId, canReplace}`: the native target of a selection capture, read behind the shown window; a stale capture id is ignored; « Remplacer » is offered only after it arrives true.
- `capture-notice` carries `{message}`: nothing to translate, protected field, oversized selection, source window changed. Without an open glass Rust first places the overlay window as a pill alone (420×64 logical, bottom centre of the cursor's screen, no surface: the mouse passes through) and hides it after 4 s; with an open glass the frontend shows the message as feedback. Replaces the MessageBox (2026-09-14).
- A `capture` with `replay` (tray « Revoir la dernière traduction », kept 10 min after the glass closed) is shown complete by the frontend without invoking `translate`; `copy_result` accepts its request id.
- `work-area` carries `Screen` (logical work area and scale) to the overlay when the cursor moved to another screen while a bottom form is visible: the hit tester reports `MonitorFromPoint(cursor)` on change, `screen_changed` moves the window to the new screen (`placement::docked` on its work area) and the frontend recomputes the band width and republishes its geometry. An anchored glass belongs to its selection and never follows. `capture.screen` carries the same values for the first computation. No cursor position is emitted.
- `capture` carries Capture to overlay, after it is ready; every capture starts translation at once in React (the clipboard confirmation step was removed on 2026-09-10). The global shortcut always captures the current selection, clipboard fallback included; it no longer focuses an existing glass.
- `translation` carries StreamEvent. React ignores stale request IDs. Rust emits done only on normal, non-truncated completion.
- `settings-changed` carries Settings after successful persistence.
- `target-invalidated` carries `{captureId:string,anchorLost:boolean,message:string}`: ignore stale capture IDs; disable replacement and native window moves to bottom only when anchorLost.
- `overlay-dismiss-requested` carries `{captureId:string}`. Frontend completes its exit animation then acknowledges it; a new capture invalidates the old request and timeout.
- `glass-near` carries `{near:boolean}` to the overlay, emitted by the hit tester on change only: whether the real cursor rests within 32 logical px of one of the published regions (the silhouette and its shadow, never the whole reserved window). The frontend holds the glass open while `near` is true and starts its 500 ms fold once it turns false; a click grants two seconds regardless. No cursor position is ever logged or emitted.
- Window labels: `overlay` loads `/?window=overlay`, `capsule` loads `/?window=capsule`, `settings` loads `/?window=settings`.
- Only overlay subscribes to capture/translation and starts requests. Settings/capsule may subscribe to settings-changed, never trigger translation from global capture events.
- The capsule window is no longer shown (2026-09-10) and the docked tab that replaced it was removed on 2026-09-14 (the glass leaves by itself, it never folds). The capsule label, page and commands remain until the window is removed from the configuration.
- Frontend publishes no IPC command capable of executing a shell, opening arbitrary files, or injecting arbitrary keystrokes.
- Showing/resizing never activates the overlay. Repeated shortcut/click activates it deliberately. Escape is captured by a scoped native shortcut/hook only while overlay is open if the source retains focus; no unrelated keys are intercepted or logged.
- Glass calibration since 2026-09-14: one graphite `rgba(24,26,31,.96)` for glass, pill and menu, a 1 px 20 % edge, no sheen; copy `#e8eaef`, letter-spacing 0, `text-wrap: pretty`, sizes from the `textSize` preset (`--copy-size`/`--copy-line`). The packaged window paints **no native material**: `DWMWA_SYSTEMBACKDROP_TYPE` (Tauri `Effect::Acrylic`) is drawn behind the entire window bounds regardless of the window region (the grey frame Lucas reported) and any material shows through DOM fades. `FLOWTRANSLATE_GLASS=blur|acrylic|dwm` re-enables a material for experiments (`host::apply_glass`). The browser preview keeps its own `backdrop-filter`. Text stays fully opaque. Shadows live in the halo (`--glass-shadow: 0 12px 32px rgba(0,0,0,.34)`, glass.css sizes the halo to it); the halo never blocks a click since the hit-test reads the tight regions.
- Rust preserves the chosen above/below side during a stream; the deltas are buffered in `useTranslation` (2026-09-10) and, since 2026-09-14, the wait is a pill alone (60×28, shadcn's spinner: lucide `LoaderCircle` 18 px turning once a second, a sweep after 1.5 s) at the upper-right of the glass to come; the settled text is measured off-screen at 380 px (`measureLines`) and the form is decided once: ≤ 8 lines → short glass unfolded from the pill (`clip-path`), more → reader band. Since 0.2.1 (UI-025) the placement itself is decided at the capture on the source text (`decidePlacement`: anchored and ≤ 8 lines → beside the selection, else bottom), so a long selection waits at the bottom from the start and the band is born there; only a short source translated long still moves to the bottom invisibly before the band rises 8 px in 220 ms. When the switch to `bottom` lands on another screen than the selection's, Rust emits `work-area` at once. `start_drag` is only invoked after 4 px of pointer travel; Rust still compensates the travel since the press. When geometry is genuinely lost, re-anchor to bottom explicitly.

## Browser preview

`npm run dev` outside Tauri presents a clearly marked demo desktop with selectable examples, simulated selection/clipboard flow, settings and error scenarios. Same React components and reducer as production. `?window=overlay&demo=1` supports standalone screenshot tests. Desktop app must not show browser preview chrome.
