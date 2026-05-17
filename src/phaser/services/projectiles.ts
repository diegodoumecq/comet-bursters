import type { ProjectileEntity, WorldSize } from '../model';
import { wrapPoint } from './world';

export function updateProjectiles(
  projectiles: ProjectileEntity[],
  deltaSeconds: number,
  world: WorldSize,
): ProjectileEntity[] {
  const expired: ProjectileEntity[] = [];
  for (const projectile of projectiles) {
    projectile.ageMs += deltaSeconds * 1000;
    const shouldExpire = projectile.ageMs >= projectile.lifetimeMs && projectile.kind !== 'blackHole';
    if (shouldExpire) {
      expired.push(projectile);
    } else {
      wrapPoint(projectile.shape, world);
    }
  }
  return expired;
}
