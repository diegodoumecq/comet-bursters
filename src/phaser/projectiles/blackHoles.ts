import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import { circleContains, circlesOverlap } from '../core/collision';
import type { Vector } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import type { PlanetEntity } from '../planets/types';
import { PLAYER_COLLISION_RADIUS } from '../player/config';
import type { ProjectileBodies } from './bodies';
import {
  BLACK_HOLE_ABSORBED_FUEL_BLOBS,
  BLACK_HOLE_COLLAPSE_DURATION_MS,
  BLACK_HOLE_FUEL_BLOB_MASS_SCALE,
  BLACK_HOLE_GROWTH_DURATION_MS,
  BLACK_HOLE_MATURE_AFTER_MS,
  BLACK_HOLE_MATURE_RADIUS,
  BLACK_HOLE_RADIUS,
  DISTORTION_RADIUS,
} from './definition';
import type { ProjectileEntity } from './types';

export type BlackHoleLifecycleOptions = {
  asteroids: AsteroidEntity[];
  collisionBlockers?: BlackHoleCollisionBlocker[];
  distance: (fromX: number, fromY: number, toX: number, toY: number) => number;
  fuelBlobs?: FuelBlobEntity[];
  now: number;
  onAsteroidAbsorbed: (asteroid: AsteroidEntity) => void;
  onAsteroidRemoved: (asteroid: AsteroidEntity) => void;
  onBlackHoleBlocked?: (event: BlackHoleBlockerImpactEvent) => void;
  onBlackHoleAbsorbedByPlanet?: (event: BlackHolePlanetAbsorptionEvent) => void;
  onBlackHoleRemoved: (blackHole: ProjectileEntity) => void;
  onFuelBurst: (blackHole: ProjectileEntity) => void;
  onFuelBlobAbsorbed: (blob: FuelBlobEntity) => void;
  onParticleAbsorbed?: (particle: ParticleEntity) => void;
  onPlayerAbsorbed?: (blackHole: ProjectileEntity) => void;
  onProjectileAbsorbed: (projectile: ProjectileEntity, blackHole: ProjectileEntity) => void;
  particles?: ParticleEntity[];
  planets?: PlanetEntity[];
  player?: {
    active: boolean;
    position: Vector;
    velocity: Vector;
  };
  projectileBodies: ProjectileBodies;
  projectiles: ProjectileEntity[];
};

export type BlackHoleCollisionBlocker = {
  position: Vector;
  radius: number;
};

export type BlackHoleBlockerImpactEvent = {
  blackHole: ProjectileEntity;
  blocker: BlackHoleCollisionBlocker;
  normal: Vector;
  position: Vector;
};

export type BlackHolePlanetAbsorptionEvent = {
  blackHole: ProjectileEntity;
  normal: Vector;
  planet: PlanetEntity;
  position: Vector;
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

export function getBlackHoleInfluenceRadius(radius: number): number {
  return Math.max(radius + 1, DISTORTION_RADIUS * (radius / BLACK_HOLE_RADIUS));
}

export function updateBlackHoles(input: BlackHoleLifecycleOptions): void {
  removeBlackHolesCollidingWithPlanets(input);
  removeBlackHolesCollidingWithBlockers(input);
  mergeBlackHoles(input);
  absorbFuelBlobs(input);
  absorbProjectiles(input);
  absorbParticles(input);
  absorbPlayer(input);
  updateBlackHoleCollapse(input);
  absorbAsteroids(input);
}

export function getBlackHoleMass(blackHole: ProjectileEntity): number {
  return blackHole.blackHoleMass ?? 1;
}

export function blackHoleOverlapsCollisionBlocker(
  blackHole: ProjectileEntity,
  blockers: BlackHoleCollisionBlocker[],
  distance: BlackHoleLifecycleOptions['distance'],
): boolean {
  return getBlackHoleBlockerImpact(blackHole, blockers, distance) !== null;
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
      const hit = getBlackHolePlanetAbsorption(projectile, planets, input.distance);
      if (hit) {
        input.onBlackHoleAbsorbedByPlanet?.(hit);
        input.onBlackHoleRemoved(projectile);
      }
    }
  }
}

function getBlackHolePlanetAbsorption(
  blackHole: ProjectileEntity,
  planets: PlanetEntity[],
  distance: BlackHoleLifecycleOptions['distance'],
): BlackHolePlanetAbsorptionEvent | null {
  for (const planet of planets) {
    const hitDistance = distance(
      blackHole.position.x,
      blackHole.position.y,
      planet.position.x,
      planet.position.y,
    );
    if (hitDistance <= planet.radius + BLACK_HOLE_RADIUS) {
      const normal = getPlanetSurfaceNormal(blackHole.position, planet.position);
      return {
        blackHole,
        normal,
        planet,
        position: {
          x: planet.position.x + normal.x * (planet.radius + 4),
          y: planet.position.y + normal.y * (planet.radius + 4),
        },
      };
    }
  }
  return null;
}

