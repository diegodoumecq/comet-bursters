import { describe, expect, it } from 'vitest';

import { FUEL_GUN_BLOB_COLLECTION_ARM_MS } from '../fuel/rules';
import { ShipState } from '../player/shipState';
import { PlayerState } from '../player/state';
import { PLAYER_TURRET_MUZZLE_OFFSET } from '../player/textures';
import { SANDBOX_WEAPONS } from './scenePolicy';
import { getFuelBlobSpawnPosition, getProjectileSpawnPosition, updateWeapons } from './use';

describe('weapon projectile spawning', () => {
  it('spawns projectiles at the turret muzzle instead of the ship center', () => {
    const player = new PlayerState();
    const ship = new ShipState();
    player.updateAim({ x: 1, y: 0 });

    const result = updateWeapons({
      action: {
        firePrimary: true,
        fireSecondary: false,
        playerActive: true,
        timeDilation: false,
      },
      deltaSeconds: 1 / 60,
      inspectionProbes: 0,
      nextProjectileId: 10,
      now: 1000,
      origin: { x: 100, y: 200 },
      player,
      policy: { allowedWeapons: SANDBOX_WEAPONS },
      selectedWeapon: 'small',
      ship,
      shooterVelocity: { x: 0, y: 0 },
    });

    expect(result.projectiles).toHaveLength(1);
    expect(result.projectiles[0].position).toEqual({
      x: 100 + PLAYER_TURRET_MUZZLE_OFFSET,
      y: 200,
    });
  });

  it('normalizes aim before applying the muzzle offset', () => {
    expect(getProjectileSpawnPosition({ x: 10, y: 20 }, { x: 3, y: 4 })).toEqual({
      x: 10 + PLAYER_TURRET_MUZZLE_OFFSET * 0.6,
      y: 20 + PLAYER_TURRET_MUZZLE_OFFSET * 0.8,
    });
  });

  it('spawns armed fuel blobs for the fuel gun instead of projectiles', () => {
    const player = new PlayerState();
    const ship = new ShipState();
    player.updateAim({ x: 1, y: 0 });
    ship.assignWeapon('primary', 'fuelGun');

    const result = updateWeapons({
      action: {
        firePrimary: true,
        fireSecondary: false,
        playerActive: true,
        timeDilation: false,
      },
      deltaSeconds: 1 / 60,
      inspectionProbes: 0,
      nextProjectileId: 10,
      now: 1000,
      origin: { x: 100, y: 200 },
      player,
      policy: { allowedWeapons: SANDBOX_WEAPONS },
      selectedWeapon: 'fuelGun',
      ship,
      shooterVelocity: { x: 0, y: 0 },
    });

    expect(result.projectiles).toHaveLength(0);
    expect(result.fuelBlobs).toHaveLength(1);
    expect(result.fuelBlobs[0].position).toEqual(
      getFuelBlobSpawnPosition({ x: 100, y: 200 }, { x: 1, y: 0 }),
    );
    expect(result.fuelBlobs[0].collectableAtMs).toBe(1000 + FUEL_GUN_BLOB_COLLECTION_ARM_MS);
  });
});
