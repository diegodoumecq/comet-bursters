import type { BlackHoleScreenSample } from './blackHoleShader';

export function renderBlackHoleCaptureCanvas(input: {
  canvas: HTMLCanvasElement;
  blackHoles: BlackHoleScreenSample[];
  height: number;
  width: number;
}): boolean {
  const context = input.canvas.getContext('2d');
  if (!context) return false;
  if (input.canvas.width !== input.width) input.canvas.width = input.width;
  if (input.canvas.height !== input.height) input.canvas.height = input.height;

  context.clearRect(0, 0, input.width, input.height);
  if (input.blackHoles.length === 0) return false;

  for (const blackHole of input.blackHoles) {
    drawBlackHole(context, blackHole);
  }
  return true;
}

function drawBlackHole(context: CanvasRenderingContext2D, blackHole: BlackHoleScreenSample): void {
  const radius = Math.max(1, blackHole.radius);
  const haloRadius = radius * 3.1;
  const glow = context.createRadialGradient(
    blackHole.x,
    blackHole.y,
    radius * 0.9,
    blackHole.x,
    blackHole.y,
    haloRadius,
  );
  glow.addColorStop(0, 'rgba(167, 139, 250, 0.38)');
  glow.addColorStop(0.38, 'rgba(96, 165, 250, 0.18)');
  glow.addColorStop(1, 'rgba(96, 165, 250, 0)');

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = glow;
  context.beginPath();
  context.arc(blackHole.x, blackHole.y, haloRadius, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = Math.max(1, radius * 0.08);
  context.strokeStyle = 'rgba(216, 180, 254, 0.5)';
  context.beginPath();
  context.arc(blackHole.x, blackHole.y, radius * 1.42, 0.2, Math.PI * 1.45);
  context.stroke();

  context.lineWidth = Math.max(1, radius * 0.05);
  context.strokeStyle = 'rgba(103, 232, 249, 0.32)';
  context.beginPath();
  context.arc(blackHole.x, blackHole.y, radius * 1.86, Math.PI * 1.12, Math.PI * 2.08);
  context.stroke();

  context.fillStyle = '#000000';
  context.beginPath();
  context.arc(blackHole.x, blackHole.y, radius, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = Math.max(1, radius * 0.1);
  context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  context.beginPath();
  context.arc(blackHole.x, blackHole.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}
