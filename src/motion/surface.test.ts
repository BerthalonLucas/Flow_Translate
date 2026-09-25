import { describe, expect, it } from 'vitest';
import { animateSurface, surfaceRadius } from './surface';
import { motionPresets } from './tokens';

describe('animateSurface', () => {
  it('rounds a pill fully and gives anything taller the 16 px radius (Surface.jsx:70)', () => {
    expect(surfaceRadius(32)).toBe(16);
    expect(surfaceRadius(44)).toBe(22);
    expect(surfaceRadius(116)).toBe(16);
  });

  it('sets the shape at once under reduced motion, since MotionConfig never reaches animate()', async () => {
    const element = document.createElement('div');
    Object.assign(element.style, { width: '218px', height: '116px', borderRadius: '16px' });
    document.body.append(element);
    const started = performance.now();
    await animateSurface(element, { width: 110, height: 32 }, motionPresets.smooth, true);
    expect(performance.now() - started).toBeLessThan(200);
    expect([element.style.width, element.style.height, element.style.borderRadius]).toEqual(['110px', '32px', '16px']);
    element.remove();
  });

  it('springs to the new shape otherwise and ends exactly on it', async () => {
    const element = document.createElement('div');
    Object.assign(element.style, { width: '60px', height: '28px', borderRadius: '14px' });
    document.body.append(element);
    await animateSurface(element, { width: 218, height: 116 }, motionPresets.bouncy, false);
    expect([element.style.width, element.style.height, element.style.borderRadius]).toEqual(['218px', '116px', '16px']);
    element.remove();
  });
});
