# FlowTranslate V1

## Confirmed scope

Windows 11; French/English professional email and messages; a private pilot of 1–10 people. The Windows client and vLLM server are separate products, initially exercised on Lucas's PC. No voice, OCR, rich Office formatting or whole-document translation.

## Approved design

`design/selection-approved.png` and `design/clipboard-approved.png` supersede earlier large cards. A selection gets a 280 logical-pixel bubble near its last visible character. Graphite at approximately 82% opacity, 26px corners, 15px text, compact padding. Only copy and more actions. No header, oversized button or footer band. Long results keep the width and scroll at 220px height; enlarge is explicit. Clipboard uses a 200×36 capsule at the bottom of the active monitor with a small result above. Idle means hidden except tray icon. Settings use the same materials at a readable normal window size.

## Interaction

Ctrl+Alt+T, configurable: read a selection via UI Automation; else explicitly preview clipboard text before sending it. Selection coordinates determine placement; clamp to monitor working area and flip above when needed. No reliable anchor means bottom capsule. Preserve foreground focus when showing an overlay. Repeated shortcut focuses it. Escape dismisses/cancels. Scroll/window/selection changes invalidate replacement and stale anchoring. Result actions become active only after a complete response. Never paste into an unverified or changed target. Clipboard restoration must not overwrite newer user content.

## Client and server

Tauri 2 + React/TypeScript; Rust owns native capture, windows, network, storage and secrets. React communicates only through the typed bridge. Browser preview provides deterministic mock responses and is clearly identified as a demo. Real desktop mode is the default for the packaged app.

vLLM 0.28.0 stable, pinned image and model revisions. Fast: tencent/Hy-MT2-1.8B BF16. Quality: tencent/Hy-MT2-7B-FP8. Two independent endpoints and no implicit profile fallback. OpenAI /v1/models and /v1/chat/completions with streaming. 8192-token initial context, 6000-character client limit, 4096 output token budget; reject oversized context and incomplete generations explicitly. Official templates and generation parameters must be recorded. These remain candidates pending actual GPU and quality measurements.

Defaults: French target, Quality mode, no autostart, history off. Optional local history: Windows DPAPI, 7 days/100 entries, delete individual/all. No content logging. Remote endpoints require HTTPS except loopback. Credentials remain on the machine.

## Delivery and evidence

First milestone: native Tauri visual prototype and simulated responses. Then real inference integration. Test cancellation, stale streams, clipboard races, focus/selection changes and network failures. Test Edge/Chrome/Word/Outlook/Teams manually; track unrun cases honestly. Design checks at 100/125/150/200% scaling and reduced motion. Evaluate 100 balanced FR/EN excerpts, fidelity/names/numbers/format and latency p50/p95 at 1/4/10 concurrent requests. Do not fabricate model results or human scores. Package Windows installer, separate reproducible server and rollback instructions.

All code/config/docs/test data and selected design references are versioned in private GitHub repo BerthalonLucas/flowtranslate. Never commit confidential examples, model weights or secrets.

