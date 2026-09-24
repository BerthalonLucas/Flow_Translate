// The Îlot's geometry, for the window reserve (src/layout.ts, at integration) and the tests.
// Source: design-lab/src/app.css:179-198 and menus.jsx:37-39, which differ slightly from the
// plan's rounded figures (§9: grid ≈ 222 × 112, field ≈ 262 × 34): the lab is the reference.
export const ilotMetrics = {
  // Compact: a 26 px button row with 3 px of padding (app.css:179-180); its width follows the
  // last action's label (≈ 110 px for « Fix »).
  compactHeight: 32,
  // Grid: tiles of 66 × 50, 4 apart, 6 from the edge (app.css:188-189): 3 × 66 + 2 × 4 + 2 × 6.
  tile: { width: 66, height: 50 },
  gap: 4,
  padding: 6,
  grid: { width: 218, height: 116 },
  // Field: 10 + dot 8 + 6 + input 230 + 6 + keycap 17 + 6, 34 high (menus.jsx:37-39, app.css:185-198).
  prompt: { width: 283, height: 34, input: 230 },
  // The work pill the surface turns into (plan lot 8): 44 × 28, fully round (radius 14).
  pill: { width: 44, height: 28 },
  // The error pill (lot 10; app.css:169, .err-row): 30 high. Its widest text with its button, in
  // English or French, measures 389 px (« Texte non modifiable, rien remplacé » + « Copier le
  // résultat », Chromium, 2026-09-24): capped at 400, a longer text (a model's name) ends in an
  // ellipsis. The widest shape of the Îlot: the window's reserve holds it (src/layout.ts).
  error: { height: 30, maxWidth: 400 },
  // Corner radius above 44 px of height; below, the shape is fully round (Surface.jsx:70).
  radius: 16,
  // A pointer resting on the compact state unfolds the grid after this long (menus.jsx:81).
  hoverMs: 450,
  // A free instruction holds 1 to 1000 characters, without NUL (plan lot 7).
  instructionMax: 1000,
} as const;