function getPlanetSurfaceNormal(position: Vector, planetPosition: Vector): Vector {
  const delta = {
    x: position.x - planetPosition.x,
    y: position.y - planetPosition.y,
  };
  const distance = Math.hypot(delta.x, delta.y);
  if (distance <= 0) return { x: 1, y: 0 };
  return { x: delta.x / distance, y: delta.y / distance };
}

function removeBlackHolesCollidingWithBlockers(input: BlackHoleLifecycleOptions): void {
  const blockers = input.collisionBlockers ?? [];
  if (blockers.length === 0) return;

  for (const projectile of [...input.projectiles]) {
    if (
      projectile.kind === 'blackHole' &&
      projectile.collapseStartedAt === null &&
      input.projectiles.includes(projectile)
    ) {
      const impact = getBlackHoleBlockerImpact(projectile, blockers, input.distance);
      if (impact) {
        input.onBlackHoleBlocked?.(impact);
        input.onBlackHoleRemoved(projectile);
      }
    }
  }
}

function getBlackHoleBlockerImpact(
  blackHole: ProjectileEntity,
  blockers: BlackHoleCollisionBlocker[],
  distance: BlackHoleLifecycleOptions['distance'],
): BlackHoleBlockerImpactEvent | null {
  for (const blocker of blockers) {
    if (
      circlesOverlap(
        distance(
          blackHole.position.x,
          blackHole.position.y,
          blocker.position.x,
          blocker.position.y,
        ),
        getBlackHoleRenderRadius(blackHole),
        blocker.radius,
      )
    ) {
      const normal = getPlanetSurfaceNormal(blackHole.position, blocker.position);
      return {
        blackHole,
        blocker,
        normal,
        position: {
          x: blocker.position.x + normal.x * (blocker.radius + 4),
          y: blocker.position.y + normal.y * (blocker.radius + 4),
        },
      };
    }
  }
  return null;
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

function mergeBlackHoleInto(survivor: ProjectileEntity, absorbed: ProjectileEntity): void {
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
          projectile.blackHoleMass = getBlackHoleMass(projectile) + BLACK_HOLE_FUEL_BLOB_MASS_SCALE;
          input.onFuelBlobAbsorbed(blob);
        }
      }
    }
  }
}

function absorbProjectiles(input: BlackHoleLifecycleOptions): void {
  const targets = input.projectiles.filter((projectile) => projectile.kind !== 'blackHole');
  if (targets.length === 0) return;

  for (const blackHole of [...input.projectiles]) {
    if (
      blackHole.kind === 'blackHole' &&
      blackHole.collapseStartedAt === null &&
      isMatureBlackHole(blackHole)
    ) {
      const radius = getBlackHoleRenderRadius(blackHole);
      for (const target of [...targets]) {
        if (input.projectiles.includes(target)) {
          const hitDistance = input.distance(
            blackHole.position.x,
            blackHole.position.y,
            target.position.x,
            target.position.y,
          );
          if (circlesOverlap(hitDistance, radius, target.radius)) {
            input.onProjectileAbsorbed(target, blackHole);
          }
        }
      }
    }
  }
}

function absorbParticles(input: BlackHoleLifecycleOptions): void {
  const particles = input.particles ?? [];
  if (particles.length === 0 || !input.onParticleAbsorbed) return;

  for (const projectile of [...input.projectiles]) {
    if (
      projectile.kind === 'blackHole' &&
      projectile.collapseStartedAt === null &&
      isMatureBlackHole(projectile)
    ) {
      const radius = getBlackHoleRenderRadius(projectile);
      for (const particle of [...particles]) {
        const hitDistance = input.distance(
          projectile.position.x,
          projectile.position.y,
          particle.position.x,
          particle.position.y,
        );
        if (circlesOverlap(hitDistance, radius, particle.radius ?? particle.size ?? 1)) {
          input.onParticleAbsorbed(particle);
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
            BLACK_HOLE_ABSORBED_FUEL_BLOBS[asteroid.tier] * BLACK_HOLE_FUEL_BLOB_MASS_SCALE;
          input.onAsteroidAbsorbed(asteroid);
          input.onAsteroidRemoved(asteroid);
        }
      }
    }
  }
}
