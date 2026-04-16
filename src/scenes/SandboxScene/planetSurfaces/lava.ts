import type { Planet } from '@/constants';
import { drawFlatTextureOnSphere, getFlatPlanetTexture } from '../planetTextureEngine';
import { alphaColor } from './shared';

type LavaPool = {
  u: number;
  v: number;
  width: number;
  height: number;
  rotation: number;
  alpha: number;
};

const LAVA_POOLS: readonly LavaPool[] = [
  { u: 0.06, v: 0.34, width: 0.145, height: 0.066, rotation: -0.28, alpha: 0.06 },
  { u: 0.12, v: 0.58, width: 0.158, height: 0.072, rotation: 0.14, alpha: 0.055 },
  { u: 0.18, v: 0.76, width: 0.119, height: 0.052, rotation: -0.18, alpha: 0.04 },
  { u: 0.24, v: 0.42, width: 0.132, height: 0.059, rotation: 0.36, alpha: 0.055 },
  { u: 0.31, v: 0.18, width: 0.158, height: 0.068, rotation: -0.42, alpha: 0.05 },
  { u: 0.38, v: 0.64, width: 0.132, height: 0.063, rotation: 0.22, alpha: 0.045 },
  { u: 0.44, v: 0.82, width: 0.106, height: 0.05, rotation: -0.18, alpha: 0.0375 },
  { u: 0.5, v: 0.36, width: 0.145, height: 0.066, rotation: 0.18, alpha: 0.05 },
  { u: 0.58, v: 0.54, width: 0.158, height: 0.072, rotation: -0.24, alpha: 0.055 },
  { u: 0.64, v: 0.24, width: 0.119, height: 0.052, rotation: 0.42, alpha: 0.045 },
  { u: 0.72, v: 0.72, width: 0.145, height: 0.063, rotation: -0.34, alpha: 0.045 },
  { u: 0.8, v: 0.46, width: 0.158, height: 0.071, rotation: 0.1, alpha: 0.055 },
  { u: 0.88, v: 0.16, width: 0.132, height: 0.058, rotation: -0.22, alpha: 0.045 },
  { u: 0.94, v: 0.66, width: 0.145, height: 0.066, rotation: 0.28, alpha: 0.045 },
];

function withWrappedX(width: number, x: number, draw: (wrappedX: number) => void): void {
  draw(x);

  if (x < 0) {
    draw(x + width);
  } else if (x > width) {
    draw(x - width);
  }

  if (x < width * 0.15) {
    draw(x + width);
  } else if (x > width * 0.85) {
    draw(x - width);
  }
}

function paintFlatLavaTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
): void {
  ctx.clearRect(0, 0, width, height);

  const baseGradient = ctx.createLinearGradient(0, 0, width, height);
  baseGradient.addColorStop(0, alphaColor('#ffb16b', 0.12));
  baseGradient.addColorStop(0.35, alphaColor('#ff5a36', 0.08));
  baseGradient.addColorStop(1, alphaColor('#6a1a0d', 0));
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  const smokeGradient = ctx.createLinearGradient(0, height * 0.72, width, height * 0.18);
  smokeGradient.addColorStop(0, alphaColor('#2a0b08', 0.22));
  smokeGradient.addColorStop(0.5, alphaColor('#6a2010', 0.08));
  smokeGradient.addColorStop(1, alphaColor('#2a0b08', 0));
  ctx.fillStyle = smokeGradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 36; i++) {
    const y = ((i + 0.5) / 36) * height;
    const bandGradient = ctx.createLinearGradient(0, y, width, y);
    bandGradient.addColorStop(0, alphaColor('#ffd2a1', 0));
    bandGradient.addColorStop(0.18, alphaColor('#ffd2a1', 0.06 + (i % 3) * 0.015));
    bandGradient.addColorStop(0.52, alphaColor('#ff8a54', 0.03 + (i % 4) * 0.01));
    bandGradient.addColorStop(1, alphaColor('#ff8a54', 0));

    ctx.strokeStyle = bandGradient;
    ctx.lineWidth = 1 + (i % 2);
    ctx.beginPath();
    ctx.moveTo(0, y);

    for (let x = 0; x <= width; x += width / 10) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + i * 0.62 + planet.rotation * 0.08) * height * 0.012 +
        Math.cos((x / width) * Math.PI * 6 + i * 0.18) * height * 0.005;
      ctx.lineTo(x, y + wave);
    }

    ctx.stroke();
  }

  for (let i = 0; i < 4; i++) {
    const x = ((i * 0.137 + 0.04) % 1) * width;
    const y = (((i * 0.211 + 0.13) % 1) * 0.78 + 0.1) * height;
    const craterWidth = width * (0.032 + (i % 2) * 0.008);
    const craterHeight = height * (0.018 + (i % 2) * 0.004);
    const rotation = ((i % 5) - 2) * 0.18;

    withWrappedX(width, x, (wrappedX) => {
      const craterGradient = ctx.createRadialGradient(
        wrappedX - craterWidth * 0.18,
        y - craterHeight * 0.2,
        craterWidth * 0.08,
        wrappedX,
        y,
        craterWidth,
      );
      craterGradient.addColorStop(0, alphaColor('#ffae73', 0.1));
      craterGradient.addColorStop(0.34, alphaColor('#ff9864', 0.125));
      craterGradient.addColorStop(0.78, alphaColor('#c3653b', 0.25));
      craterGradient.addColorStop(1, alphaColor('#b45b35', 0));

      ctx.save();
      ctx.translate(wrappedX, y);
      ctx.rotate(rotation);
      ctx.fillStyle = craterGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, craterWidth, craterHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  for (const pool of LAVA_POOLS) {
    const x = pool.u * width;
    const y = pool.v * height;
    const poolWidth = width * pool.width;
    const poolHeight = height * pool.height;

    withWrappedX(width, x, (wrappedX) => {
      ctx.fillStyle = alphaColor('#ffb347', pool.alpha);
      ctx.beginPath();
      ctx.ellipse(wrappedX, y, poolWidth, poolHeight, pool.rotation, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = alphaColor('#ff6f45', pool.alpha + 0.015);
      ctx.beginPath();
      ctx.ellipse(wrappedX, y, poolWidth * 0.56, poolHeight * 0.54, pool.rotation, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = alphaColor('#ffc792', pool.alpha * 0.09);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(
        wrappedX,
        y,
        poolWidth * 1.04,
        poolHeight,
        pool.rotation,
        Math.PI * 1.08,
        Math.PI * 1.72,
      );
      ctx.stroke();
    });
  }

  for (let i = 0; i < 26; i++) {
    const startX = ((i * 0.093 + 0.07) % 1) * width;
    const startY = (((i * 0.147 + 0.19) % 1) * 0.74 + 0.12) * height;
    const length = width * (0.05 + (i % 4) * 0.012);
    const endX = startX + length;
    const endY = startY + height * (0.012 - (i % 3) * 0.01);

    ctx.strokeStyle = alphaColor('#7a3f24', 0.08 + (i % 3) * 0.018);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + length * 0.5, (startY + endY) * 0.5);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  for (let i = 0; i < 28; i++) {
    const x = ((i * 0.173 + 0.09) % 1) * width;
    const y = (((i * 0.281 + 0.11) % 1) * 0.78 + 0.1) * height;
    const ember = width * (0.009 + (i % 3) * 0.003);

    ctx.fillStyle = alphaColor('#7a3f24', 0.08 + (i % 2) * 0.025);
    ctx.beginPath();
    ctx.moveTo(x, y - ember * 0.8);
    ctx.lineTo(x + ember * 0.9, y);
    ctx.lineTo(x, y + ember * 0.8);
    ctx.lineTo(x - ember * 0.9, y);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawLavaSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const texture = getLavaTexture(planet);
  drawFlatTextureOnSphere(ctx, texture, radius, planet.rotation * 0.12);
}

export function getLavaTexture(planet: Planet): HTMLCanvasElement {
  return getFlatPlanetTexture(`lava-flat|${planet.color}`, 768, 384, planet, paintFlatLavaTexture);
}

export function drawLavaCrescent(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.save();
  ctx.rotate(0.22 + Math.PI);

  const crescentFill = ctx.createLinearGradient(
    -radius * 1.08,
    -radius * 1.02,
    radius * 0.16,
    radius * 0.94,
  );
  crescentFill.addColorStop(0, alphaColor('#ffb16b', 0.36));
  crescentFill.addColorStop(0.24, alphaColor('#ff8a54', 0.2));
  crescentFill.addColorStop(0.56, alphaColor('#ff6a3a', 0.08));
  crescentFill.addColorStop(1, alphaColor('#ff6a3a', 0));

  ctx.fillStyle = crescentFill;
  ctx.beginPath();
  ctx.arc(-radius * 0.02, -radius * 0.02, radius * 1.04, 0, Math.PI * 2);
  ctx.arc(radius * 0.64, radius * 0.12, radius * 0.82, 0, Math.PI * 2, true);
  ctx.fill('evenodd');

  ctx.strokeStyle = alphaColor('#ffd7aa', 0.16);
  ctx.lineWidth = radius * 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(
    -radius * 0.03,
    -radius * 0.03,
    radius * 1.01,
    radius * 1.03,
    0,
    Math.PI * 0.9,
    Math.PI * 1.82,
  );
  ctx.stroke();

  ctx.restore();
}
