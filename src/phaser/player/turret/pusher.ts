import { drawBoxCore, drawMuzzleBridge, drawParallelBarrels } from './drawing';
import type { TurretSpriteMetrics } from './types';

export function drawPusherTurret(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
): void {
  drawBoxCore(ctx, {
    fill: '#bbf7d0',
    height: 12,
    radius: 3,
    stroke: '#14532d',
    width: 16,
  });
  drawParallelBarrels(ctx, metrics, {
    color: '#86efac',
    halfWidth: 1.8,
    lineWidth: 3,
    offsetY: 4.2,
    stroke: '#14532d',
  });
  drawMuzzleBridge(ctx, metrics.length, '#bbf7d0', 5);
}
