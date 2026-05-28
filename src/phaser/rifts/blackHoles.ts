import { ASTEROIDS } from '../asteroids/config';
import { circlesOverlap } from '../core/collision';
import { PLAYER_COLLISION_RADIUS } from '../player/config';
import {
  applyBlackHoleGravityToVelocity,
  BLACK_HOLE_ABSORBED_FUEL_BLOBS,
  BLACK_HOLE_COLLAPSE_DURATION_MS,
  BLACK_HOLE_FUEL_BLOB_MASS_SCALE,
  BLACK_HOLE_FUEL_GRAVITY_RANGE_MULTIPLIER,
  BLACK_HOLE_FUEL_GRAVITY_STRENGTH_MULTIPLIER,
  getBlackHoleMass,
  getBlackHoleRenderRadius,
  getMatureBlackHoleRadius,
  isMatureBlackHole,
} from '../projectiles/blackHoles';
import type { ProjectileEntity } from '../projectiles/types';
import type { RiftSourceAsteroid, RiftSourceSpace } from './types';

export type RiftBlackHoleEvent =
  | {
      sourceAsteroid: RiftSourceAsteroid;
      type: 'asteroidAbsorbed';
    }
  | {
      projectile: ProjectileEntity;
      type: 'fuelBurst';
    }
  | {
      projectile: ProjectileEntity;
      type: 'playerAbsorbed';
    };

export function updateRiftBlackHoles(input: {
  sourceSpace: RiftSourceSpace;
  timeScale: number;
}): RiftBlackHoleEvent[] {
  const events: RiftBlackHoleEvent[] = [];
  mergeRiftBlackHoles(input.sourceSpace);
  applyRiftBlackHoleGravity(input.sourceSpace, input.timeScale);
  absorbRiftFuelBlobs(input.sourceSpace);
  absorbRiftPlayer(input.sourceSpace, events);
  updateRiftBlackHoleCollapse(input.sourceSpace, events);
  absorbRiftAsteroids(input.sourceSpace, events);
  return events;
}

function getActiveRiftBlackHoles(sourceSpace: RiftSourceSpace): ProjectileEntity[] {
  return sourceSpace.projectiles.filter(
    (projectile) => projectile.kind === 'blackHole' && projectile.collapseStartedAt === null,
  );
}

function mergeRiftBlackHoles(sourceSpace: RiftSourceSpace): void {
  const removed = new Set<ProjectileEntity>();
  const activeBlackHoles = getActiveRiftBlackHoles(sourceSpace);
  for (let leftIndex = 0; leftIndex < activeBlackHoles.length; leftIndex += 1) {
    const left = activeBlackHoles[leftIndex];
    if (!removed.has(left)) {
      for (let rightIndex = leftIndex + 1; rightIndex < activeBlackHoles.length; rightIndex += 1) {
        const right = activeBlackHoles[rightIndex];
        if (!removed.has(right) && riftBlackHolesOverlap(left, right)) {
          const { survivor, absorbed } = chooseRiftMergeSurvivor(left, right);
          mergeRiftBlackHoleInto(survivor, absorbed);
          removed.add(absorbed);
          removeRiftProjectile(sourceSpace, absorbed);
          if (absorbed === left) break;
        }
      }
    }
  }
}

function riftBlackHolesOverlap(left: ProjectileEntity, right: ProjectileEntity): boolean {
  const distance = Math.hypot(
    left.position.x - right.position.x,
    left.position.y - right.position.y,
  );
  return circlesOverlap(distance, getBlackHoleRenderRadius(left), getBlackHoleRenderRadius(right));
}

function chooseRiftMergeSurvivor(
  left: ProjectileEntity,
  right: ProjectileEntity,
): { absorbed: ProjectileEntity; survivor: ProjectileEntity } {
  const leftRadius = getBlackHoleRenderRadius(left);
  const rightRadius = getBlackHoleRenderRadius(right);
  if (leftRadius > rightRadius) return { survivor: left, absorbed: right };
  if (rightRadius > leftRadius) return { survivor: right, absorbed: left };

  const leftMass = getBlackHoleMass(left);
  const rightMass = getBlackHoleMass(right);
  if (leftMass > rightMass) return { survivor: left, absorbed: right };
  if (rightMass > leftMass) return { survivor: right, absorbed: left };
  return left.createdAt <= right.createdAt
    ? { survivor: left, absorbed: right }
    : { survivor: right, absorbed: left };
}

function mergeRiftBlackHoleInto(survivor: ProjectileEntity, absorbed: ProjectileEntity): void {
  const survivorMass = getBlackHoleMass(survivor);
  const absorbedMass = getBlackHoleMass(absorbed);
  const totalMass = survivorMass + absorbedMass;
  const remainingLifetime =
    Math.max(0, survivor.lifetimeMs - survivor.ageMs) +
    Math.max(0, absorbed.lifetimeMs - absorbed.ageMs);
  survivor.blackHoleMass = totalMass;
  survivor.absorbedFuel += absorbed.absorbedFuel;
  survivor.velocity = {
    x: (survivor.velocity.x * survivorMass + absorbed.velocity.x * absorbedMass) / totalMass,
    y: (survivor.velocity.y * survivorMass + absorbed.velocity.y * absorbedMass) / totalMass,
  };
  survivor.lifetimeMs = survivor.ageMs + remainingLifetime;
}

