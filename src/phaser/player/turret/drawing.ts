import type { TurretSpriteMetrics } from './types';

export function drawRoundCore(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
  input: {
    radiusScale?: number;
    stroke?: string;
    stops: [string, string, string];
  },
): void {
  const radius = metrics.baseRadius * (input.radiusScale ?? 1);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.25);
  core.addColorStop(0, input.stops[0]);
  core.addColorStop(0.52, input.stops[1]);
  core.addColorStop(1, input.stops[2]);
  ctx.fillStyle = core;
  ctx.strokeStyle = input.stroke ?? '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawDiamondCore(
  ctx: CanvasRenderingContext2D,
  input: {
    fill: string;
    halfHeight: number;
    halfWidth: number;
    stroke: string;
  },
): void {
  ctx.fillStyle = input.fill;
  ctx.strokeStyle = input.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(input.halfWidth, 0);
  ctx.lineTo(0, -input.halfHeight);
  ctx.lineTo(-input.halfWidth, 0);
  ctx.lineTo(0, input.halfHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawBoxCore(
  ctx: CanvasRenderingContext2D,
  input: {
    fill: string;
    height: number;
    radius: number;
    stroke: string;
    width: number;
  },
): void {
  ctx.fillStyle = input.fill;
  ctx.strokeStyle = input.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-input.width * 0.5, -input.height * 0.5, input.width, input.height, input.radius);
  ctx.fill();
  ctx.stroke();
}

export function drawTaperedBarrel(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
  input: {
    backHalfWidth: number;
    frontHalfWidth: number;
    stops: [string, string, string];
  },
): void {
  ctx.beginPath();
  ctx.moveTo(metrics.mountX, -input.backHalfWidth);
  ctx.lineTo(metrics.length, -input.frontHalfWidth);
  ctx.lineTo(metrics.length, input.frontHalfWidth);
  ctx.lineTo(metrics.mountX, input.backHalfWidth);
  ctx.closePath();
  const barrel = ctx.createLinearGradient(metrics.mountX, 0, metrics.length, 0);
  barrel.addColorStop(0, input.stops[0]);
  barrel.addColorStop(0.45, input.stops[1]);
  barrel.addColorStop(1, input.stops[2]);
  ctx.fillStyle = barrel;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.fill();
  ctx.stroke();
}

export function drawParallelBarrels(
  ctx: CanvasRenderingContext2D,
  metrics: TurretSpriteMetrics,
  input: {
    color: string;
    halfWidth: number;
    lineWidth: number;
    offsetY: number;
    stroke: string;
  },
): void {
  drawRoundBarrel(
    ctx,
    metrics.mountX,
    -input.offsetY,
    metrics.length,
    input.halfWidth,
    input.stroke,
    input.color,
  );
  drawRoundBarrel(
    ctx,
    metrics.mountX,
    input.offsetY,
    metrics.length,
    input.halfWidth,
    input.stroke,
    input.color,
  );
  ctx.strokeStyle = input.stroke;
  ctx.lineWidth = input.lineWidth;
  ctx.beginPath();
  ctx.moveTo(metrics.mountX, -input.offsetY);
  ctx.lineTo(metrics.mountX, input.offsetY);
  ctx.stroke();
}

export function drawRoundBarrel(
  ctx: CanvasRenderingContext2D,
  startX: number,
  y: number,
  endX: number,
  radius: number,
  stroke: string,
  fill: string,
): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = radius * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(endX - radius, y);
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = Math.max(1, radius);
  ctx.beginPath();
  ctx.moveTo(startX + radius, y);
  ctx.lineTo(endX - radius, y);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

export function drawCapsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
  fill: string,
): void {
  const radius = height * 0.5;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
  ctx.stroke();
}

export function drawMuzzleBridge(
  ctx: CanvasRenderingContext2D,
  x: number,
  color: string,
  height: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 1, -height);
  ctx.lineTo(x - 1, height);
  ctx.stroke();
}

export function drawMuzzleDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  color: string,
  radius: number,
): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x - radius, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
