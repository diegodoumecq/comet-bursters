import type { Planet } from '@/constants';

import { drawFlatTextureOnSphere, getFlatPlanetTexture } from '../planetTextureEngine';
import { alphaColor } from './shared';

type CrystalFacet = {
  u: number;
  v: number;
  width: number;
  height: number;
  lean: number;
  rotation: number;
  fillAlpha: number;
  strokeAlpha: number;
};

const CRYSTAL_FACETS: readonly CrystalFacet[] = [
  { u: 0.08, v: 0.34, width: 0.08, height: 0.12, lean: -0.34, rotation: -0.42, fillAlpha: 0.18, strokeAlpha: 0.16 },
  { u: 0.14, v: 0.58, width: 0.09, height: 0.13, lean: 0.28, rotation: 0.2, fillAlpha: 0.16, strokeAlpha: 0.14 },
  { u: 0.22, v: 0.76, width: 0.07, height: 0.1, lean: -0.16, rotation: 0.52, fillAlpha: 0.14, strokeAlpha: 0.12 },
  { u: 0.3, v: 0.86, width: 0.08, height: 0.11, lean: 0.36, rotation: -0.24, fillAlpha: 0.12, strokeAlpha: 0.11 },
  { u: 0.38, v: 0.68, width: 0.08, height: 0.12, lean: -0.3, rotation: 0.34, fillAlpha: 0.16, strokeAlpha: 0.14 },
  { u: 0.46, v: 0.9, width: 0.07, height: 0.09, lean: 0.18, rotation: -0.48, fillAlpha: 0.11, strokeAlpha: 0.1 },
  { u: 0.54, v: 0.82, width: 0.08, height: 0.11, lean: -0.22, rotation: 0.18, fillAlpha: 0.12, strokeAlpha: 0.11 },
  { u: 0.62, v: 0.52, width: 0.07, height: 0.09, lean: 0.26, rotation: -0.36, fillAlpha: 0.1, strokeAlpha: 0.09 },
  { u: 0.7, v: 0.88, width: 0.08, height: 0.12, lean: 0.12, rotation: 0.44, fillAlpha: 0.12, strokeAlpha: 0.11 },
  { u: 0.78, v: 0.72, width: 0.07, height: 0.1, lean: -0.28, rotation: -0.14, fillAlpha: 0.11, strokeAlpha: 0.1 },
  { u: 0.84, v: 0.94, width: 0.06, height: 0.08, lean: 0.2, rotation: -0.12, fillAlpha: 0.08, strokeAlpha: 0.08 },
  { u: 0.9, v: 0.24, width: 0.06, height: 0.09, lean: -0.12, rotation: 0.3, fillAlpha: 0.09, strokeAlpha: 0.08 },
  { u: 0.94, v: 0.84, width: 0.06, height: 0.08, lean: 0.3, rotation: -0.38, fillAlpha: 0.08, strokeAlpha: 0.07 },
  { u: 0.98, v: 0.16, width: 0.06, height: 0.09, lean: -0.18, rotation: 0.12, fillAlpha: 0.08, strokeAlpha: 0.07 },
  { u: 0.04, v: 0.62, width: 0.05, height: 0.08, lean: 0.16, rotation: -0.3, fillAlpha: 0.08, strokeAlpha: 0.07 },
];

const CRYSTAL_ARC_BANDS: readonly [number, number, number, number, number][] = [
  [0.12, 0.34, 0.3, 0.16, 0.055],
  [0.22, 0.24, 0.24, 0.2, 0.05],
  [0.32, 0.16, 0.18, 0.3, 0.045],
  [0.42, 0.28, 0.2, 0.42, 0.05],
  [0.5, 0.18, 0.17, 0.08, 0.04],
  [0.58, 0.12, 0.15, 0.48, 0.04],
  [0.68, 0.2, 0.16, 0.26, 0.04],
  [0.76, 0.24, 0.14, 0.36, 0.035],
  [0.84, 0.26, 0.16, 0.12, 0.035],
  [0.92, 0.18, 0.13, 0.58, 0.032],
];

function withWrappedX(width: number, x: number, draw: (wrappedX: number) => void): void {
  draw(x);

  if (x < width * 0.15) {
    draw(x + width);
  } else if (x > width * 0.85) {
    draw(x - width);
  }
}

