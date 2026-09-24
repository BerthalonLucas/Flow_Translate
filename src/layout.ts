import type { AutoClose, Form, HitRegion, Presentation, Rect, Screen, TextSize } from './types';
import { ilotMetrics } from './menu/metrics';
import { surfaceRadius } from './motion/surface';

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

// The Îlot (lot 7) has its own window, reserved once per capture for its largest shapes: the
// widest (the error pill of lot 10, 400, wider than the field's 283) by the tallest (the grid,
// 116), src/menu/metrics.ts, plus the halo. Its shapes then only change the hit-test regions,
// never the window (plan §4.3: the reserve holds « the Îlot's grid or the error card »).
//   anchored  `frame` is the compact strip that Rust places beside the selection like the glass
//             (8 px under it, or 8 px over it when the room below is short; its right edge on the
//             selection's end, clamped into the work area): 283 × 32, the widest shape of the
//             menu (the field), so the Îlot only leaves the selection's end when that end is less
//             than 283 px from the work area's left edge, as before lot 10. The Îlot hangs from
//             the strip's right edge and grows away from the selection, by at most 84 px: the
//             reserve keeps that room on both sides, since the side is only known once Rust placed
//             the window (ilotSide). The error pill, up to 117 px wider than the strip, grows left
//             like every shape; the reserve keeps those 117 px on the strip's left, and as many on
//             its right, where the pill slides when the work area's left edge is closer than its
//             width (ilotShift). Rust clamps the strip only: the transparent reserve around it may
//             leave the work area. 581 × 264.
//   bottom    no anchor (clipboard): the box rests on the window's bottom edge, centred, and
//             grows up; Rust docks the window bottom-centre. 464 × 152.
export type IlotSide = 'below' | 'above';
// shift: how far the shape slides right of the strip's corner (ilotShift), anchored only.
export type IlotShapeBox = { width: number; height: number; shift?: number };
// The strip Rust clamps: the menu's widest shape.
export const ilotStrip = Math.max(ilotMetrics.prompt.width, ilotMetrics.grid.width);
export const ilotBox = { width: Math.max(ilotStrip, ilotMetrics.error.maxWidth), height: ilotMetrics.grid.height };
// What the widest shape overhangs the strip by: the reserve's room on each side of the strip.
const ilotSpare = ilotBox.width - ilotStrip;
const ilotGrowth = ilotBox.height - ilotMetrics.compactHeight;
export function ilotReserve(presentation: Presentation): { width: number; height: number; frame: HitRegion } {
  if (presentation === 'bottom') return { width: ilotBox.width + 2 * halo.x, height: halo.top + ilotBox.height + halo.bottomForm, frame: { x: halo.x, y: halo.top, width: ilotBox.width, height: ilotBox.height, radius: 0 } };
  const y = halo.top + ilotGrowth;
  return { width: ilotStrip + 2 * (ilotSpare + halo.x), height: y + ilotMetrics.compactHeight + ilotGrowth + halo.bottom, frame: { x: halo.x + ilotSpare, y, width: ilotStrip, height: ilotMetrics.compactHeight, radius: 0 } };
}
// The room around the strip's right edge (the corner facing the selection's end) inside the work
// area, logical pixels: `left` to its left edge, `right` to its right edge. From where Rust put the
// window and the work area of the anchor's screen, both physical (the anchor's own units).
export type IlotRoom = { left: number; right: number };
export function ilotRoom(windowX: number, scale: number, work: Pick<Rect, 'x' | 'width'>): IlotRoom {
  const corner = windowX + (ilotReserve('anchored').frame.x + ilotStrip) * scale;
  return { left: (corner - work.x) / scale, right: (work.x + work.width - corner) / scale };
}
// How far a shape slides right so it stays in the work area: nothing while it fits left of the
// corner (always, up to the strip's width: Rust clamped the strip), else what it overhangs, whole
// pixels, at most the reserve's spare and never past the work area's right edge. Unknown room:
// nothing (the browser preview, a screen the point is not on).
export function ilotShift(width: number, room: IlotRoom | null): number {
  if (!room) return 0;
  const overhang = Math.ceil(width - room.left);
  return overhang > 0 ? Math.max(0, Math.min(overhang, ilotSpare, Math.floor(room.right))) : 0;
}
// The hit-test region of a shape in that window. Given two shapes (the start of a change), the
// box that holds both: they share the corner, or the bottom edge, that faces the selection (each
// slid by its own shift), and the smaller radius keeps both corners inside. Whole pixels, inside
// the window.
export function ilotRegion(presentation: Presentation, side: IlotSide, ...shapes: IlotShapeBox[]): HitRegion {
  const reserve = ilotReserve(presentation);
  const { frame } = reserve;
  const height = Math.min(reserve.height, Math.ceil(Math.max(...shapes.map(shape => shape.height))));
  const bottomEdge = frame.y + frame.height;
  const round = (width: number) => Math.min(...shapes.map(shape => surfaceRadius(shape.height)), width / 2, height / 2);
  if (presentation === 'bottom') {
    const width = Math.min(reserve.width, Math.ceil(Math.max(...shapes.map(shape => shape.width))));
    const x = Math.max(0, Math.floor((reserve.width - width) / 2));
    return { x, y: Math.max(0, bottomEdge - height), width: Math.min(reserve.width - x, Math.ceil((reserve.width + width) / 2) - x), height, radius: round(width) };
  }
  const corner = frame.x + frame.width;
  const x = Math.max(0, Math.floor(Math.min(...shapes.map(shape => corner + (shape.shift ?? 0) - shape.width))));
  const width = Math.min(reserve.width, Math.ceil(Math.max(...shapes.map(shape => corner + (shape.shift ?? 0))))) - x;
  const y = side === 'below' ? frame.y : Math.max(0, bottomEdge - height);
  return { x, y, width, height: Math.min(reserve.height - y, height), radius: round(width) };
}
// Which side Rust chose, read back from where it put the window (physical pixels, like the
// anchor): the strip below the middle of the selection means below.
export function ilotSide(windowTop: number, scale: number, anchor: Rect): IlotSide {
  const stripTop = windowTop + ilotReserve('anchored').frame.y * scale;
  return stripTop >= anchor.y + anchor.height / 2 ? 'below' : 'above';
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
