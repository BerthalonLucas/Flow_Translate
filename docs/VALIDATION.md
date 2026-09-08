# Validation evidence

## Executed 2026-09-08

- Private GitHub repository created and initial specification/design commit pushed.
- Model revisions and their Apache-2.0 license files retrieved from the official pinned Hugging Face artifacts. No model weights downloaded.
- vLLM image digest resolved from Docker Hub registry. `docker compose ... config --quiet` succeeds without a daemon.
- Python evaluation tests: four passing (balanced 100-case corpus, endpoint policy, prompt/percentile, Unicode streaming and truncation rejection).
- Inference preflight: **not ready**. Docker Desktop Linux engine is stopped; free VRAM approximately 0.7 GiB on RTX5070Ti and 2.3 GiB on RTX5060Ti. Existing llama-server.exe PID5040 is active. It has not been interrupted.
- Two-case real benchmark attempt exits before benchmarking because the endpoint is unavailable. No model quality/latency result exists yet.

## Pending actual runtime evidence

- Native app build/install, focus, clipboard preservation, selection geometry and round translucent window rendering.
- Edge and Chrome selection + editable fields; Word paragraphs; Outlook classic/new; Teams web/desktop. Explicitly record version and capture/replacement support per app, never infer universal support from UI Automation availability.
- Multiple monitors/negative origins and mixed100/125/150/200% DPI.
- Real model loading, FP8 behavior, concurrent1/4/10 requests and resource usage.
- Human blind review of the100 synthetic translations; no synthetic or guessed quality score is acceptable.

This file is updated as checks actually execute. Mocked responses validate interaction/protocol behavior only.
