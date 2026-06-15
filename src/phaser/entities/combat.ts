import type { EntityBodies } from './bodies';
import { ENTITIES } from './config';
import type { GameEntity } from './types';
import type { ProjectileEntity } from '../projectiles/types';

export function applyProjectileGameEntityImpulse(
  projectile: ProjectileEntity,
  entity: GameEntity,
  runtime: EntityBodies,
): void {
  const entityVelocity = entity.velocity;
  const config = ENTITIES[entity.kind];
  const projectileSpeed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (projectileSpeed === 0) return;
  const normalX = projectile.velocity.x / projectileSpeed;
  const normalY = projectile.velocity.y / projectileSpeed;
  const impulse = projectile.impact * 1.5 * (1 / config.mass);
  entityVelocity.x += normalX * impulse;
  entityVelocity.y += normalY * impulse;
  entity.velocity = entityVelocity;
  runtime.get(entity).setVelocity(entityVelocity.x, entityVelocity.y);
}

export function damageGameEntity(projectile: ProjectileEntity, entity: GameEntity): boolean {
  return damageGameEntityByAmount(entity, projectile.damage);
}

export function damageGameEntityByAmount(entity: GameEntity, damage: number): boolean {
  entity.hits = (entity.hits ?? 1) - damage;
  return (entity.hits ?? 0) <= 0;
}

export type ProjectileGameEntityCombatEvent =
  | { projectile: ProjectileEntity; entity: GameEntity; type: 'projectileHitEntity' }
  | { projectile: ProjectileEntity; entity: GameEntity; type: 'entityDestroyed' };

export function resolveProjectileGameEntityContactCombat(
  contacts: Array<{ projectile: ProjectileEntity; entity: GameEntity }>,
  runtime: EntityBodies,
): ProjectileGameEntityCombatEvent[] {
  const events: ProjectileGameEntityCombatEvent[] = [];
  const destroyed = new Set<GameEntity>();
  const handledProjectiles = new Set<ProjectileEntity>();
  for (const { projectile, entity } of contacts) {
    if (
      projectile.kind !== 'blackHole' &&
      projectile.kind !== 'inspectionProbe' &&
      !destroyed.has(entity) &&
      !handledProjectiles.has(projectile)
    ) {
      handledProjectiles.add(projectile);
      applyProjectileGameEntityImpulse(projectile, entity, runtime);
      events.push({ projectile, entity, type: 'projectileHitEntity' });
      if (damageGameEntity(projectile, entity)) {
        destroyed.add(entity);
        events.push({ projectile, entity, type: 'entityDestroyed' });
      }
    }
  }
  return events;
}
