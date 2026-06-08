import { describe, expect, it } from 'vitest';

import type { WeaponKind } from '../weapons/types';
import {
  getPlayerTurretTextureKey,
  PLAYER_TURRET_MUZZLE_OFFSET,
  PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
  PLAYER_TURRET_SPRITE_SPECS,
  PLAYER_TURRET_TEXTURE_SIZE,
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
});
