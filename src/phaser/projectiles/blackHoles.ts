import type { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS } from '../asteroids/logic';
import type { AsteroidEntity } from '../asteroids/types';
import { circleContains, circlesOverlap } from '../core/collision';
import type { MatterImage, Vector } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { PlanetEntity } from '../planets/types';
import { PLAYER_COLLISION_RADIUS } from '../player/config';
import type { ProjectileBodies } from './bodies';
import type { ProjectileEntity } from './types';

export const BLACK_HOLE_RADIUS = 6;
export const BLACK_HOLE_MATURE_AFTER_MS = 3000;
export const BLACK_HOLE_MATURE_RADIUS = 25;
export const BLACK_HOLE_GRAVITY_STRENGTH = 1.5;
export const BLACK_HOLE_GROWTH_DURATION_MS = 1000;
export const BLACK_HOLE_COLLAPSE_DURATION_MS = 700;
export const DISTORTION_RADIUS = 200;
export const DISTORTION_STRENGTH = 0.8;
export const MAX_BLACK_HOLES = 10;
export const BLACK_HOLE_ASTEROID_MASS_SCALE = 0.25;

const BLACK_HOLE_ABSORBED_FUEL_BLOBS: Record<AsteroidEntity['tier'], number> = {
  small: 1,
  medium: 2,
  big: 4,
  mega: 8,
};

export type BlackHoleLifecycleOptions = {
  asteroids: AsteroidEntity[];
  asteroidBodies: AsteroidBodies;
  distance: (fromX: number, fromY: number, toX: number, toY: number) => number;
  fuelBlobs?: FuelBlobEntity[];
  getDelta: (fromX: number, fromY: number, toX: number, toY: number) => { x: number; y: number };
  now: number;
  onAsteroidAbsorbed: (asteroid: AsteroidEntity) => void;
  onAsteroidRemoved: (asteroid: AsteroidEntity) => void;
  onBlackHoleRemoved: (blackHole: ProjectileEntity) => void;
  onFuelBurst: (blackHole: ProjectileEntity) => void;
  onFuelBlobAbsorbed: (blob: FuelBlobEntity) => void;
  onPlayerAbsorbed?: (blackHole: ProjectileEntity) => void;
  planets?: PlanetEntity[];
  player?: {
    active: boolean;
    body: MatterImage;
    position: Vector;
    velocity: Vector;
  };
  projectileBodies: ProjectileBodies;
  projectiles: ProjectileEntity[];
  timeScale?: number;
};

export function isMatureBlackHole(blackHole: ProjectileEntity, now = blackHole.ageMs): boolean {
  return now >= BLACK_HOLE_MATURE_AFTER_MS;
}

export function getMatureBlackHoleRadius(
  blackHole: ProjectileEntity,
  now = blackHole.ageMs,
): number {
  const targetRadius = BLACK_HOLE_MATURE_RADIUS * Math.sqrt(getBlackHoleMass(blackHole));
  const growthProgress = Math.min(
    1,
    Math.max(0, (now - BLACK_HOLE_MATURE_AFTER_MS) / BLACK_HOLE_GROWTH_DURATION_MS),
  );
  return BLACK_HOLE_RADIUS + (targetRadius - BLACK_HOLE_RADIUS) * growthProgress;
}

export function getBlackHoleRenderRadius(
  blackHole: ProjectileEntity,
  now = blackHole.ageMs,
): number {
  const matureRadius = getMatureBlackHoleRadius(blackHole, now);
  if (blackHole.collapseStartedAt === null) return matureRadius;

  const collapseProgress = Math.min(
    1,
    Math.max(0, (now - blackHole.collapseStartedAt) / BLACK_HOLE_COLLAPSE_DURATION_MS),
  );
  return matureRadius * (1 - collapseProgress);
}

export function updateBlackHoles(input: BlackHoleLifecycleOptions): void {
  removeBlackHolesCollidingWithPlanets(input);
  mergeBlackHoles(input);
  applyBlackHoleGravity(input);
  absorbFuelBlobs(input);
  absorbPlayer(input);
  updateBlackHoleCollapse(input);
  absorbAsteroids(input);
}

function getBlackHoleMass(blackHole: ProjectileEntity): number {
  return blackHole.blackHoleMass ?? 1;
}

function getActiveBlackHoles(projectiles: ProjectileEntity[]): ProjectileEntity[] {
  return projectiles.filter(
    (projectile) => projectile.kind === 'blackHole' && projectile.collapseStartedAt === null,
  );
}