function applyRiftBlackHoleGravity(sourceSpace: RiftSourceSpace, timeScale: number): void {
  const activeBlackHoles = getActiveRiftBlackHoles(sourceSpace).filter((projectile) =>
    isMatureBlackHole(projectile),
  );
  for (const blackHole of activeBlackHoles) {
    const radius = getMatureBlackHoleRadius(blackHole);
    const gravityRange = radius * 6;
    for (const sourceAsteroid of sourceSpace.asteroids) {
      applyBlackHoleGravityToVelocity(
        sourceAsteroid.asteroid.velocity,
        sourceAsteroid.sourcePosition,
        blackHole.position,
        gravityRange,
        radius,
        getRiftDelta,
        timeScale,
      );
    }
    for (const targetBlackHole of getActiveRiftBlackHoles(sourceSpace)) {
      if (targetBlackHole !== blackHole) {
        applyBlackHoleGravityToVelocity(
          targetBlackHole.velocity,
          targetBlackHole.position,
          blackHole.position,
          gravityRange,
          radius,
          getRiftDelta,
          timeScale,
        );
      }
    }
    for (const blob of sourceSpace.fuelBlobs) {
      applyBlackHoleGravityToVelocity(
        blob.velocity,
        blob.position,
        blackHole.position,
        radius * BLACK_HOLE_FUEL_GRAVITY_RANGE_MULTIPLIER,
        radius,
        getRiftDelta,
        timeScale,
        BLACK_HOLE_FUEL_GRAVITY_STRENGTH_MULTIPLIER,
      );
    }
    if (sourceSpace.player) {
      applyBlackHoleGravityToVelocity(
        sourceSpace.player.velocity,
        sourceSpace.player.position,
        blackHole.position,
        gravityRange,
        radius,
        getRiftDelta,
        timeScale,
      );
    }
  }
}

function absorbRiftFuelBlobs(sourceSpace: RiftSourceSpace): void {
  for (const blackHole of getActiveRiftBlackHoles(sourceSpace)) {
    if (isMatureBlackHole(blackHole)) {
      const radius = getBlackHoleRenderRadius(blackHole);
      for (let index = sourceSpace.fuelBlobs.length - 1; index >= 0; index -= 1) {
        const blob = sourceSpace.fuelBlobs[index];
        const distance = Math.hypot(
          blackHole.position.x - blob.position.x,
          blackHole.position.y - blob.position.y,
        );
        if (distance <= radius) {
          blackHole.absorbedFuel += 1;
          blackHole.blackHoleMass = getBlackHoleMass(blackHole) + BLACK_HOLE_FUEL_BLOB_MASS_SCALE;
          sourceSpace.fuelBlobs.splice(index, 1);
        }
      }
    }
  }
}

function absorbRiftPlayer(sourceSpace: RiftSourceSpace, events: RiftBlackHoleEvent[]): void {
  if (!sourceSpace.player) return;

  for (const blackHole of getActiveRiftBlackHoles(sourceSpace)) {
    if (isMatureBlackHole(blackHole)) {
      const distance = Math.hypot(
        blackHole.position.x - sourceSpace.player.position.x,
        blackHole.position.y - sourceSpace.player.position.y,
      );
      if (circlesOverlap(distance, getBlackHoleRenderRadius(blackHole), PLAYER_COLLISION_RADIUS)) {
        events.push({ projectile: blackHole, type: 'playerAbsorbed' });
        return;
      }
    }
  }
}

function updateRiftBlackHoleCollapse(
  sourceSpace: RiftSourceSpace,
  events: RiftBlackHoleEvent[],
): void {
  for (const blackHole of [...sourceSpace.projectiles]) {
    if (blackHole.kind === 'blackHole') {
      if (blackHole.collapseStartedAt !== null) {
        if (blackHole.ageMs - blackHole.collapseStartedAt >= BLACK_HOLE_COLLAPSE_DURATION_MS) {
          events.push({ projectile: blackHole, type: 'fuelBurst' });
          removeRiftProjectile(sourceSpace, blackHole);
        }
      } else if (blackHole.ageMs >= blackHole.lifetimeMs) {
        blackHole.collapseStartedAt = blackHole.ageMs;
        blackHole.velocity = { x: 0, y: 0 };
      }
    }
  }
}

function absorbRiftAsteroids(sourceSpace: RiftSourceSpace, events: RiftBlackHoleEvent[]): void {
  for (const blackHole of getActiveRiftBlackHoles(sourceSpace)) {
    const radius = getBlackHoleRenderRadius(blackHole);
    for (let index = sourceSpace.asteroids.length - 1; index >= 0; index -= 1) {
      const sourceAsteroid = sourceSpace.asteroids[index];
      const distance = Math.hypot(
        blackHole.position.x - sourceAsteroid.sourcePosition.x,
        blackHole.position.y - sourceAsteroid.sourcePosition.y,
      );
      if (
        circlesOverlap(distance, radius, ASTEROIDS[sourceAsteroid.asteroid.tier].collisionRadius)
      ) {
        const absorbedFuel = BLACK_HOLE_ABSORBED_FUEL_BLOBS[sourceAsteroid.asteroid.tier];
        blackHole.absorbedFuel += absorbedFuel;
        blackHole.blackHoleMass =
          getBlackHoleMass(blackHole) + absorbedFuel * BLACK_HOLE_FUEL_BLOB_MASS_SCALE;
        events.push({ sourceAsteroid, type: 'asteroidAbsorbed' });
        sourceSpace.asteroids.splice(index, 1);
      }
    }
  }
}

function removeRiftProjectile(sourceSpace: RiftSourceSpace, projectile: ProjectileEntity): void {
  const index = sourceSpace.projectiles.indexOf(projectile);
  if (index >= 0) sourceSpace.projectiles.splice(index, 1);
}

function getRiftDelta(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  return { x: toX - fromX, y: toY - fromY };
}
