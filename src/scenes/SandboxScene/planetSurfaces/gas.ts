import type { Planet } from '@/constants';

import { drawFlatTextureOnSphere, getFlatPlanetTexture } from '../planetTextureEngine';
import { alphaColor } from './shared';

function paintFlatGasTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
): void {
  ctx.clearRect(0, 0, width, height);

  const bandColors = [
    alphaColor('#ffe3b3', 0.18),
    alphaColor('#ffd6ff', 0.16),
    alphaColor('#c6b3ff', 0.18),
    alphaColor('#8ec5ff', 0.14),
    alphaColor('#8b6cff', 0.18),
    alphaColor('#f4ddff', 0.14),
  ];

  for (let i = 0; i < 12; i++) {
    const y = ((i + 0.5) / 12) * height;
    ctx.strokeStyle = bandColors[i % bandColors.length];
    ctx.lineWidth = height * (0.08 + (i % 3) * 0.014);
    ctx.beginPath();
    for (let x = 0; x <= width; x += width / 14) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + planet.rotation * 0.08 + i) * height * 0.032 +
        Math.cos((x / width) * Math.PI * 5 + i * 0.24) * height * 0.012;
      if (x === 0) {
        ctx.moveTo(x, y + wave);
      } else {
        ctx.lineTo(x, y + wave);
      }
    }
    ctx.stroke();
  }

  ctx.fillStyle = alphaColor('#fff6ff', 0.12);
  ctx.beginPath();
  ctx.arc(width * 0.58, height * 0.62, width * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = alphaColor('#ffd6ff', 0.18);
  ctx.beginPath();
  ctx.arc(width * 0.56, height * 0.6, width * 0.034, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGasSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const texture = getFlatPlanetTexture(
    `gas-flat|${planet.color}`,
    768,
    384,
    planet,
    paintFlatGasTexture,
  );
  drawFlatTextureOnSphere(ctx, texture, radius, planet.rotation * 0.22);
}
