# FlowTranslate

Windows 11 app: Tauri 2, React, TypeScript and Rust. vLLM is a separate server.

- Latest user decisions override the historical glass specifications below: read docs/UI-DECISIONS.md and track individual fixes in docs/UI-ISSUES.md. Main work without subagents; the user separately permits Claude Code/Fable 5.1 for bounded frontend variants. No such variant has been launched for the workbench milestone.

- Read docs/SPEC.md and docs/BRIDGE.md before changing interfaces.
- New art direction (« Îlot », 2026-09-24): docs/DA-PLAN.md is the implementation plan and the design lab docs/design/labo-flowtranslate.html (source design-lab/) is the visual and motion reference; its defaults are Lucas's choices. The former reference docs/design/glass-reader/c-overlapping-pill.png and the graphite glass are historical. No large header or footer.
- Preserve clipboard updates and never replace a selection unless its identity and text are revalidated.
- Never log source text, translations, credentials or clipboard contents. History is explicitly opt-in and encrypted with Windows DPAPI.
- Never include model weights, credentials or user data in Git.
- Do not stop existing GPU processes. Inspect free VRAM before inference tests.
- Use branches/worktrees for independent agent work. Each agent owns only its assigned scope.
- Agent routing requested by Lucas: Astra for frontend implementation, design, interactions, animations and review, with reasoning effort **medium or higher**. Sol handles native/inference; Luna handles docs/recette. Terra may handle other suitable work, but not own the frontend.
- Reuse established frontend primitives and animation libraries (motion, Radix, lucide-react); follow the Îlot art direction in docs/DA-PLAN.md. Validate the real Windows window as well as the browser preview before claiming the UI is ready. See docs/UI-ITERATION.md.
- Keep claims of testing tied to actual executed checks. A mocked translation is not an inference benchmark.