function removeBlackHolesCollidingWithPlanets(input: BlackHoleLifecycleOptions): void {
  const planets = input.planets ?? [];
  if (planets.length === 0) return;

  for (const projectile of [...input.projectiles]) {
    if (projectile.kind === 'blackHole') {
      const hitPlanet = planets.some(
        (planet) =>
          input.distance(
            projectile.position.x,
            projectile.position.y,
            planet.position.x,
            planet.position.y,
          ) <=
          planet.radius + BLACK_HOLE_RADIUS,
      );
      if (hitPlanet) input.onBlackHoleRemoved(projectile);
    }
  }
}

function applyBlackHoleGravity(input: BlackHoleLifecycleOptions): void {
  const activeBlackHoles = getActiveBlackHoles(input.projectiles).filter((projectile) =>
    isMatureBlackHole(projectile),
  );
  if (activeBlackHoles.length === 0) return;

  const timeScale = input.timeScale ?? 1;
  for (const blackHole of activeBlackHoles) {
    const radius = getMatureBlackHoleRadius(blackHole);
    const gravityRange = radius * 6;
    for (const asteroid of input.asteroids) {
      if (applyBlackHoleGravityToVelocity(
        asteroid.velocity,
        asteroid.position,
        blackHole.position,
        gravityRange,
        radius,
        input.getDelta,
        timeScale,
      )) {
        input.asteroidBodies.get(asteroid).setVelocity(asteroid.velocity.x, asteroid.velocity.y);
      }
    }
    if (input.player?.active) {
      applyBlackHoleGravityToVelocity(
        input.player.velocity,
        input.player.position,
        blackHole.position,
        gravityRange,
        radius,
        input.getDelta,
        timeScale,
      );
      input.player.body.setVelocity(input.player.velocity.x, input.player.velocity.y);
    }
    for (const blob of input.fuelBlobs ?? []) {
      applyBlackHoleGravityToVelocity(
        blob.velocity,
        blob.position,
        blackHole.position,
        gravityRange,
        radius,
        input.getDelta,
        timeScale,
      );
    }
  }
}

function mergeBlackHoles(input: BlackHoleLifecycleOptions): void {
  const removed = new Set<ProjectileEntity>();
  const activeBlackHoles = getActiveBlackHoles(input.projectiles);
  for (let leftIndex = 0; leftIndex < activeBlackHoles.length; leftIndex += 1) {
    const left = activeBlackHoles[leftIndex];
    if (!removed.has(left)) {
      for (let rightIndex = leftIndex + 1; rightIndex < activeBlackHoles.length; rightIndex += 1) {
        const right = activeBlackHoles[rightIndex];
        if (!removed.has(right) && blackHolesOverlap(left, right, input.distance)) {
          const { survivor, absorbed } = chooseMergeSurvivor(left, right);
          mergeBlackHoleInto(survivor, absorbed);
          removed.add(absorbed);
          input.onBlackHoleRemoved(absorbed);
          if (absorbed === left) break;
        }
      }
    }
  }
}

function blackHolesOverlap(
  left: ProjectileEntity,
  right: ProjectileEntity,
  distance: BlackHoleLifecycleOptions['distance'],
): boolean {
  return circlesOverlap(
    distance(left.position.x, left.position.y, right.position.x, right.position.y),
    getBlackHoleRenderRadius(left),
    getBlackHoleRenderRadius(right),
  );
}

function chooseMergeSurvivor(
  left: ProjectileEntity,
  right: ProjectileEntity,
): { absorbed: ProjectileEntity; survivor: ProjectileEntity } {
  const leftMass = getBlackHoleMass(left);
  const rightMass = getBlackHoleMass(right);
  if (leftMass > rightMass) return { survivor: left, absorbed: right };
  if (rightMass > leftMass) return { survivor: right, absorbed: left };
  return left.createdAt <= right.createdAt
    ? { survivor: left, absorbed: right }
    : { survivor: right, absorbed: left };
}

function mergeBlackHoleInto(survivor: ProjectileEntity, absorbed: ProjectileEntity): void {
  const survivorMass = getBlackHoleMass(survivor);
  const absorbedMass = getBlackHoleMass(absorbed);
  const totalMass = survivorMass + absorbedMass;
  survivor.blackHoleMass = totalMass;
  survivor.absorbedFuel += absorbed.absorbedFuel;
  survivor.velocity = {
    x: (survivor.velocity.x * survivorMass + absorbed.velocity.x * absorbedMass) / totalMass,
    y: (survivor.velocity.y * survivorMass + absorbed.velocity.y * absorbedMass) / totalMass,
  };
  survivor.lifetimeMs = Math.max(survivor.lifetimeMs, absorbed.lifetimeMs);
  survivor.ageMs = Math.min(survivor.ageMs, absorbed.ageMs);
}

