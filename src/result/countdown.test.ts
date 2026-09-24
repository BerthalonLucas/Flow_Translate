import { describe, expect, it } from 'vitest';
import { checkOnlyMs, Countdown, resultTiming, undoMs } from './countdown';

// A simulated clock: every call names its time, in ms.
describe('Countdown', () => {
  it('runs from the full duration to zero', () => {
    const clock = new Countdown(8000, 1000);
    expect(clock.remaining(1000)).toBe(8000);
    expect(clock.progress(4000)).toBeCloseTo(0.625);
    expect(clock.expired(8999)).toBe(false);
    expect(clock.expired(9000)).toBe(true);
    expect(clock.remaining(20000)).toBe(0);
    expect(clock.progress(20000)).toBe(0);
  });

  it('stops while the pointer rests on the pill, and resumes where it stopped', () => {
    const clock = new Countdown(8000, 0);
    clock.pause('hover', 2000);
    expect(clock.paused).toBe(true);
    expect(clock.remaining(2000)).toBe(6000);
    expect(clock.remaining(60000)).toBe(6000);
    expect(clock.expired(60000)).toBe(false);
    clock.resume('hover', 60000);
    expect(clock.remaining(61000)).toBe(5000);
    expect(clock.expired(65999)).toBe(false);
    expect(clock.expired(66000)).toBe(true);
  });

  it('stays stopped while the pointer or the focus holds it, whatever the order', () => {
    const clock = new Countdown(4000, 0);
    clock.pause('hover', 1000);
    clock.pause('focus', 1500);
    clock.resume('hover', 2000);
    expect(clock.paused).toBe(true);
    expect(clock.remaining(3000)).toBe(3000);
    clock.resume('focus', 3000);
    expect(clock.paused).toBe(false);
    expect(clock.remaining(4000)).toBe(2000);
    // A second pause for the same reason, or resuming a reason not held, changes nothing.
    clock.pause('focus', 4000);
    clock.pause('focus', 4500);
    clock.resume('hover', 4600);
    expect(clock.paused).toBe(true);
    clock.resume('focus', 5000);
    expect(clock.remaining(5000)).toBe(2000);
    expect(clock.expired(6999)).toBe(false);
    expect(clock.expired(7000)).toBe(true);
  });

  it('steps once a second for reduced motion', () => {
    const clock = new Countdown(8000, 0);
    expect([0, 999, 1000, 1001, 4000, 7999, 8000].map(now => clock.steppedProgress(now))).toEqual([1, 1, 7 / 8, 7 / 8, 4 / 8, 1 / 8, 0]);
    const odd = new Countdown(checkOnlyMs, 0);
    expect([0, 99, 100, 1100].map(now => odd.steppedProgress(now))).toEqual([1, 1, 0.5, 0]);
  });
});

describe('result timing', () => {
  it('keeps Undo 2 to 20 s (8 by default), the check alone 1.1 s, nothing otherwise', () => {
    expect([1, 2, 8, 8.4, 20, 25, Number.NaN].map(undoMs)).toEqual([2000, 2000, 8000, 8000, 20000, 20000, 8000]);
    expect(resultTiming({ check: true, undo: true, undoSeconds: 8, changedWords: true })).toEqual({ check: true, undo: true, durationMs: 8000 });
    expect(resultTiming({ check: false, undo: true, undoSeconds: 3, changedWords: true })).toEqual({ check: false, undo: true, durationMs: 3000 });
    expect(resultTiming({ check: true, undo: false, undoSeconds: 8, changedWords: true })).toEqual({ check: true, undo: false, durationMs: 1100 });
    expect(resultTiming({ check: false, undo: false, undoSeconds: 8, changedWords: true }).durationMs).toBe(0);
  });
});
