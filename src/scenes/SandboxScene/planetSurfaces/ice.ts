import type { Planet } from '@/constants';

import { drawFlatTextureOnSphere, getFlatPlanetTexture } from '../planetTextureEngine';
import { alphaColor } from './shared';

function paintFlatIceTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
): void {
  ctx.clearRect(0, 0, width, height);

  const frostGradient = ctx.createLinearGradient(0, 0, width, height);
  frostGradient.addColorStop(0, alphaColor('#ffffff', 0.14));
  frostGradient.addColorStop(0.5, alphaColor('#b7ecff', 0.12));
  frostGradient.addColorStop(1, alphaColor('#4aa7d6', 0));
  ctx.fillStyle = frostGradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 18; i++) {
    const x = ((i * 0.089 + 0.07) % 1) * width;
    const y = (((i * 0.177 + 0.11) % 1) * 0.8 + 0.08) * height;

    ctx.strokeStyle = alphaColor('#ffffff', 0.18);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.028, y - height * 0.01);
    ctx.lineTo(x + width * 0.028, y + height * 0.01);
    ctx.stroke();
  }

  for (let i = 0; i < 12; i++) {
    const x = ((i * 0.137 + 0.03) % 1) * width;
    const y = (((i * 0.201 + 0.19) % 1) * 0.76 + 0.1) * height;

    ctx.fillStyle = alphaColor('#ffffff', 0.14);
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.08, height * 0.04, ((i % 5) - 2) * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 16; i++) {
    const y = ((i + 0.5) / 16) * height;
    ctx.strokeStyle = alphaColor('#c7f6ff', 0.06 + (i % 3) * 0.02);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += width / 14) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + i * 0.46 + planet.rotation * 0.05) * height * 0.014;
      if (x === 0) {
        ctx.moveTo(x, y + wave);
      } else {
        ctx.lineTo(x, y + wave);
      }
    }
    ctx.stroke();
  }
}

export function drawIceSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const texture = getFlatPlanetTexture(
    `ice-flat|${planet.color}`,
    768,
    384,
    planet,
    paintFlatIceTexture,
  );
  drawFlatTextureOnSphere(ctx, texture, radius, planet.rotation * 0.2);
}
