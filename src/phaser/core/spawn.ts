import Phaser from 'phaser';

import { circlesOverlap } from './collision';
import type { Vector, WorldSize } from './types';
import { wrappedDelta } from '../world/geometry';

export type SpawnCircle = {
  position: Vector;
  radius: number;
};

export type DistanceMode =
  | { type: 'direct' }
  | { type: 'wrapped'; world: WorldSize };

export function spawnCirclesOverlap(
  left: SpawnCircle,
  right: SpawnCircle,
  padding = 0,
  distance: DistanceMode = { type: 'direct' },
): boolean {
  return circlesOverlap(
    getSpawnDistance(left.position, right.position, distance),
    left.radius,
    right.radius + padding,
  );
}

export function overlapsAnySpawnCircle(
  circle: SpawnCircle,
  reservations: SpawnCircle[],
  padding = 0,
  distance: DistanceMode = { type: 'direct' },
): boolean {
  return reservations.some((reservation) =>
    spawnCirclesOverlap(circle, reservation, padding, distance),
  );
}

export function chooseSpawnPoint(input: {
  attempts: number;
  createCandidate: () => Vector;
  fallback: Vector;
  isAllowed: (candidate: Vector) => boolean;
}): Vector {
  for (let attempt = 0; attempt < input.attempts; attempt += 1) {
    const candidate = input.createCandidate();
    if (input.isAllowed(candidate)) return candidate;
  }
  return input.fallback;
}

export function randomPointInRect(input: {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}): Vector {
  return {
    x: Phaser.Math.Between(input.minX, input.maxX),
    y: Phaser.Math.Between(input.minY, input.maxY),
  };
}

export function getSpawnDistance(from: Vector, to: Vector, distance: DistanceMode = { type: 'direct' }): number {
  if (distance.type === 'wrapped') {
    const delta = wrappedDelta(from, to, distance.world);
    return Math.hypot(delta.x, delta.y);
  }
  return Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
}
