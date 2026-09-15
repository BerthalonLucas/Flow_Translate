import { describe, expect, it } from 'vitest';
import { bottomReserve, countWords, decideForm, decidePlacement, readerMetrics, readingBudget, remainingAfterLeave, shortMetrics } from './layout';

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
