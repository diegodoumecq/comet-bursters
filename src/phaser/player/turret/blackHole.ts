import { drawMuzzleDot, drawRoundCore, drawTaperedBarrel } from './drawing';
import type { TurretSpriteMetrics } from './types';

export function drawBlackHoleTurret(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
): void {
  drawRoundCore(ctx, metrics, {
    radiusScale: 1.2,
    stroke: '#a78bfa',
    stops: ['#f5f3ff', '#7c3aed', '#111827'],
  });
  drawTaperedBarrel(ctx, metrics, {
    backHalfWidth: 5.2,
    frontHalfWidth: 3,
    stops: ['#312e81', '#a78bfa', '#111827'],
  });
  ctx.strokeStyle = '#d8b4fe';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(metrics.length - 5.5, 0, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  drawMuzzleDot(ctx, metrics.length, '#111827', 3.2);
}
