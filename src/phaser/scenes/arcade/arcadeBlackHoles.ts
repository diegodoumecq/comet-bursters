import type { WorldSize } from '../../core/types';
import {
  getBlackHoleInfluenceRadius,
  getBlackHoleRenderRadius,
} from '../../projectiles/blackHoles';
import type { BlackHoleScreenSample } from '../../projectiles/blackHoleShader';
import type { ProjectileEntity } from '../../projectiles/types';

export function buildArcadeBlackHoleScreenSamples(
  projectiles: ProjectileEntity[],
  screen: WorldSize,
): BlackHoleScreenSample[] {
  const samples: BlackHoleScreenSample[] = [];
  for (const projectile of projectiles) {
    if (projectile.kind === 'blackHole') {
      const radius = getBlackHoleRenderRadius(projectile);
      const influenceRadius = getBlackHoleInfluenceRadius(radius);
      const offsets = getWrapOffsets(
        projectile.position.x,
        projectile.position.y,
        influenceRadius,
        screen,
      );
      for (const offset of offsets) {
        samples.push({
          radius,
          x: projectile.position.x + offset.x,
          y: projectile.position.y + offset.y,
        });
      }
    }
  }
  return samples;
}

function getWrapOffsets(
  x: number,
  y: number,
  influenceRadius: number,
  screen: WorldSize,
): Array<{ x: number; y: number }> {
  const xOffsets = [0];
  const yOffsets = [0];
  if (x - influenceRadius < 0) xOffsets.push(screen.width);
  if (x + influenceRadius > screen.width) xOffsets.push(-screen.width);
  if (y - influenceRadius < 0) yOffsets.push(screen.height);
  if (y + influenceRadius > screen.height) yOffsets.push(-screen.height);

  const offsets: Array<{ x: number; y: number }> = [];
  for (const xOffset of xOffsets) {
    for (const yOffset of yOffsets) {
      offsets.push({ x: xOffset, y: yOffset });
    }
  }
  return offsets;
}
