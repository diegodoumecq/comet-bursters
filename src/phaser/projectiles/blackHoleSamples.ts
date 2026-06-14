import type { Vector, WorldSize } from '../core/types';
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

export function buildWrappedBlackHoleScreenSamples(
  projectiles: ProjectileEntity[],
  screen: WorldSize,
  renderTarget: WorldSize = screen,
): BlackHoleScreenSample[] {
  const scaleX = renderTarget.width / screen.width;
  const scaleY = renderTarget.height / screen.height;
  const radiusScale = Math.max(scaleX, scaleY);
  return buildBlackHoleScreenSamples({
    project: (position, influenceRadius) => {
      const scaledInfluenceRadius = influenceRadius * radiusScale;
      const x = position.x * scaleX;
      const y = position.y * scaleY;
      return getWrapPositions(x, y, scaledInfluenceRadius, renderTarget);
    },
    projectiles,
  }).map((sample) => ({
    radius: sample.radius * radiusScale,
    x: sample.x,
    y: sample.y,
  }));
}

function getWrapPositions(
  x: number,
  y: number,
  influenceRadius: number,
  renderTarget: WorldSize,
): Vector[] {
  const xOffsets = [0];
  const yOffsets = [0];
  if (x - influenceRadius < 0) xOffsets.push(renderTarget.width);
  if (x + influenceRadius > renderTarget.width) xOffsets.push(-renderTarget.width);
  if (y - influenceRadius < 0) yOffsets.push(renderTarget.height);
  if (y + influenceRadius > renderTarget.height) yOffsets.push(-renderTarget.height);

  const positions: Vector[] = [];
  for (const xOffset of xOffsets) {
    for (const yOffset of yOffsets) {
      positions.push({ x: x + xOffset, y: y + yOffset });
    }
  }
  return positions;
}
