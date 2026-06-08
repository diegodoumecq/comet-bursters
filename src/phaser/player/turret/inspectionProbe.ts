import { drawDiamondCore, drawMuzzleDot, drawRoundBarrel } from './drawing';
import type { TurretSpriteMetrics } from './types';

export function drawInspectionProbeTurret(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
): void {
  drawDiamondCore(ctx, {
    fill: '#dbeafe',
    halfHeight: 7.5,
    halfWidth: 8.5,
    stroke: '#334155',
  });
  drawRoundBarrel(ctx, metrics.mountX, 0, metrics.length, 2.2, '#334155', '#dbeafe');
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(metrics.mountX + 4, -3.8);
  ctx.lineTo(metrics.length - 4, -6.2);
  ctx.moveTo(metrics.mountX + 4, 3.8);
  ctx.lineTo(metrics.length - 4, 6.2);
  ctx.stroke();
  drawMuzzleDot(ctx, metrics.length, '#e0f2fe', 2.6);
}
