import type { Vector } from '../core/types';
import { getBlackHoleInfluenceRadius, getBlackHoleRenderRadius } from './blackHoles';
import type { BlackHoleScreenSample } from './blackHoleShader';
import type { ProjectileEntity } from './types';

type BlackHoleSampleInput = {
  projectiles: ProjectileEntity[];
  project: (position: Vector, radius: number) => Vector[];
};

export function buildBlackHoleScreenSamples({
  project,
  projectiles,
}: BlackHoleSampleInput): BlackHoleScreenSample[] {
  const samples: BlackHoleScreenSample[] = [];
  for (const projectile of projectiles) {
    if (projectile.kind === 'blackHole') {
      const radius = getBlackHoleRenderRadius(projectile);
      const influenceRadius = getBlackHoleInfluenceRadius(radius);
      for (const screenPosition of project(projectile.position, influenceRadius)) {
        samples.push({
          x: screenPosition.x,
          y: screenPosition.y,
          radius,
        });
      }
    }
  }
  return samples;
}
