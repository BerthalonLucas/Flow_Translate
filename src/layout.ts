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
// Shadow halo around the tight regions in the packaged window (glass.css carries the same values).
export const halo = { x: 32, top: 20, bottom: 44, dockedBottom: 16 };
// The tallest menu: six entries (Agrandir, Original, Remplacer or Réessayer, Relancer,
// Réglages, Fermer) of 32.9 px each (13 px × 1.3 plus 8 px above and below), 4 px padding
// and a 1 px border on each side, a 1 px separator with 3 px margins: 197.4 + 8 + 2 + 7 =
// 214.4 px. The reserve keeps room for a seventh entry.
export const menu = { width: 196, reserve: 236 };
// Since 2026-09-13 the native window is reserved once and never resized by a fold, an
// unfold or a menu: docked, it holds the enlarged glass with the menu above the pill;
// anchored, at least the menu under the pill.
export const dock = {
  width: glass.enlargedWidth + 2 * halo.x, // 484
  // top halo, menu, 6 px gap, pill band, enlarged glass, 6 px gap, tab, bottom halo
  height: halo.top + menu.reserve + 6 + glass.overlap + glass.enlargedMaxHeight + 6 + 20 + halo.dockedBottom, // 758
  tab: { width: 44, height: 20 },
};
// top halo, pill band, menu 20 px under the glass top, menu, bottom halo
export const anchoredFloor = halo.top + glass.overlap + glass.menuTop + menu.reserve + halo.bottom; // 334
export type TextLayout = { presentation: Presentation };
export const compactLayout: TextLayout = { presentation: 'contextual' };
export const enlargedLayout: TextLayout = { presentation: 'reader' };
