import type { Vector } from '../core/types';
import { consumeTractorFuel } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import type { ShipState } from '../player/shipState';
import type { PlayerState } from '../player/state';
import type { ProjectileEntity } from '../projectiles/types';
import { fireWeapon } from './fire';
import { allowsWeapon, type SceneWeaponPolicy } from './scenePolicy';
import type { WeaponKind } from './types';

export type WeaponActionInput = {
  firePrimary: boolean;
  fireSecondary: boolean;
  playerActive: boolean;
  timeDilation: boolean;
};

export type WeaponUseResult = {
  fuelBlobs: FuelBlobEntity[];
  fuel: number;
  nextProjectileId: number;
  primaryWeapon: WeaponKind;
  projectiles: ProjectileEntity[];
  recoil: Vector;
  secondaryWeapon: WeaponKind;
  inspectionProbes: number;
  tractorActive: boolean;
};

export function updateWeapons(input: {
  action: WeaponActionInput;
  deltaSeconds: number;
  nextProjectileId: number;
  now: number;
  origin: Vector;
  player: PlayerState;
  policy: SceneWeaponPolicy;
  selectedWeapon: WeaponKind;
  ship: ShipState;
  shooterVelocity: Vector;
  inspectionProbes?: number;
}): WeaponUseResult {
  if (input.action.timeDilation) {
    return assignSelectedWeapon(input);
  }

  const primary =
    input.action.playerActive && input.action.firePrimary
      ? fireSelectedWeapon(
          input,
          input.player.lastAim,
          input.ship.primaryWeapon,
          input.nextProjectileId,
          input.inspectionProbes ?? 0,
        )
      : noWeaponFire(input.nextProjectileId, input.inspectionProbes ?? 0);
  const secondary =
    input.action.playerActive && input.action.fireSecondary
      ? fireSelectedWeapon(
          input,
          getShipDirection(input.player.rotation),
          input.ship.secondaryWeapon,
          primary.nextProjectileId,
          primary.inspectionProbes,
        )
      : noWeaponFire(primary.nextProjectileId, primary.inspectionProbes);
  const tractorActive = isTractorActive(input.policy, input.ship, input.action);
  const fuelAfterTractor = consumeTractorFuel(input.ship.fuel, input.deltaSeconds, tractorActive);

  return {
    fuel: fuelAfterTractor,
    fuelBlobs: [...primary.fuelBlobs, ...secondary.fuelBlobs],
    nextProjectileId: secondary.nextProjectileId,
    primaryWeapon: input.ship.primaryWeapon,
    projectiles: [...primary.projectiles, ...secondary.projectiles],
    recoil: {
      x: primary.recoil.x + secondary.recoil.x,
      y: primary.recoil.y + secondary.recoil.y,
    },
    secondaryWeapon: input.ship.secondaryWeapon,
    inspectionProbes: secondary.inspectionProbes,
    tractorActive,
  };
}

function assignSelectedWeapon(input: Parameters<typeof updateWeapons>[0]): WeaponUseResult {
  const primaryWeapon = input.action.firePrimary ? input.selectedWeapon : input.ship.primaryWeapon;
  const secondaryWeapon = input.action.fireSecondary
    ? input.selectedWeapon
    : input.ship.secondaryWeapon;
  return {
    fuel: input.ship.fuel,
    fuelBlobs: [],
    nextProjectileId: input.nextProjectileId,
    primaryWeapon,
    projectiles: [],
    recoil: { x: 0, y: 0 },
    secondaryWeapon,
    inspectionProbes: input.inspectionProbes ?? 0,
    tractorActive: false,
  };
}

function fireSelectedWeapon(
  input: Parameters<typeof updateWeapons>[0],
  direction: Vector,
  weapon: WeaponKind,
  nextProjectileId: number,
  inspectionProbes: number,
): {
  fuel?: number;
  fuelBlobs: FuelBlobEntity[];
  nextProjectileId: number;
  projectiles: ProjectileEntity[];
  recoil: Vector;
  inspectionProbes: number;
} {
  if (!allowsWeapon(input.policy, weapon)) return noWeaponFire(nextProjectileId, inspectionProbes);
  if (weapon === 'inspectionProbe' && inspectionProbes <= 0)
    return noWeaponFire(nextProjectileId, inspectionProbes);
  const result = fireWeapon({
    direction,
    fuel: input.ship.fuel,
    kind: weapon,
    lastShotAt: input.player.lastShotAt,
    nextProjectileId,
    now: input.now,
    origin: input.origin,
    shooterVelocity: input.shooterVelocity,
  });
  input.player.lastShotAt = result.lastShotAt;
  input.ship.setFuel(result.fuel);
  return {
    fuelBlobs: result.fuelBlobs,
    fuel: result.fuel,
    nextProjectileId: result.nextProjectileId,
    projectiles: result.projectiles,
    recoil: result.recoil,
    inspectionProbes:
      weapon === 'inspectionProbe' ? inspectionProbes - result.projectiles.length : inspectionProbes,
  };
}

export function isTractorActive(
  policy: SceneWeaponPolicy,
  ship: ShipState,
  action: WeaponActionInput,
): boolean {
  return (
    allowsWeapon(policy, 'tractor') &&
    !action.timeDilation &&
    action.playerActive &&
    ((ship.primaryWeapon === 'tractor' && action.firePrimary) ||
      (ship.secondaryWeapon === 'tractor' && action.fireSecondary))
  );
}

function noWeaponFire(nextProjectileId: number, inspectionProbes: number) {
  return {
    fuelBlobs: [],
    nextProjectileId,
    projectiles: [],
    recoil: { x: 0, y: 0 },
    inspectionProbes,
  };
}

function getShipDirection(rotation: number): Vector {
  return {
    x: Math.cos(rotation),
    y: Math.sin(rotation),
  };
}
