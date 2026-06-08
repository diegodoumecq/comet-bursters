import { describe, expect, it } from 'vitest';

import type { WeaponKind } from '../weapons/types';
import { getPlayerTurretTextureKey } from './textures';

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
});
