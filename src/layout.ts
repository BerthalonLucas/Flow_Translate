import type { Presentation } from './types';

// Design handoff « 1a » (2026-09-09): the glass only holds text, the opaque pill
// bites the upper-right edge by 14 px. Rust anchors region zero (the glass), so the
// 14 px transparent band above it is part of the measured window, not of placement.
export const glass = {
  compactWidth: 300, enlargedWidth: 420,
  compactMaxHeight: 220, enlargedMaxHeight: 440,
  radius: 28, pillHeight: 28, pillInset: 16, overlap: 14,
  lineHeight: 21.6, menuWidth: 196, menuTop: 20,
};
export type TextLayout = { presentation: Presentation };
export const compactLayout: TextLayout = { presentation: 'contextual' };
export const enlargedLayout: TextLayout = { presentation: 'reader' };
