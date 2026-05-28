import { ASTEROIDS } from '../asteroids/logic';
import { damageAsteroid } from '../combat/asteroids';
import { circlesOverlap } from '../core/collision';
import type { ProjectileEntity } from '../projectiles/types';
import { PROJECTILES } from '../weapons/config';
import { getRiftNormal, getRiftTangent } from './geometry';
import type { RiftProjection } from './types';

export type RiftProjectileCombatEvent =
  | { projection: RiftProjection; projectile: ProjectileEntity; type: 'projectileHitAsteroid' }
  | { projection: RiftProjection; projectile: ProjectileEntity; type: 'asteroidDestroyed' };

export function resolveRiftProjectileCombat(input: {
  projectiles: ProjectileEntity[];
  projections: RiftProjection[];
}): RiftProjectileCombatEvent[] {
  const events: RiftProjectileCombatEvent[] = [];
  const destroyed = new Set<number>();
  const handledProjectiles = new Set<number>();
  for (const projectile of input.projectiles) {
    if (
      projectile.kind !== 'blackHole' &&
      projectile.kind !== 'inspectionProbe' &&
      !handledProjectiles.has(projectile.id)
    ) {
      const projection = findProjectileProjectionContact(projectile, input.projections, destroyed);
      if (projection) {
        handledProjectiles.add(projectile.id);
        applySourceSpaceImpulse(projectile, projection);
        events.push({ projection, projectile, type: 'projectileHitAsteroid' });
        if (damageAsteroid(projectile, projection.sourceAsteroid.asteroid)) {
          destroyed.add(projection.sourceAsteroid.asteroid.id);
          events.push({ projection, projectile, type: 'asteroidDestroyed' });
        }
      }
    }
  }
  return events;
}

function findProjectileProjectionContact(
  projectile: ProjectileEntity,
  projections: RiftProjection[],
  destroyed: Set<number>,
): RiftProjection | null {
  for (const projection of projections) {
    const asteroid = projection.sourceAsteroid.asteroid;
    if (!destroyed.has(asteroid.id)) {
      const distance = Math.hypot(
        projectile.position.x - projection.scenePosition.x,
        projectile.position.y - projection.scenePosition.y,
      );
      if (
        circlesOverlap(
          distance,
          PROJECTILES[projectile.kind].radius,
          ASTEROIDS[asteroid.tier].collisionRadius,
        )
      ) {
        return projection;
      }
    }
  }
  return null;
}

function applySourceSpaceImpulse(projectile: ProjectileEntity, projection: RiftProjection): void {
  const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (speed === 0) return;
  const normal = getRiftNormal(projection.portal);
  const tangent = getRiftTangent(projection.portal);
  const asteroid = projection.sourceAsteroid.asteroid;
  const config = ASTEROIDS[asteroid.tier];
  const impulse = PROJECTILES[projectile.kind].impact * 1.5 * (1 / config.mass);
  const unit = { x: projectile.velocity.x / speed, y: projectile.velocity.y / speed };
  asteroid.velocity.x += (unit.x * tangent.x + unit.y * tangent.y) * impulse;
  asteroid.velocity.y += (unit.x * normal.x + unit.y * normal.y) * impulse;
}
