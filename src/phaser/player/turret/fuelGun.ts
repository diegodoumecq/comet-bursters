import { drawCapsule, drawMuzzleBridge, drawRoundCore, drawTaperedBarrel } from './drawing';
import type { TurretSpriteMetrics } from './types';

export function drawFuelGunTurret(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
): void {
  drawRoundCore(ctx, metrics, {
    radiusScale: 0.96,
    stroke: '#0f766e',
    stops: ['#ecfeff', '#14b8a6', '#0f172a'],
  });
  drawCapsule(ctx, metrics.mountX - 4, -6.2, metrics.length * 0.58, 4.8, '#115e59', '#ccfbf1');
  drawCapsule(ctx, metrics.mountX - 4, 1.4, metrics.length * 0.58, 4.8, '#115e59', '#fbbf24');
  drawTaperedBarrel(ctx, metrics, {
    backHalfWidth: 4.8,
    frontHalfWidth: 2.4,
    stops: ['#334155', '#f8fafc', '#0f766e'],
  });
  drawFuelBand(ctx, metrics.mountX + 6, '#5eead4');
  drawFuelBand(ctx, metrics.mountX + 13, '#facc15');
  drawMuzzleBridge(ctx, metrics.length, '#99f6e4', 4.2);
}

function drawFuelBand(ctx: CanvasRenderingContext2D, x: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, -6.2);
  ctx.lineTo(x, -1.4);
  ctx.moveTo(x, 1.4);
  ctx.lineTo(x, 6.2);
  ctx.stroke();
}
