import type { AsteroidEntity } from '../../asteroids/types';
import type { WorldSize } from '../../core/types';
import {
  createRiftAsteroidEvent,
  createSafeWaveAsteroids,
  type ArcadeRiftAsteroidEvent,
  type ArcadeSpawnCircle,
} from './arcadeSpawns';

export function createWaveAsteroids(
  wave: number,
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[] = [],
): AsteroidEntity[] {
  return createSafeWaveAsteroids(wave, world, exclusions);
}

export function createWaveRiftEvent(
  intensity: number,
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[] = [],
  eventId = 0,
  openedAt = 0,
): ArcadeRiftAsteroidEvent {
  return createRiftAsteroidEvent(intensity, world, exclusions, eventId, openedAt);
}
