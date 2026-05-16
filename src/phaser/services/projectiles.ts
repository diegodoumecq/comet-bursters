import type { ProjectileEntity, WorldSize } from '../model';
import { wrapPoint } from './world';

export function updateProjectiles(
  projectiles: ProjectileEntity[],
  now: number,
  deltaSeconds: number,
  world: WorldSize,
): ProjectileEntity[] {
  const expired: ProjectileEntity[] = [];
  for (const projectile of projectiles) {
    const shouldExpire = now - projectile.createdAt >= projectile.lifetimeMs && projectile.kind !== 'blackHole';
    if (shouldExpire) {
      expired.push(projectile);
    } else {
      projectile.shape.setPosition(
        projectile.shape.x + projectile.velocity.x * deltaSeconds,
        projectile.shape.y + projectile.velocity.y * deltaSeconds,
      );
      wrapPoint(projectile.shape, world);
    }
  }
  return expired;
}
