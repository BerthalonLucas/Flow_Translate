# FlowTranslate

Windows 11 app: Tauri 2, React, TypeScript and Rust. vLLM is a separate server.

- Read docs/SPEC.md and docs/BRIDGE.md before changing interfaces.
- The approved screenshots in docs/design are the visual source of truth. Keep overlays tiny, round and lightly translucent. No large header or footer.
- Preserve clipboard updates and never replace a selection unless its identity and text are revalidated.
- Never log source text, translations, credentials or clipboard contents. History is explicitly opt-in and encrypted with Windows DPAPI.
- Never include model weights, credentials or user data in Git.
- Do not stop existing GPU processes. Inspect free VRAM before inference tests.
- Use branches/worktrees for independent agent work. Each agent owns only its assigned scope.
- Agent routing requested by Lucas: Astra for design/review, Terra for frontend, Sol for native/inference, Luna for docs/recette.
- Keep claims of testing tied to actual executed checks. A mocked translation is not an inference benchmark.

