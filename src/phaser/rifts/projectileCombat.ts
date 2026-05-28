import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import { circlesOverlap } from '../core/collision';
import type { ProjectileEntity } from '../projectiles/types';
import { PROJECTILES } from '../weapons/config';
import type { RiftSourceAsteroid } from './types';

export type RiftProjectileCombatEvent =
  | {
      projectile: ProjectileEntity;
      sourceAsteroid: RiftSourceAsteroid;
      type: 'projectileHitAsteroid';
    }
  | {
      projectile: ProjectileEntity;
      sourceAsteroid: RiftSourceAsteroid;
      type: 'asteroidDestroyed';
    };

export function resolveRiftProjectileCombat(input: {
  projectiles: ProjectileEntity[];
  sourceAsteroids: RiftSourceAsteroid[];
}): RiftProjectileCombatEvent[] {
  const events: RiftProjectileCombatEvent[] = [];
  const destroyed = new Set<AsteroidEntity>();
  const handledProjectiles = new Set<ProjectileEntity>();
  for (const projectile of input.projectiles) {
    if (canProjectileHitRiftAsteroid(projectile) && !handledProjectiles.has(projectile)) {
      const sourceAsteroid = findHitSourceAsteroid(projectile, input.sourceAsteroids, destroyed);
      if (sourceAsteroid) {
        handledProjectiles.add(projectile);
        applyRiftProjectileImpulse(projectile, sourceAsteroid.asteroid);
        events.push({ projectile, sourceAsteroid, type: 'projectileHitAsteroid' });
        if (damageRiftAsteroid(projectile, sourceAsteroid.asteroid)) {
          destroyed.add(sourceAsteroid.asteroid);
          events.push({ projectile, sourceAsteroid, type: 'asteroidDestroyed' });
        }
      }
    }
  }
  return events;
}

function canProjectileHitRiftAsteroid(projectile: ProjectileEntity): boolean {
  return projectile.kind !== 'blackHole' && projectile.kind !== 'inspectionProbe';
}

function findHitSourceAsteroid(
  projectile: ProjectileEntity,
  sourceAsteroids: RiftSourceAsteroid[],
  destroyed: Set<AsteroidEntity>,
): RiftSourceAsteroid | null {
  const projectileRadius = PROJECTILES[projectile.kind].radius;
  return (
    sourceAsteroids.find((sourceAsteroid) => {
      const asteroid = sourceAsteroid.asteroid;
      const asteroidRadius = ASTEROIDS[asteroid.tier].collisionRadius;
      const distance = Math.hypot(
        projectile.position.x - sourceAsteroid.sourcePosition.x,
        projectile.position.y - sourceAsteroid.sourcePosition.y,
      );
      return !destroyed.has(asteroid) && circlesOverlap(distance, projectileRadius, asteroidRadius);
    }) ?? null
  );
}

function applyRiftProjectileImpulse(projectile: ProjectileEntity, asteroid: AsteroidEntity): void {
  const projectileSpeed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (projectileSpeed > 0) {
    const config = ASTEROIDS[asteroid.tier];
    const normalX = projectile.velocity.x / projectileSpeed;
    const normalY = projectile.velocity.y / projectileSpeed;
    const impulse = PROJECTILES[projectile.kind].impact * 1.5 * (1 / config.mass);
    asteroid.velocity = {
      x: asteroid.velocity.x + normalX * impulse,
      y: asteroid.velocity.y + normalY * impulse,
    };
  }
}

function damageRiftAsteroid(projectile: ProjectileEntity, asteroid: AsteroidEntity): boolean {
  asteroid.hits = (asteroid.hits ?? 1) - PROJECTILES[projectile.kind].damage;
  return (asteroid.hits ?? 0) <= 0;
}
