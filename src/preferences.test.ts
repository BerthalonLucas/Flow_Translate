import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';
import { reducedMotionConfig, resolveMotion } from './motion/preference';

describe('document preferences', () => {
  it('follows the system theme unless the user forced one', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('reduces motion when Windows asks, unless the user chose always or reduced', () => {
    expect(resolveMotion('system', true)).toBe('reduced');
    expect(resolveMotion('system', false)).toBe('full');
    expect(resolveMotion('full', true)).toBe('full');
    expect(resolveMotion('reduced', false)).toBe('reduced');
    expect([reducedMotionConfig('system'), reducedMotionConfig('full'), reducedMotionConfig('reduced')]).toEqual(['user', 'never', 'always']);
  });
});