function drawFlatFacet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  lean: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x - width * 0.4, y - height * 0.42);
  ctx.lineTo(x + width * 0.18, y - height * 0.56);
  ctx.lineTo(x + width * (0.5 + lean * 0.22), y - height * 0.08);
  ctx.lineTo(x + width * (0.18 + lean * 0.36), y + height * 0.5);
  ctx.lineTo(x - width * (0.54 - lean * 0.16), y + height * 0.18);
  ctx.closePath();
}

function paintFlatCrystalTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
): void {
  ctx.clearRect(0, 0, width, height);

  const crystalPurple = '#ead8ff';
  const crystalPurpleBright = '#f7f1ff';

  const washGradient = ctx.createLinearGradient(0, 0, width, height);
  washGradient.addColorStop(0, alphaColor(crystalPurpleBright, 0.38));
  washGradient.addColorStop(0.45, alphaColor(crystalPurple, 0.2));
  washGradient.addColorStop(1, alphaColor(crystalPurple, 0));
  ctx.fillStyle = washGradient;
  ctx.fillRect(0, 0, width, height);

  const secondaryWash = ctx.createLinearGradient(0, height * 0.6, width, height * 0.2);
  secondaryWash.addColorStop(0, alphaColor(crystalPurpleBright, 0.24));
  secondaryWash.addColorStop(0.52, alphaColor(crystalPurple, 0.12));
  secondaryWash.addColorStop(1, alphaColor(crystalPurple, 0));
  ctx.fillStyle = secondaryWash;
  ctx.fillRect(0, 0, width, height);

  for (const [v, arc, alpha, phase, speed] of CRYSTAL_ARC_BANDS) {
    const y = v * height;
    const lineGradient = ctx.createLinearGradient(0, y, width, y);
    lineGradient.addColorStop(0, alphaColor('#ffffff', 0));
    lineGradient.addColorStop(0.2, alphaColor('#ffffff', alpha));
    lineGradient.addColorStop(0.52, alphaColor('#ffffff', alpha * 0.42));
    lineGradient.addColorStop(1, alphaColor('#ffffff', 0));
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);

    for (let x = 0; x <= width; x += width / 12) {
      const wave =
        Math.sin((x / width) * Math.PI * 2 + phase * Math.PI * 2 + planet.rotation * speed) *
          height * arc * 0.14 +
        Math.cos((x / width) * Math.PI * 4 + phase * 1.4) * height * 0.01;
      ctx.lineTo(x, y + wave);
    }

    ctx.stroke();
  }

  for (let i = 0; i < 12; i++) {
    const x = ((i * 0.083 + 0.06) % 1) * width;
    const y = (((i * 0.231 + 0.11) % 1) * 0.68 + 0.16) * height;
    const shard = width * (0.035 - (i % 4) * 0.003);

    withWrappedX(width, x, (wrappedX) => {
      const shardGradient = ctx.createLinearGradient(
        wrappedX - shard * 0.42,
        y - shard * 0.76,
        wrappedX + shard * 0.24,
        y + shard * 0.7,
      );
      shardGradient.addColorStop(0, alphaColor('#ffffff', 0.26));
      shardGradient.addColorStop(0.42, alphaColor('#d8f6ff', 0.11));
      shardGradient.addColorStop(1, alphaColor('#7ee7ff', 0));

      ctx.fillStyle = shardGradient;
      ctx.beginPath();
      ctx.moveTo(wrappedX, y - shard);
      ctx.lineTo(wrappedX + shard * 0.5, y - shard * 0.1);
      ctx.lineTo(wrappedX + shard * 0.22, y + shard * 0.76);
      ctx.lineTo(wrappedX - shard * 0.34, y + shard * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = alphaColor('#ffffff', 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wrappedX, y - shard * 0.82);
      ctx.lineTo(wrappedX + shard * 0.12, y + shard * 0.52);
      ctx.stroke();
    });
  }

  for (const facet of CRYSTAL_FACETS) {
    const x = facet.u * width;
    const y = facet.v * height;
    const facetWidth = width * facet.width;
    const facetHeight = height * facet.height;

    withWrappedX(width, x, (wrappedX) => {
      ctx.save();
      ctx.translate(wrappedX, y);
      ctx.rotate(facet.rotation);

      const facetGradient = ctx.createLinearGradient(
        -facetWidth * 0.55,
        -facetHeight * 0.4,
        facetWidth * 0.48,
        facetHeight * 0.52,
      );
      facetGradient.addColorStop(0, alphaColor('#ffffff', Math.max(0.16, facet.fillAlpha * 1.2)));
      facetGradient.addColorStop(0.34, alphaColor('#d8f6ff', Math.max(0.08, facet.fillAlpha * 0.62)));
      facetGradient.addColorStop(1, alphaColor('#7ee7ff', 0));

      drawFlatFacet(ctx, 0, 0, facetWidth, facetHeight, facet.lean);
      ctx.fillStyle = facetGradient;
      ctx.fill();

      ctx.strokeStyle = alphaColor('#ffffff', facet.strokeAlpha + 0.08);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-facetWidth * 0.1, -facetHeight * 0.42);
      ctx.lineTo(facetWidth * 0.12, facetHeight * 0.48);
      ctx.moveTo(facetWidth * 0.1, -facetHeight * 0.2);
      ctx.lineTo(-facetWidth * 0.28, facetHeight * 0.14);
      ctx.strokeStyle = alphaColor('#ffffff', facet.strokeAlpha * 0.62);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    });
  }

  for (let i = 0; i < 9; i++) {
    const x = ((i * 0.119 + 0.08) % 1) * width;
    const y = (((i * 0.177 + 0.17) % 1) * 0.7 + 0.14) * height;
    const lineWidth = width * Math.max(0.028, 0.08 - i * 0.006);

    ctx.strokeStyle = alphaColor('#baf6ff', 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - lineWidth * 0.5, y - height * 0.04);
    ctx.lineTo(x, y - height * 0.18);
    ctx.lineTo(x + lineWidth * 0.46, y + height * 0.02);
    ctx.lineTo(x - lineWidth * 0.08, y + height * 0.16);
    ctx.closePath();
    ctx.stroke();
  }

  for (let i = 0; i < 20; i++) {
    const startX = ((i * 0.097 + 0.05) % 1) * width;
    const startY = (((i * 0.163 + 0.09) % 1) * 0.72 + 0.12) * height;
    const length = width * (0.06 + (i % 3) * 0.018);
    const endX = startX + length;
    const endY = startY + height * (0.02 - (i % 2) * 0.018);

    ctx.strokeStyle = alphaColor('#ffffff', 0.18 + (i % 3) * 0.04);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + length * 0.5, (startY + endY) * 0.5);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  for (let i = 0; i < 20; i++) {
    const x = ((i * 0.173 + 0.09) % 1) * width;
    const y = (((i * 0.281 + 0.11) % 1) * 0.72 + 0.14) * height;
    const sparkle = width * (0.006 + (i % 3) * 0.002);

    ctx.fillStyle = alphaColor('#ffffff', 0.24 + (i % 2) * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, y - sparkle * 1.5);
    ctx.lineTo(x + sparkle * 0.52, y);
    ctx.lineTo(x, y + sparkle * 1.5);
    ctx.lineTo(x - sparkle * 0.52, y);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawCrystalSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const texture = getFlatPlanetTexture(
    `crystal-flat|${planet.color}`,
    768,
    384,
    planet,
    paintFlatCrystalTexture,
  );
  drawFlatTextureOnSphere(ctx, texture, radius, planet.rotation * 0.08);
}

export function drawCrystalCrescent(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.save();
  ctx.rotate(-0.34 + Math.PI);

  const crescentFill = ctx.createLinearGradient(
    -radius * 1.12,
    -radius * 1.04,
    radius * 0.18,
    radius * 0.96,
  );
  crescentFill.addColorStop(0, alphaColor('#ffffff', 0.48));
  crescentFill.addColorStop(0.22, alphaColor('#ffffff', 0.3));
  crescentFill.addColorStop(0.56, alphaColor('#ffffff', 0.1));
  crescentFill.addColorStop(1, alphaColor('#ffffff', 0));

  ctx.fillStyle = crescentFill;
  ctx.beginPath();
  ctx.arc(-radius * 0.02, -radius * 0.02, radius * 1.04, 0, Math.PI * 2);
  ctx.arc(radius * 0.66, radius * 0.12, radius * 0.82, 0, Math.PI * 2, true);
  ctx.fill('evenodd');

  ctx.strokeStyle = alphaColor('#ffffff', 0.2);
  ctx.lineWidth = radius * 0.055;
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
