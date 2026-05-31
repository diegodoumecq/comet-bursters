import type { WorldSize } from '../core/types';
import { wrapPoint } from '../world/geometry';
import type { ProjectileBodies } from './bodies';
import type { ProjectileEntity } from './types';

export function updateProjectiles(
  projectiles: ProjectileEntity[],
  runtime: ProjectileBodies,
  deltaSeconds: number,
  world: WorldSize,
  wrap = true,
): ProjectileEntity[] {
  const expired: ProjectileEntity[] = [];
  for (const projectile of projectiles) {
    projectile.ageMs += deltaSeconds * 1000;
    const shouldExpire =
      projectile.ageMs >= projectile.lifetimeMs && projectile.kind !== 'blackHole';
    if (shouldExpire) {
      expired.push(projectile);
    } else {
      if (wrap) wrapPoint(runtime.get(projectile), world);
      runtime.sync(projectile);
    }
  }
  return expired;
}
