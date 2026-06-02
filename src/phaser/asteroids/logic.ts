import Phaser from 'phaser';

import type { RandomSource } from '../core/random';
import type { Vector, WorldSize } from '../core/types';
import type { AsteroidBodies } from './bodies';
import { ASTEROIDS } from './config';
import { ASTEROID_TEXTURES } from './textures';
import type { AsteroidEntity, AsteroidTier } from './types';

export { ASTEROIDS };

let nextAsteroidId = 1;
let nextSplitGroupId = 1;

const SPLIT_SEPARATION_SPEED_SCALE = 0.32;

export function wrapAsteroid(
  asteroid: AsteroidEntity,
  runtime: AsteroidBodies,
  world: WorldSize,
): void {
  const radius = ASTEROIDS[asteroid.tier].radius;
  const body = runtime.get(asteroid);
  if (body.x < -radius) body.x = world.width + radius;
  if (body.x > world.width + radius) body.x = -radius;
  if (body.y < -radius) body.y = world.height + radius;
  if (body.y > world.height + radius) body.y = -radius;
}

export function createAsteroid(
  tier: AsteroidTier,
  position: Vector,
  velocity: Vector,
  random: RandomSource = phaserRandom,
): AsteroidEntity {
  const config = ASTEROIDS[tier];
  const visualVariant = random.between(0, ASTEROID_TEXTURES[tier].length - 1);
  return {
    angularVelocity: random.floatBetween(-0.025, 0.025),
    id: nextAsteroidId++,
    hits: config.hits,
    membership: { space: 'arcade' },
    position,
    rotation: random.floatBetween(0, Math.PI * 2),
    tier,
    velocity,
    visualVariant,
  };
}

const phaserRandom: RandomSource = {
  between: (min, max) => Phaser.Math.Between(min, max),
  float: () => Math.random(),
  floatBetween: (min, max) => Phaser.Math.FloatBetween(min, max),
  pick: (items) => items[Phaser.Math.Between(0, items.length - 1)],
};

export function splitAsteroid(asteroid: AsteroidEntity): AsteroidEntity[] {
  const config = ASTEROIDS[asteroid.tier];
  if (!config.child) return [];
  const childConfig = ASTEROIDS[config.child];
  const inherited = asteroid.velocity;
  const children: AsteroidEntity[] = [];
  const splitGroupId = asteroid.splitGroupId ?? nextSplitGroupId;
  if (asteroid.splitGroupId === undefined) nextSplitGroupId += 1;
  for (let i = 0; i < config.splitCount; i += 1) {
    const angle = (Math.PI * 2 * i) / config.splitCount + Phaser.Math.FloatBetween(-0.35, 0.35);
    const speed =
      childConfig.speed * SPLIT_SEPARATION_SPEED_SCALE * Phaser.Math.FloatBetween(0.85, 1.15);
    const child = createAsteroid(
      config.child,
      { x: asteroid.position.x, y: asteroid.position.y },
      { x: inherited.x + Math.cos(angle) * speed, y: inherited.y + Math.sin(angle) * speed },
    );
    child.splitGroupId = splitGroupId;
    children.push(child);
  }
  return children;
}
