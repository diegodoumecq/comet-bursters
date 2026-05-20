import type { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS } from '../asteroids/logic';
import type { AsteroidEntity } from '../asteroids/types';
import type { PlanetEntity } from '../planets/types';
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
  getDelta: (fromX: number, fromY: number, toX: number, toY: number) => { x: number; y: number };
  now: number;
  onAsteroidAbsorbed: (asteroid: AsteroidEntity) => void;
  onAsteroidRemoved: (asteroid: AsteroidEntity) => void;
  onBlackHoleRemoved: (blackHole: ProjectileEntity) => void;
  onFuelBurst: (blackHole: ProjectileEntity) => void;
  planets?: PlanetEntity[];
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
  const growthProgress = Math.min(
    1,
    Math.max(0, (now - BLACK_HOLE_MATURE_AFTER_MS) / BLACK_HOLE_GROWTH_DURATION_MS),
  );
  return BLACK_HOLE_RADIUS + (BLACK_HOLE_MATURE_RADIUS - BLACK_HOLE_RADIUS) * growthProgress;
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
  applyBlackHoleGravity(input);
  updateBlackHoleCollapse(input);
  absorbAsteroids(input);
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
  const activeBlackHoles = input.projectiles.filter(
    (projectile) =>
      projectile.kind === 'blackHole' &&
      projectile.collapseStartedAt === null &&
      isMatureBlackHole(projectile),
  );
  if (activeBlackHoles.length === 0) return;

  const timeScale = input.timeScale ?? 1;
  for (const blackHole of activeBlackHoles) {
    const radius = getMatureBlackHoleRadius(blackHole);
    const gravityRange = radius * 6;
    for (const asteroid of input.asteroids) {
      const delta = input.getDelta(
        asteroid.position.x,
        asteroid.position.y,
        blackHole.position.x,
        blackHole.position.y,
      );
      const distSq = delta.x * delta.x + delta.y * delta.y;
      const dist = Math.sqrt(distSq);
      if (dist > 0 && dist < gravityRange) {
        const force = (BLACK_HOLE_GRAVITY_STRENGTH * 0.5 * radius * radius) / distSq;
        asteroid.velocity.x += (delta.x / dist) * force * timeScale;
        asteroid.velocity.y += (delta.y / dist) * force * timeScale;
        input.asteroidBodies.get(asteroid).setVelocity(asteroid.velocity.x, asteroid.velocity.y);
      }
    }
  }
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
          hitDistance <=
          getBlackHoleRenderRadius(projectile) + ASTEROIDS[asteroid.tier].collisionRadius
        ) {
          projectile.absorbedFuel += BLACK_HOLE_ABSORBED_FUEL_BLOBS[asteroid.tier];
          input.onAsteroidAbsorbed(asteroid);
          input.onAsteroidRemoved(asteroid);
        }
      }
    }
  }
}
