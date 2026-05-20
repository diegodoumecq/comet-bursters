import type { Vector, WorldSize } from '../core/types';

export function getToroidalOffsets(position: Vector, radius: number, world: WorldSize): Vector[] {
  const xOffsets: number[] = [0];
  const yOffsets: number[] = [0];
  if (position.x - radius < 0) xOffsets.push(world.width);
  if (position.x + radius > world.width) xOffsets.push(-world.width);
  if (position.y - radius < 0) yOffsets.push(world.height);
  if (position.y + radius > world.height) yOffsets.push(-world.height);

  const offsets: Vector[] = [];
  for (const x of xOffsets) {
    for (const y of yOffsets) {
      if (x !== 0 || y !== 0) offsets.push({ x, y });
    }
  }
  return offsets;
}

export function wrapCoordinate(value: number, size: number): number {
  if (value < 0) return value + size;
  if (value > size) return value - size;
  return value;
}
