# Frontend interaction foundation

The approved microbubble remains the visual source of truth: 280 logical pixels, 26px corners, Segoe UI at 15px, graphite `#1d1f24` at 82% background opacity. Text stays `#f8f8fb`; subdued actions use `#e7eaf0`, feedback `#c9e3ff`, and keyboard focus `#7db6ff`. Short results retain two inline actions and no header/footer. Long text scrolls above accessible actions within the 220px limit. Enlarging is explicit.

## Reused libraries

| Package | Pinned version | License | Actual use |
| --- | --- | --- | --- |
| `motion` | 13.2.0 | MIT | Appearance, menu and comparison presence, copy feedback, settings switch thumb |
| `@radix-ui/react-dropdown-menu` | 2.1.24 | MIT | Keyboard navigation, typeahead, disabled actions, focus return, outside dismissal |
| `@radix-ui/react-switch` | 1.3.7 | MIT | Accessible settings toggles |
| `lucide-react` | 1.43.0 | ISC, with MIT notices for Feather-derived icons | Copy, check, more, clipboard, chevron and close glyphs |

Versions/licenses were checked against installed packages and npm metadata. Full notices for these libraries and their added dependencies are in `public/THIRD-PARTY-INTERACTION-LICENSES.txt`, which Vite copies into the production bundle. No paid assets or Motion+ features are used.

Primary references: [Motion React](https://motion.dev/docs/react), [Radix DropdownMenu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu), [Radix Switch](https://www.radix-ui.com/primitives/docs/components/switch), [Lucide React](https://lucide.dev/guide/react).

## Motion and native geometry

`src/ui.tsx` owns the reusable primitives and motion tokens: 180ms entrance, 140ms control response, 100ms exit, easing `[0.2, 0, 0, 1]`. Reduced motion makes these transitions immediate. The streaming cursor also respects the OS preference.

The bubble and inline menu animate opacity only. They do not scale text, use Motion layout/FLIP, or animate dimensions that Rust measures. Menu/comparison/feedback exits retain their allocated space until the fade finishes; native geometry changes at the resulting layout boundaries. The ResizeObserver is rebound for every capture ID, including consecutive captures while the overlay stays visible.

Radix menu is non-modal, has no body portal, and its Popper wrapper is explicitly laid out inside the measured bubble. Its trigger opens on completed pointer click: opening on pointerdown can move a tiny anchored window before pointerup and immediately dismiss the menu. Radix continues to own keyboard semantics and focus return. No menu auto-opens on capture. `Fermer` remains enabled while translating and after errors; clipboard confirmation has `Annuler`. Browser Escape closes an open menu first, then dismisses the overlay on the next press. The scoped native Escape hook may dismiss the entire overlay directly and must be checked separately.

**Native hide remains immediate.** A true window exit animation needs a future Rust/frontend hide-request and completion handshake, with a bounded fallback. This change does not claim or simulate that lifecycle support. Native show/focus, transparency, frame artifacts, drag movement and monitor placement still require actual Windows verification. The pointerdown sends logical `clientX`/`clientY` to the coordinated native `start_drag` implementation. A rejected drag produces brief feedback; React does not implement its own drag engine.

## Repeatable visual review

Run `npm run dev -- --port 5176 --strictPort` in an isolated worktree. This starts a local preview; stop it after review. URLs:

- `/?window=overlay&demo=1`: short result with simulated streaming.
- `/?window=overlay&demo=1&scenario=long`: long result and scrolling.
- `/?window=overlay&demo=1&scenario=error`: failure with copy disabled and Close available.
- `/?window=overlay&demo=1&scenario=confirmation`: explicit clipboard confirmation.
- `/?window=capsule&demo=1`: capsule; use a 200×36 viewport.
- `/?window=settings&demo=1`: settings switches and advanced connection controls.
- `/`: selectable scenarios that can be replayed without duplicate capture IDs.

The preview labels itself as a browser simulation. It does not contact inference, access the real clipboard, or prove native quality. Screenshot review must include the real app over a Windows application before claiming desktop validation.

For isolated browser tests in PowerShell:

```powershell
$env:FLOWTRANSLATE_TEST_PORT = '5176'
npx playwright test
```

The test runner owns and stops its preview server. `e2e/native-fixture.ts` uses Tauri's official IPC mocks to exercise the native branch of frontend sizing, including two successive captures and late events after dismissal. It still runs in Chromium; it is not a native window test.

## Executed validation

On 2026-09-09: production build passed, 6 reducer tests passed, and all 19 Playwright tests passed on isolated port 5176. Browser screenshots reviewed for short/long results, menu and settings. Device-scale checks cover 100/125/150/200%; these are Chromium device-scale checks, not Windows DPI validation. The public license notices were confirmed present in dist. Native desktop validation remains a separate integration step.

