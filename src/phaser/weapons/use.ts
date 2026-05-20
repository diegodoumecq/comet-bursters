import type { Vector } from '../core/types';
import { consumeTractorFuel } from '../fuel/rules';
import { PLAYER_TURRET_MUZZLE_OFFSET } from '../player/textures';
import type { PlayerState } from '../player/state';
import type { ShipState } from '../player/shipState';
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

  const primary = input.action.playerActive && input.action.firePrimary
    ? fireSelectedWeapon(input, input.ship.primaryWeapon, input.nextProjectileId, input.inspectionProbes ?? 0)
    : noWeaponFire(input.nextProjectileId, input.inspectionProbes ?? 0);
  const secondary = input.action.playerActive && input.action.fireSecondary
    ? fireSelectedWeapon(input, input.ship.secondaryWeapon, primary.nextProjectileId, primary.inspectionProbes)
    : noWeaponFire(primary.nextProjectileId, primary.inspectionProbes);
  const tractorActive = isTractorActive(input.policy, input.ship, input.action);
  const fuelAfterTractor = consumeTractorFuel(input.ship.fuel, input.deltaSeconds, tractorActive);

  return {
    fuel: fuelAfterTractor,
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
  const secondaryWeapon = input.action.fireSecondary ? input.selectedWeapon : input.ship.secondaryWeapon;
  return {
    fuel: input.ship.fuel,
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
  weapon: WeaponKind,
  nextProjectileId: number,
  inspectionProbes: number,
): {
  fuel?: number;
  nextProjectileId: number;
  projectiles: ProjectileEntity[];
  recoil: Vector;
  inspectionProbes: number;
} {
  if (!allowsWeapon(input.policy, weapon)) return noWeaponFire(nextProjectileId, inspectionProbes);
  if (weapon === 'inspectionProbe' && inspectionProbes <= 0) return noWeaponFire(nextProjectileId, inspectionProbes);
  const result = fireWeapon(
    weapon,
    input.player.lastAim,
    input.now,
    input.ship.fuel,
    input.player.lastShotAt,
    input.shooterVelocity,
  );
  input.player.lastShotAt = result.lastShotAt;
  const projectileOrigin = getProjectileSpawnPosition(input.origin, input.player.lastAim);
  const projectiles = result.shots.map((shot, index) => ({
    absorbedFuel: 0,
    ageMs: 0,
    angle: shot.angle,
    blackHoleMass: shot.kind === 'blackHole' ? 1 : undefined,
    collapseStartedAt: null,
    createdAt: input.now,
    id: nextProjectileId + index,
    kind: shot.kind,
    lifetimeMs: shot.lifetimeMs,
    position: { ...projectileOrigin },
    velocity: shot.velocity,
  }));
  input.ship.setFuel(result.fuel);
  return {
    fuel: result.fuel,
    nextProjectileId: nextProjectileId + projectiles.length,
    projectiles,
    recoil: result.recoil,
    inspectionProbes: weapon === 'inspectionProbe' ? inspectionProbes - projectiles.length : inspectionProbes,
  };
}

export function getProjectileSpawnPosition(origin: Vector, direction: Vector): Vector {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude <= 0) return { ...origin };
  return {
    x: origin.x + (direction.x / magnitude) * PLAYER_TURRET_MUZZLE_OFFSET,
    y: origin.y + (direction.y / magnitude) * PLAYER_TURRET_MUZZLE_OFFSET,
  };
}

export function isTractorActive(policy: SceneWeaponPolicy, ship: ShipState, action: WeaponActionInput): boolean {
  return allowsWeapon(policy, 'tractor') &&
    !action.timeDilation &&
    action.playerActive &&
    ((ship.primaryWeapon === 'tractor' && action.firePrimary) ||
      (ship.secondaryWeapon === 'tractor' && action.fireSecondary));
}

function noWeaponFire(nextProjectileId: number, inspectionProbes: number) {
  return { nextProjectileId, projectiles: [], recoil: { x: 0, y: 0 }, inspectionProbes };
}
