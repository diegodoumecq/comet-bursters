import { describe, expect, it } from 'vitest';

import type { WeaponKind } from '../weapons/types';
import {
  getPlayerHullTextureBlend,
  getPlayerTurretTextureKey,
  PLAYER_HULL_ROTATION_FRAME_COUNT,
  PLAYER_TURRET_MUZZLE_OFFSET,
  PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
  PLAYER_TURRET_SPRITE_SPECS,
  PLAYER_TURRET_TEXTURE_SIZE,
  samplePlayerHullHeightMap,
} from './textures';

const WEAPONS: WeaponKind[] = [
  'blackHole',
  'fuelGun',
  'inspectionProbe',
  'pusher',
  'shotgun',
  'small',
  'tractor',
];

describe('player textures', () => {
  it('provides a dedicated turret texture key for every weapon', () => {
    const textureKeys = WEAPONS.map((weapon) => getPlayerTurretTextureKey(weapon));

    expect(new Set(textureKeys).size).toBe(WEAPONS.length);
  });

  it('standardizes every turret sprite to the same size, orientation, and length', () => {
    for (const weapon of WEAPONS) {
      expect(PLAYER_TURRET_SPRITE_SPECS[weapon]).toEqual({
        length: PLAYER_TURRET_MUZZLE_OFFSET,
        orientationRadians: PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
        textureKey: getPlayerTurretTextureKey(weapon),
        textureSize: PLAYER_TURRET_TEXTURE_SIZE,
      });
    }
  });

  it('provides adjacent hull atlas frames for crossfaded rotation rendering', () => {
    const blend = getPlayerHullTextureBlend(Math.PI / PLAYER_HULL_ROTATION_FRAME_COUNT);

    expect(blend.current.frameKey).toBe('phaser-ship-hull-frame-0');
    expect(blend.next.frameKey).toBe('phaser-ship-hull-frame-1');
    expect(blend.nextAlpha).toBeGreaterThan(0);
    expect(blend.nextAlpha).toBeLessThan(1);
  });

  it('defines a bird-like ship heightmap with wings, canopy, and empty exterior', () => {
    const canopy = samplePlayerHullHeightMap({ x: 0.18, y: 0 });
    const topWing = samplePlayerHullHeightMap({ x: -0.44, y: -0.29 });
    const bottomWing = samplePlayerHullHeightMap({ x: -0.44, y: 0.29 });
    const outside = samplePlayerHullHeightMap({ x: 0.08, y: -0.86 });

    expect(canopy.material).toBe('canopy');
    expect(canopy.height).toBeGreaterThan(topWing.height);
    expect(topWing.alpha).toBeGreaterThan(0);
    expect(bottomWing.alpha).toBeGreaterThan(0);
    expect(topWing.height).toBe(bottomWing.height);
    expect(outside.alpha).toBe(0);
  });
});
