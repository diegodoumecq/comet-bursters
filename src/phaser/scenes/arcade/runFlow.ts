import Phaser from 'phaser';

import { ASTEROIDS } from '../../asteroids/logic';
import type { AsteroidEntity } from '../../asteroids/types';
import { circlesOverlap } from '../../core/collision';
import type { Vector, WorldSize } from '../../core/types';
import { PLAYER_COLLISION_RADIUS } from '../../player/config';

export const RESPAWN_DELAY_MS = 1800;

export function getNextWaveState(asteroidCount: number, wave: number, waveClearAt: number, now: number): {
  shouldSpawn: boolean;
  wave: number;
  waveClearAt: number;
} {
  if (asteroidCount > 0) return { shouldSpawn: false, wave, waveClearAt: 0 };
  if (waveClearAt === 0) return { shouldSpawn: false, wave, waveClearAt: now };
  if (now - waveClearAt < 1200) return { shouldSpawn: false, wave, waveClearAt };
  return { shouldSpawn: true, wave: wave + 1, waveClearAt: 0 };
}

export function chooseSafePlayerPosition(asteroids: AsteroidEntity[], world: WorldSize): Vector {
  const fallback = { x: world.width * 0.5, y: world.height * 0.5 };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = {
      x: Phaser.Math.Between(32, Math.max(32, world.width - 32)),
      y: Phaser.Math.Between(32, Math.max(32, world.height - 32)),
    };
    const blocked = asteroids.some((asteroid) =>
      circlesOverlap(
        Phaser.Math.Distance.Between(
          candidate.x,
          candidate.y,
          asteroid.position.x,
          asteroid.position.y,
        ),
        PLAYER_COLLISION_RADIUS + 80,
        ASTEROIDS[asteroid.tier].collisionRadius,
      ),
    );
    if (!blocked) return candidate;
  }
  return fallback;
}
