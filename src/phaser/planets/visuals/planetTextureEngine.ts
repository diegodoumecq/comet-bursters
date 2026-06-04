import type { PlanetSpriteSource as Planet } from '../types';

type SurfacePainter = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
) => void;

function normalizeRotation(rotation: number): number {
  const fullTurn = Math.PI * 2;
  const normalized = rotation % fullTurn;
  return normalized < 0 ? normalized + fullTurn : normalized;
}

export function drawSurfacePainterOnPlanet(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
  painter: SurfacePainter,
  radius: number,
  rotation: number,
): void {
  const diameter = radius * 2;
  const normalizedRotation = normalizeRotation(rotation);
  const painterCtx = createNoClearContext(ctx);

  ctx.save();
  ctx.rotate(normalizedRotation);
  ctx.translate(-radius, -radius);
  ctx.scale(diameter / width, diameter / height);
  painter(painterCtx, width, height, planet);
  ctx.restore();
}

function createNoClearContext(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return new Proxy(ctx, {
    get(target, property) {
      if (property === 'clearRect') {
        return () => {};
      }
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property, value) {
      return Reflect.set(target, property, value);
    },
  }) as CanvasRenderingContext2D;
}
