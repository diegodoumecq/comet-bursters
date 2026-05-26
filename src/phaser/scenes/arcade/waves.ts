import type { AsteroidEntity } from '../../asteroids/types';
import type { WorldSize } from '../../core/types';
import { createSafeWaveAsteroids, type ArcadeSpawnCircle } from './arcadeSpawns';

export function createWaveAsteroids(
  wave: number,
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[] = [],
): AsteroidEntity[] {
  return createSafeWaveAsteroids(wave, world, exclusions);
}
