# Validation evidence

## Executed 2026-09-08

- Private GitHub repository created and initial specification/design commit pushed.
- Model revisions and their Apache-2.0 license files retrieved from the official pinned Hugging Face artifacts. No model weights downloaded.
- vLLM image digest resolved from Docker Hub registry. `docker compose ... config --quiet` succeeds without a daemon.
- Python evaluation tests: four passing (balanced 100-case corpus, endpoint policy, prompt/percentile, Unicode streaming and truncation rejection).
- Inference preflight: **not ready**. Docker Desktop Linux engine is stopped; free VRAM approximately 0.7 GiB on RTX5070Ti and 2.3 GiB on RTX5060Ti. Existing llama-server.exe PID5040 is active. It has not been interrupted.
- Two-case real benchmark attempt exits before benchmarking because the endpoint is unavailable. No model quality/latency result exists yet.
- React production build succeeds. Six reducer tests and twelve Playwright tests pass: confirmation text, partial/error copy guards, comparison, settings/history controls, reduced motion, capsule viewport and 420 px explicit enlargement.
- CSS/browser device scale checks at 100/125/150/200% pass. These are **not** Windows mixed-DPI evidence.
- Windows Rust host compiles; thirteen Rust tests pass (SSE fragmentation/CRLF/truncation, endpoint policy, request cancellation, placement, DPAPI retention and native text patching).
- Real Tauri debug executable launched. Synthetic selection streaming, compact bubble, menu and actual Notepad UIA capture/anchor observed. Fixed startup race by initializing state before WebViews. Fixed native enlargement shrink via `flex: none`.
- A real Notepad insertion test exposed corruption with queued Unicode keystrokes. That implementation was removed completely. Replacement now uses bounded native Edit/RichEdit messages and verifies the resulting document; a new interactive Notepad pass is still pending.
- Very short synthetic Escape presses exposed polling gaps. A scoped keyboard hook replaced sole reliance on polling; interactive recheck is pending.
- NSIS build completed successfully. The final package must be rebuilt after the last native corrections before delivery.
- Desktop automation became unavailable during the final interactive pass: `GetCursorPos failed: Accès refusé (0x80070005)`. No further app input was attempted after recovery failed; user was asked to make the desktop available.
- Final inference preflight still blocked: Docker engine unavailable, approximately 591 MiB free on GPU0 and 2253 MiB on GPU1. Existing workloads remain untouched.

## Pending actual runtime evidence

- Final installer installation and interactive recheck of focus, clipboard preservation, replacement, rapid Escape, desktop translucency/acrylic and resize transitions.
- Edge and Chrome selection + editable fields; Word paragraphs; Outlook classic/new; Teams web/desktop. Explicitly record version and capture/replacement support per app, never infer universal support from UI Automation availability.
- Multiple monitors/negative origins and mixed100/125/150/200% DPI.
- Real model loading, FP8 behavior, concurrent1/4/10 requests and resource usage.
- Human blind review of the100 synthetic translations; no synthetic or guessed quality score is acceptable.

This file is updated as checks actually execute. Mocked responses validate interaction/protocol behavior only.
