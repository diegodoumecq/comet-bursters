import type { Planet, PlanetKind } from '@/constants';

type PlanetShapeStyle = {
  mode: 'ellipse' | 'segments';
  xScale: number;
  yScale: number;
  segments?: number;
  variation?: number;
  rotationOffset?: number;
};

const PLANET_SHAPE_STYLES: Record<PlanetKind, PlanetShapeStyle> = {
  lush: {
    mode: 'ellipse',
    xScale: 1,
    yScale: 1,
    rotationOffset: 0,
  },
  desert: {
    mode: 'ellipse',
    xScale: 1,
    yScale: 1,
    rotationOffset: 0,
  },
  ice: {
    mode: 'ellipse',
    xScale: 1,
    yScale: 1,
    rotationOffset: 0,
  },
  lava: {
    mode: 'ellipse',
    xScale: 1,
    yScale: 1,
    rotationOffset: 0,
  },
  gas: {
    mode: 'ellipse',
    xScale: 1.035,
    yScale: 0.965,
    rotationOffset: -0.08,
  },
  toxic: {
    mode: 'ellipse',
    xScale: 1,
    yScale: 1,
    rotationOffset: 0,
  },
  crystal: {
    mode: 'segments',
    xScale: 1,
    yScale: 1,
    segments: 64,
    variation: 0.035,
    rotationOffset: 0.1,
  },
};

export function tracePlanetShape(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  radius: number,
  scale = 1,
): void {
  const style = PLANET_SHAPE_STYLES[planet.kind];
  const xRadius = radius * style.xScale * scale;
  const yRadius = radius * style.yScale * scale;
  const rotation = planet.rotation * 0.05 + (style.rotationOffset ?? 0);

  ctx.beginPath();

  if (style.mode === 'ellipse') {
    ctx.ellipse(0, 0, xRadius, yRadius, rotation, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }

  const segments = style.segments ?? 20;
  const variation = style.variation ?? 0.02;

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 2 + rotation;
    const altitude = planet.altitudeVariations[i % planet.altitudeVariations.length];
    const wobble =
      planet.kind === 'crystal'
        ? 0.985 + (altitude - 1) * 0.45 + ((i + 2) % 7 === 0 ? variation * 0.08 : 0)
        : 1 + (altitude - 1) * (variation * 10);
    const x = Math.cos(angle) * xRadius * wobble;
    const y = Math.sin(angle) * yRadius * wobble;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
}
