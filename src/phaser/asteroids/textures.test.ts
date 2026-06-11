import { describe, expect, it } from 'vitest';

import { getAsteroidTextureBlend } from './textures';

const FULL_ROTATION = Math.PI * 2;
const MEGA_ASTEROID_FRAME_STEP = FULL_ROTATION / 96;
const SMALL_ASTEROID_FRAME_STEP = FULL_ROTATION / 48;

describe('getAsteroidTextureBlend', () => {
  it('starts each frame on the current generated texture', () => {
    expect(getAsteroidTextureBlend('small', 0, 0)).toEqual({
      current: {
        frameKey: 'phaser-asteroid-small-cartoon-lumpy-frame-0',
        textureKey: 'phaser-asteroid-small-cartoon-lumpy-atlas-0',
      },
      nextAlpha: 0,
      next: {
        frameKey: 'phaser-asteroid-small-cartoon-lumpy-frame-1',
        textureKey: 'phaser-asteroid-small-cartoon-lumpy-atlas-0',
      },
    });
  });

  it('crossfades toward the next generated frame halfway through the interval', () => {
    const blend = getAsteroidTextureBlend('small', 0, SMALL_ASTEROID_FRAME_STEP * 0.5);

    expect(blend.current).toEqual({
      frameKey: 'phaser-asteroid-small-cartoon-lumpy-frame-0',
      textureKey: 'phaser-asteroid-small-cartoon-lumpy-atlas-0',
    });
    expect(blend.nextAlpha).toBeCloseTo(0.5);
    expect(blend.next).toEqual({
      frameKey: 'phaser-asteroid-small-cartoon-lumpy-frame-1',
      textureKey: 'phaser-asteroid-small-cartoon-lumpy-atlas-0',
    });
  });

  it('wraps the next generated frame across zero', () => {
    expect(getAsteroidTextureBlend('small', 0, -SMALL_ASTEROID_FRAME_STEP * 0.1)).toEqual({
      current: {
        frameKey: 'phaser-asteroid-small-cartoon-lumpy-frame-47',
        textureKey: 'phaser-asteroid-small-cartoon-lumpy-atlas-0',
      },
      nextAlpha: 1,
      next: {
        frameKey: 'phaser-asteroid-small-cartoon-lumpy-frame-0',
        textureKey: 'phaser-asteroid-small-cartoon-lumpy-atlas-0',
      },
    });
  });

  it('moves larger atlas pages after the first page capacity', () => {
    const blend = getAsteroidTextureBlend('mega', 0, MEGA_ASTEROID_FRAME_STEP * 81);

    expect(blend.current).toEqual({
      frameKey: 'phaser-asteroid-mega-cartoon-lumpy-frame-81',
      textureKey: 'phaser-asteroid-mega-cartoon-lumpy-atlas-1',
    });
  });
});
