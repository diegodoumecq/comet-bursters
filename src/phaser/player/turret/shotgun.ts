import { drawMuzzleBridge, drawRoundBarrel, drawRoundCore } from './drawing';
import type { TurretSpriteMetrics } from './types';

export function drawShotgunTurret(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
): void {
  drawRoundCore(ctx, metrics, {
    radiusScale: 1.12,
    stroke: '#7c2d12',
    stops: ['#fff7ed', '#f97316', '#111827'],
  });
  const barrelYs = [-5.4, 0, 5.4];
  for (const y of barrelYs) {
    drawRoundBarrel(ctx, metrics.mountX, y, metrics.length, 2, '#7c2d12', '#fed7aa');
  }
  drawMuzzleBridge(ctx, metrics.length, '#ffedd5', 7);
}
