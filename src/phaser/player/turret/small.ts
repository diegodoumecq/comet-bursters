import { drawMuzzleDot, drawRoundCore, drawTaperedBarrel } from './drawing';
import type { TurretSpriteMetrics } from './types';

export function drawSmallTurret(ctx: CanvasRenderingContext2D, metrics: TurretSpriteMetrics): void {
  drawRoundCore(ctx, metrics, {
    stops: ['#f8fafc', '#64748b', '#0f172a'],
  });
  drawTaperedBarrel(ctx, metrics, {
    backHalfWidth: 3.5,
    frontHalfWidth: 2.2,
    stops: ['#94a3b8', '#e2e8f0', '#475569'],
  });
  drawMuzzleDot(ctx, metrics.length, '#38bdf8', 2.4);
}
