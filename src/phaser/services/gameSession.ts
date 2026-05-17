import Phaser from 'phaser';

import type { AsteroidEntity, Vector, WorldSize } from '../model';
import { ASTEROIDS } from './asteroids';
import { GameWorld } from './gameWorld';
import { PlayerState } from './playerState';

export const RESPAWN_DELAY_MS = 1800;

export class GameSession {
  readonly world: GameWorld;
  readonly player = new PlayerState();
  wave: number;
  score = 0;
  lives = 3;
  waveClearAt = 0;

  constructor(startingWave: number) {
    this.world = new GameWorld();
    this.wave = startingWave;
  }

  get playerAlive(): boolean {
    return this.player.respawnAt === 0 && this.lives > 0;
  }

  awardAsteroidScore(points: number): void {
    this.score += points * this.lives;
  }

  destroyPlayer(now: number): void {
    this.lives -= 1;
    this.player.destroy(now);
  }

  shouldRespawn(now: number): boolean {
    return this.lives > 0 && this.player.respawnAt !== 0 && now >= this.player.respawnAt;
  }

  advanceWave(now: number): boolean {
    const state = getNextWaveState(this.world.asteroids.length, this.wave, this.waveClearAt, now);
    this.wave = state.wave;
    this.waveClearAt = state.waveClearAt;
    return state.shouldSpawn;
  }
}

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
      Phaser.Math.Distance.Between(candidate.x, candidate.y, asteroid.body.x, asteroid.body.y) <=
        18 + ASTEROIDS[asteroid.tier].collisionRadius + 80,
    );
    if (!blocked) return candidate;
  }
  return fallback;
}
