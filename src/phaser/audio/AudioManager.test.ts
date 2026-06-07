import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';

import { getWorldDistanceAttenuation } from './AudioManager';

describe('audio manager spatial helpers', () => {
  it('attenuates world sounds from the active camera center without a listener', () => {
    const camera = {
      worldView: { height: 600, width: 800, x: 1000, y: 2000 },
    } as Phaser.Cameras.Scene2D.Camera;

    expect(getWorldDistanceAttenuation({ x: 1400, y: 2300 }, camera, 1000)).toBe(1);
    expect(getWorldDistanceAttenuation({ x: 1900, y: 2300 }, camera, 1000)).toBeCloseTo(0.5);
    expect(getWorldDistanceAttenuation({ x: 2600, y: 2300 }, camera, 1000)).toBe(0);
  });

  it('attenuates world sounds from the ship listener when provided', () => {
    const camera = {
      worldView: { height: 600, width: 800, x: 1000, y: 2000 },
    } as Phaser.Cameras.Scene2D.Camera;

    expect(
      getWorldDistanceAttenuation({ x: 100, y: 200 }, camera, 1000, { x: 100, y: 200 }),
    ).toBe(1);
    expect(
      getWorldDistanceAttenuation({ x: 600, y: 200 }, camera, 1000, { x: 100, y: 200 }),
    ).toBeCloseTo(0.5);
  });
});
