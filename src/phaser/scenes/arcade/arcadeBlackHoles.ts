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
  renderTarget: WorldSize = screen,
): BlackHoleScreenSample[] {
  const samples: BlackHoleScreenSample[] = [];
  const scaleX = renderTarget.width / screen.width;
  const scaleY = renderTarget.height / screen.height;
  const radiusScale = Math.max(scaleX, scaleY);
  for (const projectile of projectiles) {
    if (projectile.kind === 'blackHole') {
      const radius = getBlackHoleRenderRadius(projectile);
      const renderRadius = radius * radiusScale;
      const influenceRadius = getBlackHoleInfluenceRadius(radius) * radiusScale;
      const x = projectile.position.x * scaleX;
      const y = projectile.position.y * scaleY;
      const offsets = getWrapOffsets(x, y, influenceRadius, renderTarget);
      for (const offset of offsets) {
        samples.push({
          radius: renderRadius,
          x: x + offset.x,
          y: y + offset.y,
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
  renderTarget: WorldSize,
): Array<{ x: number; y: number }> {
  const xOffsets = [0];
  const yOffsets = [0];
  if (x - influenceRadius < 0) xOffsets.push(renderTarget.width);
  if (x + influenceRadius > renderTarget.width) xOffsets.push(-renderTarget.width);
  if (y - influenceRadius < 0) yOffsets.push(renderTarget.height);
  if (y + influenceRadius > renderTarget.height) yOffsets.push(-renderTarget.height);

  const offsets: Array<{ x: number; y: number }> = [];
  for (const xOffset of xOffsets) {
    for (const yOffset of yOffsets) {
      offsets.push({ x: xOffset, y: yOffset });
    }
  }
  return offsets;
}
