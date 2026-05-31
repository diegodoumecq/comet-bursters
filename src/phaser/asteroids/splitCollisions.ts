import type { AsteroidBodies } from './bodies';
import { ASTEROIDS } from './config';
import type { AsteroidEntity } from './types';

const SEPARATION_BUFFER = 6;

export function updateAsteroidSplitCollisions(
  asteroids: AsteroidEntity[],
  asteroidBodies: AsteroidBodies,
): void {
  const groups = getSplitGroups(asteroids);
  for (const siblings of groups.values()) {
    if (siblings.length < 2 || splitSiblingsAreSeparated(siblings)) {
      for (const asteroid of siblings) {
        asteroid.splitGroupId = undefined;
        asteroidBodies.syncCollisionFilter(asteroid);
      }
    }
  }
}

function getSplitGroups(asteroids: AsteroidEntity[]): Map<number, AsteroidEntity[]> {
  const groups = new Map<number, AsteroidEntity[]>();
  for (const asteroid of asteroids) {
    if (asteroid.splitGroupId !== undefined) {
      const siblings = groups.get(asteroid.splitGroupId);
      if (siblings) {
        siblings.push(asteroid);
      } else {
        groups.set(asteroid.splitGroupId, [asteroid]);
      }
    }
  }
  return groups;
}

function splitSiblingsAreSeparated(siblings: AsteroidEntity[]): boolean {
  for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < siblings.length; rightIndex += 1) {
      const left = siblings[leftIndex];
      const right = siblings[rightIndex];
      const requiredDistance =
        ASTEROIDS[left.tier].collisionRadius +
        ASTEROIDS[right.tier].collisionRadius +
        SEPARATION_BUFFER;
      if (
        Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y) <
        requiredDistance
      ) {
        return false;
      }
    }
  }
  return true;
}
