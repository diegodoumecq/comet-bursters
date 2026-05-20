import { describe, expect, it } from 'vitest';

import { PlayerState } from '../player/state';
import { ShipState } from '../player/shipState';
import { PLAYER_TURRET_MUZZLE_OFFSET } from '../player/textures';
import { SANDBOX_WEAPONS } from './scenePolicy';
import { getProjectileSpawnPosition, updateWeapons } from './use';

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
});
