import { describe, expect, it } from 'vitest';
import { bottomReserve, countWords, decideForm, decidePlacement, ilotRegion, ilotReserve, ilotSide, readerMetrics, readingBudget, remainingAfterLeave, shortMetrics } from './layout';

describe('reading forms (2026-09-14)', () => {
  it('reads up to eight short lines beside the selection, more in the reader', () => {
    expect(decideForm(1)).toBe('short');
    expect(decideForm(8)).toBe('short');
    expect(decideForm(9)).toBe('reader');
  });
  it('sizes the reader from the screen it is on, half the width and whole lines within 45 % of the height', () => {
    const wide = readerMetrics({ width: 2560, height: 1400 }, 'normal');
    expect(wide.width).toBe(1280);
    expect(wide).toMatchObject({ fontSize: 22, lineHeight: 33 });
    // 630 px available, 34 px of padding: 18 whole lines of 33 px.
    expect(wide.maxHeight).toBe(18 * 33 + 34);
    const laptop = readerMetrics({ width: 1280, height: 693 }, 'xlarge');
    expect(laptop.width).toBe(640);
    expect(laptop.maxHeight).toBe(Math.floor((312 - 34) / 39) * 39 + 34);
    expect(laptop.maxHeight).toBeLessThanOrEqual(312);
    // Nothing hard-coded: another screen, another band.
    expect(readerMetrics({ width: 1920, height: 1040 }, 'normal').width).toBe(960);
  });
  it('keeps the short glass at 380 px with the preset metrics', () => {
    expect(shortMetrics('normal')).toMatchObject({ width: 380, fontSize: 16, lineHeight: 24, maxHeight: 8 * 24 + 29, minHeight: 53 });
    expect(shortMetrics('large')).toMatchObject({ fontSize: 18, lineHeight: 27 });
    expect(shortMetrics('xlarge')).toMatchObject({ fontSize: 20, lineHeight: 30 });
  });
  it('reserves the bottom window for the reader, its menu and the halos', () => {
    const reserve = bottomReserve({ width: 2560, height: 1400 }, 'normal');
    expect(reserve.width).toBe(1280 + 64);
    expect(reserve.height).toBe(20 + 236 + 6 + 14 + (18 * 33 + 34) + 16);
  });
});

describe('reading budget', () => {
  it('grows with the words between five seconds and the form ceiling, scaled by the setting', () => {
    expect(readingBudget(3, 'short', 'normal')).toBe(5000);
    expect(readingBudget(20, 'short', 'normal')).toBe(1000 + 350 * 20);
    expect(readingBudget(200, 'short', 'normal')).toBe(30000);
    expect(readingBudget(200, 'reader', 'normal')).toBe(1500 + 350 * 200);
    expect(readingBudget(1000, 'reader', 'normal')).toBe(90000);
    expect(readingBudget(20, 'short', 'fast')).toBe(Math.round(8000 * 0.7));
    expect(readingBudget(20, 'short', 'slow')).toBe(12000);
    expect(readingBudget(20, 'short', 'never')).toBeNull();
  });
  it('shortens what remains to four seconds after a real visit, never under two and a half', () => {
    expect(remainingAfterLeave(20000, 1500)).toBe(4000);
    expect(remainingAfterLeave(3000, 1500)).toBe(3000);
    expect(remainingAfterLeave(800, 1500)).toBe(2500);
    // A pass-through of less than a second changes nothing but the floor.
    expect(remainingAfterLeave(20000, 300)).toBe(20000);
    expect(remainingAfterLeave(1000, 300)).toBe(2500);
  });
  it('counts words on whitespace', () => {
    expect(countWords('Bonjour,  ceci est\nune phrase.')).toBe(5);
    expect(countWords('   ')).toBe(0);
  });
});

it('decides the placement at the capture on the source: a long selection waits at the bottom', () => {
  expect(decidePlacement(true, 1)).toBe('anchored');
  expect(decidePlacement(true, 8)).toBe('anchored');
  expect(decidePlacement(true, 9)).toBe('bottom');
  expect(decidePlacement(false, 1)).toBe('bottom');
});

describe('Îlot window (lot 7)', () => {
  it('reserves the largest shape and its growth on both sides of the strip Rust anchors', () => {
    // 283 wide (the field) + 2 × 32 of halo; 20 + 84 + 32 + 84 + 44 high.
    expect(ilotReserve('anchored')).toEqual({ width: 347, height: 264, frame: { x: 32, y: 104, width: 283, height: 32, radius: 0 } });
    // No anchor: the 283 × 116 box on the bottom halo of the band (16).
    expect(ilotReserve('bottom')).toEqual({ width: 347, height: 152, frame: { x: 32, y: 20, width: 283, height: 116, radius: 0 } });
  });
  it('hangs each shape from the strip’s right edge, on the side Rust chose', () => {
    expect(ilotRegion('anchored', 'below', { width: 120, height: 32 })).toEqual({ x: 195, y: 104, width: 120, height: 32, radius: 16 });
    expect(ilotRegion('anchored', 'below', { width: 218, height: 116 })).toEqual({ x: 97, y: 104, width: 218, height: 116, radius: 16 });
    expect(ilotRegion('anchored', 'above', { width: 218, height: 116 })).toEqual({ x: 97, y: 20, width: 218, height: 116, radius: 16 });
    expect(ilotRegion('anchored', 'above', { width: 283, height: 34 })).toEqual({ x: 32, y: 102, width: 283, height: 34, radius: 17 });
    // The pill of lot 8 is fully round.
    expect(ilotRegion('anchored', 'below', { width: 44, height: 28 })).toEqual({ x: 271, y: 104, width: 44, height: 28, radius: 14 });
  });
  it('covers both shapes while one turns into the other, with the smaller radius', () => {
    expect(ilotRegion('anchored', 'below', { width: 218, height: 116 }, { width: 283, height: 34 })).toEqual({ x: 32, y: 104, width: 283, height: 116, radius: 16 });
    expect(ilotRegion('anchored', 'below', { width: 120, height: 32 }, { width: 52, height: 28 })).toEqual({ x: 195, y: 104, width: 120, height: 32, radius: 14 });
  });
  it('centres the shape on the bottom edge without an anchor', () => {
    expect(ilotRegion('bottom', 'above', { width: 120, height: 32 })).toEqual({ x: 113, y: 104, width: 121, height: 32, radius: 16 });
    expect(ilotRegion('bottom', 'above', { width: 44, height: 28 })).toEqual({ x: 151, y: 108, width: 45, height: 28, radius: 14 });
    expect(ilotRegion('bottom', 'above', { width: 283, height: 116 })).toEqual({ x: 32, y: 20, width: 283, height: 116, radius: 16 });
  });
  it('reads the side Rust chose from the window’s position', () => {
    const anchor = { x: 400, y: 300, width: 120, height: 18 };
    // Below: the strip 8 px under the selection (318 + 8), the window 104 px higher.
    expect(ilotSide(222, 1, anchor)).toBe('below');
    // Above: the strip ends 8 px over the selection.
    expect(ilotSide(300 - 8 - 32 - 104, 1, anchor)).toBe('above');
    // At 150 %, the window's offsets are physical as well.
    expect(ilotSide(318 + 8 - 156, 1.5, anchor)).toBe('below');
    expect(ilotSide(300 - 8 - 48 - 156, 1.5, anchor)).toBe('above');
  });
});
