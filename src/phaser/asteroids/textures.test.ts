import { describe, expect, it } from 'vitest';

import { getAsteroidTextureBlend } from './textures';

const FULL_ROTATION = Math.PI * 2;
const SMALL_ASTEROID_FRAME_STEP = FULL_ROTATION / 48;

describe('getAsteroidTextureBlend', () => {
  it('starts each frame on the current generated texture', () => {
    expect(getAsteroidTextureBlend('small', 0, 0)).toEqual({
      currentKey: 'phaser-asteroid-small-cartoon-lumpy-frame-0',
      nextAlpha: 0,
      nextKey: 'phaser-asteroid-small-cartoon-lumpy-frame-1',
    });
  });

  it('crossfades toward the next generated frame halfway through the interval', () => {
    const blend = getAsteroidTextureBlend('small', 0, SMALL_ASTEROID_FRAME_STEP * 0.5);

    expect(blend.currentKey).toBe('phaser-asteroid-small-cartoon-lumpy-frame-0');
    expect(blend.nextAlpha).toBeCloseTo(0.5);
    expect(blend.nextKey).toBe('phaser-asteroid-small-cartoon-lumpy-frame-1');
  });

  it('wraps the next generated frame across zero', () => {
    expect(getAsteroidTextureBlend('small', 0, -SMALL_ASTEROID_FRAME_STEP * 0.1)).toEqual({
      currentKey: 'phaser-asteroid-small-cartoon-lumpy-frame-47',
      nextAlpha: 1,
      nextKey: 'phaser-asteroid-small-cartoon-lumpy-frame-0',
    });
  });
});
