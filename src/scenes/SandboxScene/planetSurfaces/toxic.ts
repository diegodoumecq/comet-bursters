import type { Planet } from '@/constants';

import { drawFlatTextureOnSphere, getFlatPlanetTexture } from '../planetTextureEngine';
import { alphaColor } from './shared';

function withWrappedX(width: number, x: number, draw: (wrappedX: number) => void): void {
  draw(x);

  if (x < width * 0.15) {
    draw(x + width);
  } else if (x > width * 0.85) {
    draw(x - width);
  }
}

function traceIrregularPool(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  phase: number,
): void {
  ctx.beginPath();

  for (let step = 0; step <= 14; step++) {
    const t = (step / 14) * Math.PI * 2;
    const wobble =
      1 +
      Math.sin(t * 3 + phase) * 0.16 +
      Math.cos(t * 5 - phase * 0.7) * 0.09 +
      Math.sin(t * 7 + phase * 1.2) * 0.05;
    const px = x + Math.cos(t) * radiusX * wobble;
    const py = y + Math.sin(t) * radiusY * wobble;

    if (step === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
}

function paintFlatToxicTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
): void {
  ctx.clearRect(0, 0, width, height);

  const baseGradient = ctx.createLinearGradient(0, 0, width, height);
  baseGradient.addColorStop(0, alphaColor('#cfff74', 0.12));
  baseGradient.addColorStop(0.28, alphaColor('#2a6a39', 0.12));
  baseGradient.addColorStop(0.7, alphaColor('#0d3f2b', 0.18));
  baseGradient.addColorStop(1, alphaColor('#06160f', 0));
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  const falloutGradient = ctx.createLinearGradient(0, height * 0.74, width, height * 0.1);
  falloutGradient.addColorStop(0, alphaColor('#07160f', 0.16));
  falloutGradient.addColorStop(0.46, alphaColor('#0b2c1d', 0.08));
  falloutGradient.addColorStop(1, alphaColor('#d3ff73', 0.03));
  ctx.fillStyle = falloutGradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 8; i++) {
    const x = ((i * 0.143 + 0.07) % 1) * width;
    const y = (((i * 0.211 + 0.09) % 1) * 0.72 + 0.12) * height;
    const w = width * (0.12 + (i % 3) * 0.028);
    const h = height * (0.06 + (i % 2) * 0.022);
    const phase = i * 0.83 + planet.rotation * 0.2;

    withWrappedX(width, x, (wrappedX) => {
      const poolGlow = ctx.createRadialGradient(
        wrappedX - w * 0.12,
        y - h * 0.1,
        w * 0.08,
        wrappedX,
        y,
        w,
      );
      poolGlow.addColorStop(0, alphaColor('#d8ff77', 0.12));
      poolGlow.addColorStop(0.28, alphaColor('#9dff48', 0.12));
      poolGlow.addColorStop(0.66, alphaColor('#33c24d', 0.09));
      poolGlow.addColorStop(1, alphaColor('#0c2d1b', 0));

      traceIrregularPool(ctx, wrappedX, y, w, h, phase);
      ctx.fillStyle = poolGlow;
      ctx.fill();

      ctx.strokeStyle = alphaColor('#142015', 0.1);
      ctx.lineWidth = 2;
      ctx.stroke();

      traceIrregularPool(ctx, wrappedX + w * 0.02, y - h * 0.01, w * 0.58, h * 0.55, phase + 0.9);
      ctx.fillStyle = alphaColor('#9dff48', 0.08);
      ctx.fill();

      ctx.strokeStyle = alphaColor('#dfff7d', 0.04);
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  for (let i = 0; i < 20; i++) {
    const startX = ((i * 0.109 + 0.05) % 1) * width;
    const startY = (((i * 0.183 + 0.11) % 1) * 0.82 + 0.08) * height;
    const length = width * (0.05 + (i % 4) * 0.016);
    const bend = ((i % 5) - 2) * height * 0.02;

    ctx.strokeStyle = alphaColor('#78ff66', 0.06 + (i % 3) * 0.02);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(
      startX + length * 0.42,
      startY + bend,
      startX + length,
      startY + bend * 0.3 + height * (0.01 - (i % 2) * 0.02),
    );
    ctx.stroke();

    ctx.strokeStyle = alphaColor('#163722', 0.1);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(startX + width * 0.003, startY + height * 0.003);
    ctx.quadraticCurveTo(
      startX + length * 0.4,
      startY + bend + height * 0.006,
      startX + length,
      startY + bend * 0.32 + height * (0.016 - (i % 2) * 0.02),
    );
    ctx.stroke();
  }

  for (let i = 0; i < 12; i++) {
    const x = ((i * 0.167 + 0.08) % 1) * width;
    const y = (((i * 0.247 + 0.15) % 1) * 0.76 + 0.1) * height;
    const r = width * (0.018 + (i % 3) * 0.006);

    withWrappedX(width, x, (wrappedX) => {
      const ventGlow = ctx.createRadialGradient(wrappedX, y, r * 0.08, wrappedX, y, r * 1.2);
      ventGlow.addColorStop(0, alphaColor('#d8ff77', 0.14));
      ventGlow.addColorStop(0.32, alphaColor('#9aff4d', 0.08));
      ventGlow.addColorStop(1, alphaColor('#d8ff77', 0));

      ctx.fillStyle = ventGlow;
      ctx.beginPath();
      ctx.arc(wrappedX, y, r * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = alphaColor('#ff9fca', 0.14);
      ctx.beginPath();
      ctx.arc(wrappedX - r * 0.12, y - r * 0.08, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  for (let i = 0; i < 24; i++) {
    const y = ((i + 0.5) / 24) * height;
    const lineGradient = ctx.createLinearGradient(0, y, width, y);
    lineGradient.addColorStop(0, alphaColor('#d8ff77', 0));
    lineGradient.addColorStop(0.18, alphaColor('#b7ff53', 0.05 + (i % 4) * 0.014));
    lineGradient.addColorStop(0.56, alphaColor('#49cc57', 0.04 + (i % 3) * 0.01));
    lineGradient.addColorStop(1, alphaColor('#49cc57', 0));
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x <= width; x += width / 16) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + planet.rotation * 0.065 + i * 0.48) * height * 0.012 +
        Math.cos((x / width) * Math.PI * 5 + i * 0.14) * height * 0.004;
      if (x === 0) {
        ctx.moveTo(x, y + wave);
      } else {
        ctx.lineTo(x, y + wave);
      }
    }
    ctx.stroke();
  }

  for (let i = 0; i < 26; i++) {
    const x = ((i * 0.151 + 0.04) % 1) * width;
    const y = (((i * 0.279 + 0.07) % 1) * 0.8 + 0.09) * height;
    const bubble = width * (0.006 + (i % 3) * 0.002);

    ctx.fillStyle = alphaColor(i % 2 === 0 ? '#ffb3d8' : '#ff89bf', 0.1 + (i % 2) * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, bubble, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawToxicSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const texture = getFlatPlanetTexture(
    `toxic-flat|${planet.color}`,
    768,
    384,
    planet,
    paintFlatToxicTexture,
  );
  drawFlatTextureOnSphere(ctx, texture, radius, planet.rotation * 0.18);
}
