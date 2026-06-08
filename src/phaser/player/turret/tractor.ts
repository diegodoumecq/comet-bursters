import { drawBoxCore, drawTaperedBarrel } from './drawing';
import type { TurretSpriteMetrics } from './types';

export function drawTractorTurret(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
): void {
  drawBoxCore(ctx, {
    fill: '#ecfeff',
    height: 13,
    radius: 6,
    stroke: '#155e75',
    width: 18,
  });
  drawTaperedBarrel(ctx, metrics, {
    backHalfWidth: 4.4,
    frontHalfWidth: 2.4,
    stops: ['#155e75', '#a5f3fc', '#164e63'],
  });
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(metrics.length - 5, -6);
  ctx.lineTo(metrics.length, -2.8);
  ctx.lineTo(metrics.length, 2.8);
  ctx.lineTo(metrics.length - 5, 6);
  ctx.stroke();
}
