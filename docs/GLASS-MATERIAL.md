# Glass material refinement

The approved C composition remains unchanged: contextual glass 280 px, reader 560 px (responsive preview), radius 26 px, action pill 60 × 28 px overlapping by 14 px. Native hit regions, region-zero anchoring, resize caching and dismissal acknowledgement are unchanged.

## Material

`src/glass.css` shares material tokens between the text glass, pill, menu and feedback:

- Graphite RGB 29, 31, 36; alpha .66 for the main glass and .68 for accessories.
- One static `blur(32px) saturate(120%)` backdrop filter per surface.
- Asymmetric white border alpha .28 / .13 / .09 / .20 (top / right / bottom / left).
- A restrained diagonal reflection, maximum white alpha .035, plus a thin upper glint.
- Internal highlights and lower internal shade; no external shadow needed outside the native clipping region.

The fill leaves more of the desktop visible than the previous .78/.92/.94 material. Text keeps full opacity; feedback text is slightly lighter to retain legibility. Actual appearance depends on the backdrop and Windows composition; browser images do not validate native blur or desktop contrast.

## Motion

Motion continues to animate opacity, without scaling the measured root or text. Copy/check glyphs now crossfade inside a fixed 15 × 15 px slot, including the return to the copy icon. Menu, comparison and feedback use the shared 140 ms feedback entrance / 100 ms exit; overlay entrance and format-change/dismissal sequencing remain unchanged. Reduced motion makes these transitions immediate. No blur, shadow, or per-frame native geometry animation was added.

## Preview and verification

Standalone browser preview: `/?window=overlay&demo=1&background=light`, `dark`, or `color`; append `&scenario=long` for the reader. Three discreet buttons switch backgrounds without replacing the active capture. These controls are absent from the native overlay.

Validation: production build, 7 unit tests and 32 Playwright tests. The added cases exercise background changes and copy/check completion under normal and reduced motion, preserving capture identity, complete text and pill geometry. Existing tests cover streaming IPC stability, native dismissal races, reduced motion, menu focus, reader navigation and 100–200% device scales. Native material, focus and frame pacing require separate Windows review.
