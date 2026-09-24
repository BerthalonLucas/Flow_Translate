import { animate } from 'motion';
import { toMotionSpring } from './spring';
import type { MotionTokens } from './tokens';

// A surface that changes shape (lots 7-9: menu → pill) inside the reserved window (plan §4.3):
// width, height and radius follow the spring on the element itself, never Motion's `layout`
// (a scale, which would squash the text and icons). Its content sits on a `.shape-layer`
// (src/glass.css), centred at its natural size, so it stays centred while the shape changes.
// Nothing native moves meanwhile: hit-test regions are published at the end (and at the start
// on the larger of the two shapes).

export type SurfaceShape = { width: number; height: number; borderRadius?: number };

// Surface.jsx:70 — a pill (44 px or less) is fully round, anything taller has the 16 px radius.
export const surfaceCornerRadius = 16;
export function surfaceRadius(height: number): number {
  return height <= 44 ? height / 2 : surfaceCornerRadius;
}

// MotionConfig's reducedMotion never reaches an imperative animate() nor width/height/radius,
// so the reduced case is handled here: the shape is set at once. An instant Motion animation
// still replaces a spring in flight, but only writes on its next frame: the style is written
// now as well.
export function animateSurface(element: HTMLElement, shape: SurfaceShape, tokens: MotionTokens, reduced: boolean, spring: 'morph' | 'enter' = 'morph') {
  const target = { width: `${shape.width}px`, height: `${shape.height}px`, borderRadius: `${shape.borderRadius ?? surfaceRadius(shape.height)}px` };
  if (!reduced) return animate(element, target, toMotionSpring(tokens[spring]));
  const controls = animate(element, target, { duration: 0 });
  Object.assign(element.style, target);
  return controls;
}

// The Îlot's corner slides right, on the same spring as the shape it holds, when a shape wider
// than the room left of the selection's end would leave the work area (lot 10's error pill near
// the screen's left edge; src/layout.ts ilotShift). A translation only; `instant` (the first
// shape) and reduced motion set it at once.
export function animateSlide(element: HTMLElement, x: number, tokens: MotionTokens, reduced: boolean, instant = false) {
  if (!reduced && !instant) return animate(element, { x }, toMotionSpring(tokens.morph));
  const controls = animate(element, { x }, { duration: 0 });
  element.style.transform = x ? `translateX(${x}px)` : 'none';
  return controls;
}
