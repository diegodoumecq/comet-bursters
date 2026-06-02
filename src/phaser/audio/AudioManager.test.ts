import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';

import { getCameraDistanceAttenuation } from './AudioManager';

describe('audio manager spatial helpers', () => {
  it('attenuates world sounds from the active camera center', () => {
    const camera = {
      worldView: { height: 600, width: 800, x: 1000, y: 2000 },
    } as Phaser.Cameras.Scene2D.Camera;

    expect(getCameraDistanceAttenuation({ x: 1400, y: 2300 }, camera, 1000)).toBe(1);
    expect(getCameraDistanceAttenuation({ x: 1900, y: 2300 }, camera, 1000)).toBeCloseTo(0.5);
    expect(getCameraDistanceAttenuation({ x: 2600, y: 2300 }, camera, 1000)).toBe(0);
  });
});
