import { describe, expect, it } from 'vitest';
import { sweepPositions, sweepStrip } from './geometry';

describe('halo sweep strip', () => {
  it('lays the lines end to end in reading order', () => {
    const { lines, total } = sweepStrip([
      { x: 12, y: 12, width: 300, height: 20 },
      { x: 12, y: 32, width: 180.5, height: 20 },
      { x: 40, y: 52, width: 60, height: 22 },
    ]);
    expect(lines.map(line => line.offset)).toEqual([0, 300, 480.5]);
    expect(total).toBe(540.5);
    expect(lines[1]).toMatchObject({ x: 12, y: 32, width: 180.5, height: 20 });
  });

  it('gives one line the lab\'s own positions (300 %, 120 % → −20 %)', () => {
    // For an image three times as wide as the box, p % sits at p × (box − image).
    const width = 250;
    const lab = (percent: number) => (percent / 100) * (width - 3 * width);
    const { from, to } = sweepPositions(width, 0);
    expect(from).toBeCloseTo(lab(120));
    expect(to).toBeCloseTo(lab(-20));
  });

  it('keeps the band continuous across lines', () => {
    // The strip point under a line's left edge is the same on the previous line's right
    // edge: the gradient does not jump between lines at any moment of the animation.
    const { lines, total } = sweepStrip([{ x: 0, y: 0, width: 200, height: 20 }, { x: 0, y: 20, width: 120, height: 20 }]);
    for (const t of [0, 0.25, 0.5, 1]) {
      const at = (line: (typeof lines)[number]) => { const { from, to } = sweepPositions(total, line.offset); return from + (to - from) * t; };
      // Image coordinate at a line's own x: −position. End of line 1 = start of line 2.
      expect(-at(lines[0]) + lines[0].width).toBeCloseTo(-at(lines[1]));
    }
  });

  it('draws nothing without lines', () => {
    expect(sweepStrip([])).toEqual({ lines: [], total: 0 });
  });
});
