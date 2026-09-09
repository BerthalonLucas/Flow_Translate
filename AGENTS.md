# FlowTranslate

Windows 11 app: Tauri 2, React, TypeScript and Rust. vLLM is a separate server.

- Read docs/SPEC.md and docs/BRIDGE.md before changing interfaces.
- The approved screenshot docs/design/glass-reader/c-overlapping-pill.png is the current visual source of truth (Lucas approved 2026-09-09). Keep short overlays tiny, round and translucent, text-only with an overlapping upper-right action pill; long translations use a bottom-centered reader without a visible scrollbar. No large header or footer.
- Preserve clipboard updates and never replace a selection unless its identity and text are revalidated.
- Never log source text, translations, credentials or clipboard contents. History is explicitly opt-in and encrypted with Windows DPAPI.
- Never include model weights, credentials or user data in Git.
- Do not stop existing GPU processes. Inspect free VRAM before inference tests.
- Use branches/worktrees for independent agent work. Each agent owns only its assigned scope.
- Agent routing requested by Lucas: Astra for frontend implementation, design, interactions, animations and review, with reasoning effort **medium or higher**. Sol handles native/inference; Luna handles docs/recette. Terra may handle other suitable work, but not own the frontend.
- Reuse established frontend primitives and animation libraries; retain the approved custom visual identity. Validate the real Windows window as well as the browser preview before claiming the UI is ready. See docs/UI-ITERATION.md.
- Keep claims of testing tied to actual executed checks. A mocked translation is not an inference benchmark.
