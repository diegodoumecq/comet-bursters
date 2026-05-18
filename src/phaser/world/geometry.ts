import type { Vector, WorldSize } from '../core/types';

export function wrapPoint(point: Vector, world: WorldSize): void {
  if (point.x < 0) point.x += world.width;
  if (point.x > world.width) point.x -= world.width;
  if (point.y < 0) point.y += world.height;
  if (point.y > world.height) point.y -= world.height;
}

export function wrappedDelta(from: Vector, to: Vector, world: WorldSize): Vector {
  let x = to.x - from.x;
  let y = to.y - from.y;
  if (x > world.width * 0.5) x -= world.width;
  if (x < -world.width * 0.5) x += world.width;
  if (y > world.height * 0.5) y -= world.height;
  if (y < -world.height * 0.5) y += world.height;
  return { x, y };
}

export function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 };
}
