import type { Planet } from '@/constants';

import { drawFlatTextureOnSphere, getFlatPlanetTexture } from '../planetTextureEngine';
import { alphaColor } from './shared';

function withWrappedX(width: number, x: number, draw: (wrappedX: number) => void): void {
  draw(x);

  if (x < width * 0.16) {
    draw(x + width);
  } else if (x > width * 0.84) {
    draw(x - width);
  }
}

function drawCrackBranch(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  baseLength: number,
  direction: number,
  branchDepth: number,
  branchBias: number,
): void {
  const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
  let x = startX;
  let y = startY;
  let heading = direction;

  for (let segment = 0; segment < 4; segment++) {
    const length = baseLength * (1 - segment * 0.08);
    heading +=
      Math.sin(startX * 0.013 + startY * 0.02 + branchBias * 1.7 + segment * 0.91) *
      (0.14 + branchDepth * 0.05 + Math.abs(branchBias) * 0.04);
    x += Math.cos(heading) * length;
    y += Math.sin(heading) * length;
    points.push({ x, y });
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const next = points[i + 1];
    const controlX = (points[i].x + next.x) * 0.5;
    const controlY = (points[i].y + next.y) * 0.5;
    ctx.quadraticCurveTo(points[i].x, points[i].y, controlX, controlY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  if (branchDepth >= 2) {
    return;
  }

  const branchPoint = points[Math.min(points.length - 2, 1 + ((branchDepth + points.length) % 2))];
  const forkLength = baseLength * (0.68 + branchBias * 0.12 - branchDepth * 0.07);
  const split = (branchDepth === 0 ? 1 : -1) * (0.44 + branchBias * 0.34);

  drawCrackBranch(
    ctx,
    branchPoint.x,
    branchPoint.y,
    forkLength,
    heading + split,
    branchDepth + 1,
    branchBias * 0.74,
  );

  if (branchDepth === 0 && Math.abs(branchBias) > 0.2) {
    drawCrackBranch(
      ctx,
      branchPoint.x,
      branchPoint.y,
      forkLength * (0.68 + Math.abs(branchBias) * 0.16),
      heading - split * 0.8,
      branchDepth + 1,
      -branchBias * 0.58,
    );
  }
}

function drawCrackCluster(
  ctx: CanvasRenderingContext2D,
  width: number,
  x: number,
  y: number,
  length: number,
  direction: number,
  branchBias: number,
  shadowAlpha: number,
  rimAlpha: number,
  lineWidth: number,
): void {
  withWrappedX(width, x, (wrappedX) => {
    ctx.strokeStyle = alphaColor('#c7774a', shadowAlpha);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawCrackBranch(ctx, wrappedX, y, length, direction, 0, branchBias);

    ctx.strokeStyle = alphaColor('#efb07a', rimAlpha);
    ctx.lineWidth = Math.max(0.7, lineWidth * 0.28);
    drawCrackBranch(
      ctx,
      wrappedX - width * 0.0012,
      y - width * 0.0006,
      length * 0.99,
      direction,
      0,
      branchBias,
    );
  });
}

function paintFlatDesertTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
): void {
  ctx.clearRect(0, 0, width, height);

  const duneWash = ctx.createLinearGradient(0, 0, width, height);
  duneWash.addColorStop(0, alphaColor('#f0c46f', 0.18));
  duneWash.addColorStop(0.42, alphaColor('#c88832', 0.12));
  duneWash.addColorStop(1, alphaColor('#8a5525', 0));
  ctx.fillStyle = duneWash;
  ctx.fillRect(0, 0, width, height);

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 9; i++) {
      const y = ((i + 1 + pass * 0.5) / 10) * height;
      const isBright = (i + pass) % 2 === 0;
      ctx.strokeStyle = alphaColor(
        isBright ? '#fff0b8' : '#c88832',
        pass === 0 ? (i === 4 ? 0.16 : 0.12) : (isBright ? 0.09 : 0.075),
      );
      ctx.lineWidth = pass === 0 ? 3 + (i % 3) : 2 + (i % 2);
      ctx.beginPath();
      for (let x = 0; x <= width; x += width / 14) {
        const wave =
          Math.sin(
            (x / width) * Math.PI * 2 +
              planet.rotation * (pass === 0 ? 0.06 : 0.068) +
              i * 0.72 +
              pass * 0.44,
          ) *
            height *
            (pass === 0 ? 0.05 : 0.038) +
          Math.cos((x / width) * Math.PI * 5 + i * 0.18 + pass * 0.36) *
            height *
            (pass === 0 ? 0.014 : 0.011);
        if (x === 0) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }
  }

  for (let i = 0; i < 22; i++) {
    const x = ((i * 0.131 + 0.09) % 1) * width;
    const y = (((i * 0.217 + 0.15) % 1) * 0.78 + 0.1) * height;
    const w = width * (0.022 + (i % 4) * 0.008);
    const h = height * (0.02 + (i % 3) * 0.006);

    ctx.fillStyle = alphaColor(i % 2 === 0 ? '#b87436' : '#d0944a', 0.1);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.58, y - h * 0.1);
    ctx.bezierCurveTo(x - w * 0.4, y - h, x - w * 0.08, y - h * 0.94, x + w * 0.14, y - h * 0.22);
    ctx.bezierCurveTo(x + w * 0.46, y + h * 0.18, x + w * 0.32, y + h * 0.92, x - w * 0.06, y + h * 0.7);
    ctx.bezierCurveTo(x - w * 0.44, y + h * 0.48, x - w * 0.7, y + h * 0.12, x - w * 0.58, y - h * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 28; i++) {
    const x = ((i * 0.097 + 0.04) % 1) * width;
    const y = (((i * 0.173 + 0.07) % 1) * 0.8 + 0.08) * height;
    const size = width * (0.008 + (i % 3) * 0.003);

    ctx.fillStyle = alphaColor(i % 3 === 0 ? '#b57a3f' : '#d7a85a', 0.1);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.9, y - size * 0.18);
    ctx.lineTo(x + size * 0.38, y - size * 0.96);
    ctx.lineTo(x - size * 0.24, y - size * 0.72);
    ctx.lineTo(x - size * 0.88, y - size * 0.08);
    ctx.lineTo(x - size * 0.7, y + size * 0.62);
    ctx.lineTo(x - size * 0.08, y + size * 0.92);
    ctx.lineTo(x + size * 0.7, y + size * 0.42);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 16; i++) {
    const x = ((i * 0.173 + 0.07) % 1) * width;
    const y = (((i * 0.227 + 0.12) % 1) * 0.82 + 0.08) * height;
    const length = width * (0.03 + (i % 4) * 0.01 + (i % 5 === 0 ? 0.014 : 0));
    const direction = -1.05 + (i % 6) * 0.37 + (i % 2 === 0 ? -0.08 : 0.06);
    const branchBias = -0.85 + (i % 7) * 0.29;
    const shadowAlpha = 0.17 + (i % 3) * 0.035;
    const rimAlpha = 0.026 + (i % 2) * 0.012;
    const lineWidth = 1.75 + (i % 4) * 0.24;

    drawCrackCluster(
      ctx,
      width,
      x,
      y,
      length,
      direction,
      branchBias,
      shadowAlpha,
      rimAlpha,
      lineWidth,
    );
  }

  for (let i = 0; i < 18; i++) {
    const startX = ((i * 0.143 + 0.03) % 1) * width;
    const startY = (((i * 0.197 + 0.21) % 1) * 0.9 + 0.05) * height;
    const midX = startX + width * (0.02 + (i % 3) * 0.009);
    const endX = midX + width * (0.016 + (i % 4) * 0.006);
    const endY = startY + height * (0.007 - (i % 3) * 0.01);

    ctx.strokeStyle = alphaColor('#cf8354', 0.08 + (i % 3) * 0.018);
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(midX, startY + (endY - startY) * 0.35);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

export function drawDesertSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const texture = getFlatPlanetTexture(
    `desert-flat|${planet.color}`,
    768,
    384,
    planet,
    paintFlatDesertTexture,
  );
  drawFlatTextureOnSphere(ctx, texture, radius, planet.rotation * 0.12);
}
