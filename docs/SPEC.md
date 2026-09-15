# FlowTranslate V1

## Confirmed scope

Windows 11; French/English professional email and messages; a private pilot of 1–10 people. The Windows client and vLLM server are separate products, initially exercised on Lucas's PC. No voice, OCR, rich Office formatting or whole-document translation.

## Approved design

On 2026-09-09 Lucas approved `design/glass-reader/c-overlapping-pill.png`, superseding the earlier selection/clipboard mockups for the translation surface. A short selection gets a 280 logical-pixel smoked-graphite glass bubble near its last visible character, with 26px corners, 15px text and compact padding. The translation surface contains only text; Copy and More live in a small horizontal pill partly overlapping the upper-right edge, without covering the first text line. The 0.1.4/0.1.5 calibration uses a 66% graphite background on the main glass and 68% on accessories, with native acrylic, a faint rim/reflection and understated shadow; text stays fully opaque. No header, oversized button or footer band.

Long translations use a wider reader (approximately 560 logical pixels) at the bottom center of the selection's monitor work area, with the same overlapping action pill. No visible scrollbar. Preserve the complete translation and keyboard/wheel access for content exceeding the reader. Estimate the presentation before streaming; avoid per-token window movement and allow at most one promotion if the translated text exceeds the initial estimate. Clipboard confirmation and the 200×36 capsule remain. Idle means hidden except tray icon. Settings use the same materials at a readable normal window size.

Use Motion/Radix/Lucide for accessible interactions and short paint animations. Honor reduced motion. Native window clipping must follow the actual glass/pill/menu surfaces; transparent margins must not intercept desktop clicks. Closing cancels immediately and permits a short bounded exit animation, with a native fallback if the frontend does not acknowledge. Mockups do not establish native blur or performance.

## Interaction

Ctrl+Alt+T, configurable: read a selection via UI Automation; else explicitly preview clipboard text before sending it. Selection coordinates determine placement; clamp to monitor working area and flip above when needed. No reliable anchor means bottom capsule. Preserve foreground focus when showing an overlay. Repeated shortcut focuses it. Escape dismisses/cancels. Scroll/window/selection changes invalidate replacement and stale anchoring. Result actions become active only after a complete response. Never paste into an unverified or changed target. Clipboard restoration must not overwrite newer user content.

## Client and server

Tauri 2 + React/TypeScript; Rust owns native capture, windows, network, storage and secrets. React communicates only through the typed bridge. Browser preview provides deterministic mock responses and is clearly identified as a demo. Real desktop mode is the default for the packaged app.

vLLM 0.28.0 stable, pinned image and model revisions. Fast: tencent/Hy-MT2-1.8B BF16. Quality: tencent/Hy-MT2-7B-FP8. Two independent endpoints and no implicit profile fallback. OpenAI /v1/models and /v1/chat/completions with streaming. 8192-token initial context, 6000-character client limit, 4096 output token budget; reject oversized context and incomplete generations explicitly. Official templates and generation parameters must be recorded. These remain candidates pending actual GPU and quality measurements.

Defaults: French target, Quality mode, no autostart, history off. Optional local history: Windows DPAPI, 7 days/100 entries, delete individual/all. No content logging. Remote endpoints require HTTPS except loopback. Credentials remain on the machine.

## Delivery and evidence

First milestone: native Tauri visual prototype and simulated responses. Then real inference integration. Test cancellation, stale streams, clipboard races, focus/selection changes and network failures. Test Edge/Chrome/Word/Outlook/Teams manually; track unrun cases honestly. Design checks at 100/125/150/200% scaling and reduced motion. Evaluate 100 balanced FR/EN excerpts, fidelity/names/numbers/format and latency p50/p95 at 1/4/10 concurrent requests. Do not fabricate model results or human scores. Package Windows installer, separate reproducible server and rollback instructions.

All code/config/docs/test data and selected design references are versioned in private GitHub repo BerthalonLucas/flowtranslate. Never commit confidential examples, model weights or secrets.
