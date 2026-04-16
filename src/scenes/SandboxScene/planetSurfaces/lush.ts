import type { Planet } from '@/constants';

import { drawFlatTextureOnSphere, getFlatPlanetTexture } from '../planetTextureEngine';
import { alphaColor } from './shared';

function seededNoise(seed: number): number {
  const value = Math.sin(seed * 127.1) * 43758.5453123;
  return value - Math.floor(value);
}

function dramaticThicknessVariance(seed: number, min: number, max: number): number {
  const noise = seededNoise(seed);
  const eased = Math.pow(noise, 0.42);
  return min + eased * (max - min);
}

function paintFlatLushTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
): void {
  ctx.clearRect(0, 0, width, height);

  const canopyGradient = ctx.createLinearGradient(0, 0, width, height);
  canopyGradient.addColorStop(0, alphaColor('#d8ffbf', 0.14));
  canopyGradient.addColorStop(0.38, alphaColor('#4dbb63', 0.12));
  canopyGradient.addColorStop(1, alphaColor('#14381a', 0));
  ctx.fillStyle = canopyGradient;
  ctx.fillRect(0, 0, width, height);

  const ribbons = [
    { y: 0.22, amp: 0.08, thick: 0.09, tint: '#4daa52', alpha: 0.28, speed: 0.05 },
    { y: 0.34, amp: 0.1, thick: 0.08, tint: '#6ed67b', alpha: 0.22, speed: 0.04 },
    { y: 0.48, amp: 0.06, thick: 0.1, tint: '#2f7f3c', alpha: 0.2, speed: 0.03 },
    { y: 0.62, amp: 0.09, thick: 0.08, tint: '#79df6b', alpha: 0.18, speed: 0.05 },
    { y: 0.78, amp: 0.07, thick: 0.09, tint: '#3f9150', alpha: 0.2, speed: 0.035 },
  ] as const;

  for (const ribbon of ribbons) {
    const centerY = ribbon.y * height;
    ctx.fillStyle = alphaColor(ribbon.tint, ribbon.alpha);
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let x = 0; x <= width; x += width / 16) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + planet.rotation * ribbon.speed + ribbon.y * 8) *
          height * ribbon.amp +
        Math.cos((x / width) * Math.PI * 6 + ribbon.y * 5) * height * 0.016;
      ctx.lineTo(x, centerY + wave - height * ribbon.thick * 0.5);
    }

    for (let x = width; x >= 0; x -= width / 16) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + planet.rotation * ribbon.speed + ribbon.y * 8) *
          height * ribbon.amp +
        Math.cos((x / width) * Math.PI * 6 + ribbon.y * 5) * height * 0.016;
      ctx.lineTo(x, centerY + wave + height * ribbon.thick * 0.5);
    }

    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = alphaColor('#f4ffd6', ribbon.alpha * 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += width / 16) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + planet.rotation * ribbon.speed + ribbon.y * 8) *
          height * ribbon.amp +
        Math.cos((x / width) * Math.PI * 6 + ribbon.y * 5) * height * 0.016;
      if (x === 0) {
        ctx.moveTo(x, centerY + wave - height * ribbon.thick * 0.18);
      } else {
        ctx.lineTo(x, centerY + wave - height * ribbon.thick * 0.18);
      }
    }
    ctx.stroke();
  }

  const squiggleBands = [
    { y: 0.12, amp: 0.024, width: 6.2, alpha: 0.14, tint: '#b9ff97', freq: 2, speed: 0.03 },
    { y: 0.16, amp: 0.018, width: 5.1, alpha: 0.16, tint: '#e9ffd2', freq: 3, speed: 0.045 },
    { y: 0.19, amp: 0.012, width: 4.4, alpha: 0.19, tint: '#f4ffd6', freq: 5, speed: 0.06 },
    { y: 0.27, amp: 0.022, width: 5.8, alpha: 0.13, tint: '#8ce576', freq: 2, speed: 0.04 },
    { y: 0.31, amp: 0.014, width: 4.7, alpha: 0.17, tint: '#dfffc3', freq: 4, speed: 0.055 },
    { y: 0.37, amp: 0.026, width: 6.6, alpha: 0.12, tint: '#61bf5f', freq: 2, speed: 0.035 },
    { y: 0.41, amp: 0.018, width: 5.3, alpha: 0.14, tint: '#c9ffad', freq: 3, speed: 0.05 },
    { y: 0.45, amp: 0.011, width: 4.2, alpha: 0.18, tint: '#f2ffd8', freq: 6, speed: 0.07 },
    { y: 0.53, amp: 0.021, width: 5.6, alpha: 0.12, tint: '#7fe26f', freq: 2, speed: 0.045 },
    { y: 0.57, amp: 0.013, width: 4.5, alpha: 0.16, tint: '#e8ffd2', freq: 5, speed: 0.065 },
    { y: 0.66, amp: 0.028, width: 7, alpha: 0.11, tint: '#4b9e53', freq: 2, speed: 0.03 },
    { y: 0.7, amp: 0.017, width: 5, alpha: 0.13, tint: '#bfff9d', freq: 4, speed: 0.05 },
    { y: 0.74, amp: 0.01, width: 4.1, alpha: 0.16, tint: '#f4ffd6', freq: 6, speed: 0.08 },
    { y: 0.82, amp: 0.022, width: 5.7, alpha: 0.13, tint: '#75d36e', freq: 3, speed: 0.04 },
    { y: 0.88, amp: 0.014, width: 4.6, alpha: 0.15, tint: '#ddffc3', freq: 5, speed: 0.06 },
  ] as const;

  for (let bandIndex = 0; bandIndex < squiggleBands.length; bandIndex++) {
    const band = squiggleBands[bandIndex];
    const centerY = band.y * height;
    ctx.strokeStyle = alphaColor(band.tint, band.alpha);
    const widthJitter = dramaticThicknessVariance(
      bandIndex + planet.altitudeVariations[bandIndex % planet.altitudeVariations.length] * 10,
      0.6,
      7,
    );
    const squiggleWidth = Math.max(3.2, band.width * widthJitter);
    ctx.lineWidth = squiggleWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (let x = 0; x <= width; x += width / 20) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 * band.freq + planet.rotation * band.speed + band.y * 11) *
          height * band.amp +
        Math.cos((x / width) * Math.PI * (band.freq + 2) + band.y * 7) * height * 0.008;

      if (x === 0) {
        ctx.moveTo(x, centerY + wave);
      } else {
        ctx.lineTo(x, centerY + wave);
      }
    }

    ctx.stroke();

    if (squiggleWidth >= 3.4) {
      ctx.strokeStyle = alphaColor('#f4ffd6', band.alpha * 0.38);
      ctx.lineWidth = Math.max(1.8, squiggleWidth * 0.18);
      ctx.beginPath();
      for (let x = 0; x <= width; x += width / 20) {
        const wave =
          Math.sin(
            (x / width) * Math.PI * 2 * band.freq + planet.rotation * band.speed + band.y * 11,
          ) *
            height *
            band.amp +
          Math.cos((x / width) * Math.PI * (band.freq + 2) + band.y * 7) * height * 0.008;

        if (x === 0) {
          ctx.moveTo(x, centerY + wave - squiggleWidth * 0.12);
        } else {
          ctx.lineTo(x, centerY + wave - squiggleWidth * 0.12);
        }
      }
      ctx.stroke();
    }
  }

  const tendrils = [
    { y: 0.18, amp: 0.034, width: 3.4, alpha: 0.12, tint: '#dfffc3', freq: 3, speed: 0.05, phase: 0.2 },
    { y: 0.29, amp: 0.028, width: 2.9, alpha: 0.14, tint: '#b9ff97', freq: 4, speed: 0.065, phase: 0.48 },
    { y: 0.43, amp: 0.03, width: 3.1, alpha: 0.12, tint: '#eaffd2', freq: 5, speed: 0.06, phase: 0.76 },
    { y: 0.59, amp: 0.036, width: 3.7, alpha: 0.1, tint: '#9df27f', freq: 3, speed: 0.05, phase: 1.04 },
    { y: 0.73, amp: 0.032, width: 2.8, alpha: 0.13, tint: '#d6ffc3', freq: 4, speed: 0.07, phase: 1.32 },
    { y: 0.86, amp: 0.026, width: 2.6, alpha: 0.11, tint: '#f4ffd6', freq: 6, speed: 0.08, phase: 1.66 },
  ] as const;

  for (let tendrilIndex = 0; tendrilIndex < tendrils.length; tendrilIndex++) {
    const tendril = tendrils[tendrilIndex];
    const tendrilWidth =
      Math.max(
        2.2,
        tendril.width *
          dramaticThicknessVariance(
            100 +
              tendrilIndex +
              planet.altitudeVariations[tendrilIndex % planet.altitudeVariations.length] * 12,
            0.7,
            5.6,
          ),
      );
    ctx.strokeStyle = alphaColor(tendril.tint, tendril.alpha);
    ctx.lineWidth = tendrilWidth;
    ctx.lineCap = 'round';

    for (let segment = 0; segment < 4; segment++) {
      const start = (segment / 4) * width + (segment % 2) * width * 0.025;
      const end = start + width * (0.18 + (segment % 3) * 0.04);
      ctx.beginPath();

      for (let x = start; x <= end; x += width / 24) {
        const branch =
          Math.sin((x / width) * Math.PI * 2 * tendril.freq + tendril.phase + planet.rotation * tendril.speed) *
            height *
            tendril.amp +
          Math.cos((x / width) * Math.PI * (tendril.freq + 3) + tendril.phase * 1.8) * height * 0.01;
        const y = tendril.y * height + branch + Math.sin(x * 0.021 + segment) * height * 0.008;

        if (x === start) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  }

  for (let i = 0; i < 22; i++) {
    const x = ((i * 0.081 + 0.03) % 1) * width;
    const y = (((i * 0.147 + 0.17) % 1) * 0.76 + 0.12) * height;
    const length = width * (0.026 + (i % 4) * 0.008);
    const swing = ((i % 5) - 2) * height * 0.012;

    ctx.strokeStyle = alphaColor(i % 2 === 0 ? '#eaffd2' : '#aef78d', 0.1 + (i % 3) * 0.025);
    ctx.lineWidth = dramaticThicknessVariance(
      200 + i + planet.altitudeVariations[i % planet.altitudeVariations.length] * 14,
      1.4,
      14,
    );
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - length * 0.5, y + swing);
    ctx.quadraticCurveTo(x - length * 0.08, y - swing * 0.6, x + length * 0.24, y + swing * 0.4);
    ctx.quadraticCurveTo(x + length * 0.42, y + swing * 0.7, x + length * 0.56, y - swing * 0.25);
    ctx.stroke();
  }

}

export function drawLushSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const texture = getFlatPlanetTexture(
    `lush-flat-v4|${planet.color}`,
    768,
    384,
    planet,
    paintFlatLushTexture,
  );
  drawFlatTextureOnSphere(ctx, texture, radius, planet.rotation * 0.08);
}
