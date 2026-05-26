import { splitAsteroid } from '../asteroids/logic';
import type { AsteroidEntity } from '../asteroids/types';
import { spawnAsteroidFuelDrops } from '../fuel/blobLogic';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import { createAsteroidExplosion } from './effects';

export type AsteroidDestructionResult = {
  children: AsteroidEntity[];
  fuelBlobs: FuelBlobEntity[];
  particles: ParticleEntity[];
};

export function destroyAsteroidWithWeapon(asteroid: AsteroidEntity): AsteroidDestructionResult {
  return {
    children: splitAsteroid(asteroid),
    fuelBlobs: spawnAsteroidFuelDrops(asteroid),
    particles: createAsteroidExplosion(asteroid, 1).particles,
  };
}