function applyBlackHoleGravityToVelocity(
  velocity: Vector,
  position: Vector,
  blackHolePosition: Vector,
  gravityRange: number,
  radius: number,
  getDelta: BlackHoleLifecycleOptions['getDelta'],
  timeScale: number,
): boolean {
  const delta = getDelta(position.x, position.y, blackHolePosition.x, blackHolePosition.y);
  const distSq = delta.x * delta.x + delta.y * delta.y;
  const dist = Math.sqrt(distSq);
  if (dist > 0 && dist < gravityRange) {
    const force = (BLACK_HOLE_GRAVITY_STRENGTH * 0.5 * radius * radius) / distSq;
    velocity.x += (delta.x / dist) * force * timeScale;
    velocity.y += (delta.y / dist) * force * timeScale;
    return true;
  }
  return false;
}

function updateBlackHoleCollapse(input: BlackHoleLifecycleOptions): void {
  for (const projectile of [...input.projectiles]) {
    if (projectile.kind === 'blackHole') {
      const shape = input.projectileBodies.get(projectile);
      const renderRadius = getBlackHoleRenderRadius(projectile);
      shape.setRadius(Math.max(0, renderRadius));

      if (projectile.collapseStartedAt !== null) {
        if (projectile.ageMs - projectile.collapseStartedAt >= BLACK_HOLE_COLLAPSE_DURATION_MS) {
          input.onFuelBurst(projectile);
          input.onBlackHoleRemoved(projectile);
        }
      } else if (projectile.ageMs >= projectile.lifetimeMs) {
        projectile.collapseStartedAt = projectile.ageMs;
        projectile.velocity.x = 0;
        projectile.velocity.y = 0;
        shape.setVelocity(0, 0);
      }
    }
  }
}

function absorbFuelBlobs(input: BlackHoleLifecycleOptions): void {
  const fuelBlobs = input.fuelBlobs ?? [];
  if (fuelBlobs.length === 0) return;

  for (const projectile of [...input.projectiles]) {
    if (
      projectile.kind === 'blackHole' &&
      projectile.collapseStartedAt === null &&
      isMatureBlackHole(projectile)
    ) {
      const radius = getBlackHoleRenderRadius(projectile);
      for (const blob of [...fuelBlobs]) {
        const hitDistance = input.distance(
          projectile.position.x,
          projectile.position.y,
          blob.position.x,
          blob.position.y,
        );
        if (circleContains(hitDistance, radius)) {
          projectile.absorbedFuel += 1;
          input.onFuelBlobAbsorbed(blob);
        }
      }
    }
  }
}

function absorbPlayer(input: BlackHoleLifecycleOptions): void {
  if (!input.player?.active || !input.onPlayerAbsorbed) return;

  for (const projectile of [...input.projectiles]) {
    if (
      projectile.kind === 'blackHole' &&
      projectile.collapseStartedAt === null &&
      isMatureBlackHole(projectile)
    ) {
      const hitDistance = input.distance(
        projectile.position.x,
        projectile.position.y,
        input.player.position.x,
        input.player.position.y,
      );
      if (
        circlesOverlap(hitDistance, getBlackHoleRenderRadius(projectile), PLAYER_COLLISION_RADIUS)
      ) {
        input.onPlayerAbsorbed(projectile);
        return;
      }
    }
  }
}

function absorbAsteroids(input: BlackHoleLifecycleOptions): void {
  for (const projectile of [...input.projectiles]) {
    if (projectile.kind === 'blackHole' && projectile.collapseStartedAt === null) {
      for (const asteroid of [...input.asteroids]) {
        const hitDistance = input.distance(
          projectile.position.x,
          projectile.position.y,
          asteroid.position.x,
          asteroid.position.y,
        );
        if (
          circlesOverlap(
            hitDistance,
            getBlackHoleRenderRadius(projectile),
            ASTEROIDS[asteroid.tier].collisionRadius,
          )
        ) {
          projectile.absorbedFuel += BLACK_HOLE_ABSORBED_FUEL_BLOBS[asteroid.tier];
          projectile.blackHoleMass =
            getBlackHoleMass(projectile) +
            ASTEROIDS[asteroid.tier].mass * BLACK_HOLE_ASTEROID_MASS_SCALE;
          input.onAsteroidAbsorbed(asteroid);
          input.onAsteroidRemoved(asteroid);
        }
      }
    }
  }
}
