import { describe, expect, it } from 'vitest';

import { ShipState } from '../player/shipState';
import { PlayerState } from '../player/state';
import { WEAPON_FIRE_CONFIGS } from './config';
import { SANDBOX_WEAPONS } from './scenePolicy';
import { updateWeapons } from './use';

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
      x: 100 + getFirstEmission('small').spawnOffset,
      y: 200,
    });
  });

  it('normalizes aim before applying the muzzle offset', () => {
    const player = new PlayerState();
    const ship = new ShipState();
    player.updateAim({ x: 3, y: 4 });

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
      origin: { x: 10, y: 20 },
      player,
      policy: { allowedWeapons: SANDBOX_WEAPONS },
      selectedWeapon: 'small',
      ship,
      shooterVelocity: { x: 0, y: 0 },
    });

    expect(result.projectiles[0].position).toEqual({
      x: 10 + getFirstEmission('small').spawnOffset * 0.6,
      y: 20 + getFirstEmission('small').spawnOffset * 0.8,
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
    expect(result.fuelBlobs[0].position).toEqual({
      x: 100 + getFirstEmission('fuelGun').spawnOffset,
      y: 200,
    });
    expect(result.fuelBlobs[0].collectableAtMs).toBe(1000 + getFuelGunCollectableDelayMs());
  });

  it('fires secondary weapons along the ship heading instead of the turret aim', () => {
    const player = new PlayerState();
    const ship = new ShipState();
    player.updateAim({ x: 0, y: -1 });
    player.rotation = 0;
    ship.assignWeapon('secondary', 'pusher');

    const result = updateWeapons({
      action: {
        firePrimary: false,
        fireSecondary: true,
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
      x: 100 + getFirstEmission('pusher').spawnOffset,
      y: 200,
    });
    expect(result.projectiles[0].velocity.x).toBeGreaterThan(0);
    expect(result.projectiles[0].velocity.y).toBeCloseTo(0);
  });
});

function getFirstEmission(weapon: 'fuelGun' | 'pusher' | 'small') {
  return WEAPON_FIRE_CONFIGS[weapon].emissions[0];
}

function getFuelGunCollectableDelayMs(): number {
  const emission = getFirstEmission('fuelGun');
  if (emission.type !== 'fuelBlob' || emission.entity?.collectableDelayMs === undefined) {
    throw new Error('Expected fuel gun collectable delay config');
  }
  return emission.entity.collectableDelayMs;
}
