import type { AutoClose, Form, Presentation, Screen, TextSize } from './types';

// Calibrated reading (2026-09-14): two forms decided once, on the real result. The short
// glass (≤ 8 lines at 380 px) opens beside the selection; anything longer is a reader
// band centred on the bottom of the screen, half its work area wide, never a hard-coded
// size. The pill bites the upper-right edge of the glass by 14 px (design « 1a »).
export const glass = {
  shortWidth: 380,
  radius: 28, pillHeight: 28, pillInset: 16, overlap: 14,
  menuWidth: 196, menuTop: 20,
  // Text paddings: top, side, bottom (short glass / reader band).
  shortPadding: { top: 16, side: 22, bottom: 13 },
  readerPadding: { top: 18, side: 28, bottom: 16 },
  waitPill: { width: 60, height: 28 },
};
export const COMPACT_MAX_LINES = 8;
// Shadow halo around the tight regions in the packaged window (glass.css carries the same values).
export const halo = { x: 32, top: 20, bottom: 44, bottomForm: 16 };
// The tallest menu: six entries (Original, Remplacer or Réessayer, Relancer, Réglages,
// Fermer, one spare) of 32.9 px each, 4 px padding and a 1 px border each side, a 1 px
// separator with 3 px margins. The reserve keeps room for a seventh entry.
export const menu = { width: 196, reserve: 236 };

// Font size / line height of each form, per preset (Réglages « Taille du texte »).
export const presets: Record<TextSize, { short: [number, number]; reader: [number, number] }> = {
  normal: { short: [16, 24], reader: [22, 33] },
  large: { short: [18, 27], reader: [24, 36] },
  xlarge: { short: [20, 30], reader: [26, 39] },
};

export type ShortMetrics = { width: number; fontSize: number; lineHeight: number; maxHeight: number; minHeight: number };
export type ReaderMetrics = { width: number; fontSize: number; lineHeight: number; maxHeight: number };

export function shortMetrics(preset: TextSize): ShortMetrics {
  const [fontSize, lineHeight] = presets[preset].short;
  const { top, bottom } = glass.shortPadding;
  return { width: glass.shortWidth, fontSize, lineHeight, maxHeight: COMPACT_MAX_LINES * lineHeight + top + bottom, minHeight: lineHeight + top + bottom };
}

// The band: half the work area wide, at most 45 % of its height, whole lines only.
export function readerMetrics(screen: Pick<Screen, 'width' | 'height'>, preset: TextSize): ReaderMetrics {
  const [fontSize, lineHeight] = presets[preset].reader;
  const { top, bottom } = glass.readerPadding;
  const width = Math.max(320, Math.round(screen.width * 0.5));
  const lines = Math.max(2, Math.floor((Math.round(screen.height * 0.45) - top - bottom) / lineHeight));
  return { width, fontSize, lineHeight, maxHeight: lines * lineHeight + top + bottom };
}

// ≤ 8 lines at the short width read beside the selection; more is a reader.
export function decideForm(lines: number): Exclude<Form, 'pending'> {
  return lines <= COMPACT_MAX_LINES ? 'short' : 'reader';
}
// Where the wait pill and then the glass live is decided at the capture, on the source
// text: a translation is about as long as its source, so a source past the short glass
// waits at the bottom from the start and the band is born there, without any jump from
// the selection (UI-025). A capture without an anchor lives at the bottom anyway.
export function decidePlacement(anchored: boolean, sourceLines: number): Presentation {
  return anchored && sourceLines <= COMPACT_MAX_LINES ? 'anchored' : 'bottom';
}

// The native window is reserved once per form so a menu or feedback never resizes it:
// anchored, the short glass and the menu under its pill; bottom, the reader band and the
// menu above its pill. Both hold the halo that carries the shadows.
export const anchoredFloor = halo.top + glass.overlap + glass.menuTop + menu.reserve + halo.bottom; // 334
export const anchoredReserve = { width: glass.shortWidth + 2 * halo.x }; // 444
export function bottomReserve(screen: Pick<Screen, 'width' | 'height'>, preset: TextSize) {
  const reader = readerMetrics(screen, preset);
  // top halo, menu, 6 px gap, pill band, reader glass, bottom halo
  return { width: reader.width + 2 * halo.x, height: halo.top + menu.reserve + 6 + glass.overlap + reader.maxHeight + halo.bottomForm };
}

// Reading budget: orientation plus 350 ms per word, between 5 s and 30 s (short) or 90 s
// (reader), scaled by the « Fermeture automatique » setting; null means never.
export const autoCloseFactor: Record<AutoClose, number | null> = { fast: 0.7, normal: 1, slow: 1.5, never: null };
export function readingBudget(words: number, form: Exclude<Form, 'pending'>, autoClose: AutoClose): number | null {
  const factor = autoCloseFactor[autoClose];
  if (factor === null) return null;
  const orientation = form === 'reader' ? 1500 : 1000;
  const ceiling = form === 'reader' ? 90000 : 30000;
  return Math.round(Math.min(ceiling, Math.max(5000, orientation + 350 * words)) * factor);
}
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

// After a visit of at least a second, leaving with the pointer shortens what remains to
// four seconds, never below two and a half: the reader has said « done ».
export const LEAVE_REMAINING = 4000;
export const LEAVE_FLOOR = 2500;
export function remainingAfterLeave(remaining: number, visitMs: number): number {
  if (visitMs < 1000) return Math.max(remaining, LEAVE_FLOOR);
  return Math.max(LEAVE_FLOOR, Math.min(remaining, LEAVE_REMAINING));
}
// Dimming: to 55 % in 600 ms, held 1.4 s, then the 300 ms exit. Any approach grants 5 s.
export const dimming = { opacity: 0.55, fadeMs: 600, holdMs: 1400, exitMs: 300, graceMs: 5000 };
