import Phaser from 'phaser';

import { ASTEROIDS, createAsteroid } from '../../asteroids/logic';
import type { AsteroidEntity, AsteroidTier } from '../../asteroids/types';
import {
  spawnCirclesOverlap as coreSpawnCirclesOverlap,
  overlapsAnySpawnCircle,
  type SpawnCircle,
} from '../../core/spawn';
import type { Vector, WorldSize } from '../../core/types';
import { PLAYER_COLLISION_RADIUS } from '../../player/config';
import { getBlackHoleRenderRadius } from '../../projectiles/blackHoles';
import type { ProjectileEntity } from '../../projectiles/types';

export type ArcadeSpawnCircle = SpawnCircle;

const ASTEROID_ATTEMPTS = 80;
const PLAYER_ATTEMPTS = 40;
const PLAYER_SAFE_RADIUS = PLAYER_COLLISION_RADIUS + 80;
const ASTEROID_PADDING = 30;

export function getPlayerSpawnCircle(position: Vector): ArcadeSpawnCircle {
  return { position, radius: PLAYER_SAFE_RADIUS };
}

export function chooseSafePlayerPosition(asteroids: AsteroidEntity[], world: WorldSize): Vector {
  return chooseSafePlayerPositionWithExclusions(asteroids, world, []);
}

export function chooseSafePlayerPositionWithExclusions(
  asteroids: AsteroidEntity[],
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[],
): Vector {
  const fallback = { x: world.width * 0.5, y: world.height * 0.5 };
  const reservations = [...getAsteroidCircles(asteroids), ...exclusions];
  for (let attempt = 0; attempt < PLAYER_ATTEMPTS; attempt += 1) {
    const candidate = {
      x: Phaser.Math.Between(32, Math.max(32, world.width - 32)),
      y: Phaser.Math.Between(32, Math.max(32, world.height - 32)),
    };
    if (!overlapsAnySpawnCircle(getPlayerSpawnCircle(candidate), reservations, 0)) {
      return candidate;
    }
  }
  return fallback;
}

export function getBlackHoleSpawnExclusions(projectiles: ProjectileEntity[]): ArcadeSpawnCircle[] {
  return projectiles
    .filter(
      (projectile) => projectile.kind === 'blackHole' && projectile.collapseStartedAt === null,
    )
    .map((projectile) => ({
      position: projectile.position,
      radius: getBlackHoleRenderRadius(projectile) + PLAYER_COLLISION_RADIUS + 80,
    }));
}

export function createSafeWaveAsteroids(
  wave: number,
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[] = [],
): AsteroidEntity[] {
  const asteroids: AsteroidEntity[] = [];
  for (let index = 0; index < wave + 2; index += 1) {
    const tier = chooseWaveTier(wave);
    const reservations = [...exclusions, ...getAsteroidCircles(asteroids)];
    asteroids.push(createSafeWaveAsteroid(tier, world, reservations));
  }
  return asteroids;
}

export function spawnCirclesOverlap(
  left: ArcadeSpawnCircle,
  right: ArcadeSpawnCircle,
  padding = 0,
): boolean {
  return coreSpawnCirclesOverlap(left, right, padding);
}

function createSafeWaveAsteroid(
  tier: AsteroidTier,
  world: WorldSize,
  reservations: ArcadeSpawnCircle[],
): AsteroidEntity {
  for (let attempt = 0; attempt < ASTEROID_ATTEMPTS; attempt += 1) {
    const asteroid = createWaveAsteroid(tier, world);
    const circle = {
      position: asteroid.position,
      radius: ASTEROIDS[asteroid.tier].collisionRadius,
    };
    if (!overlapsAnySpawnCircle(circle, reservations, ASTEROID_PADDING)) {
      return asteroid;
    }
  }
  return createWaveAsteroid(tier, world);
}

function createWaveAsteroid(tier: AsteroidTier, world: WorldSize): AsteroidEntity {
  const config = ASTEROIDS[tier];
  const side = Phaser.Math.Between(0, 3);
  const position =
    side === 0
      ? { x: -config.radius, y: Math.random() * world.height }
      : side === 1
        ? { x: world.width + config.radius, y: Math.random() * world.height }
        : side === 2
          ? { x: Math.random() * world.width, y: -config.radius }
          : { x: Math.random() * world.width, y: world.height + config.radius };
  const centerAngle = Math.atan2(world.height * 0.5 - position.y, world.width * 0.5 - position.x);
  const angle = centerAngle + Phaser.Math.FloatBetween(-Math.PI * 0.5, Math.PI * 0.5);
  const speed = config.speed * Phaser.Math.FloatBetween(0.8, 1.2);
  return createAsteroid(tier, position, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
}

function getAsteroidCircles(asteroids: AsteroidEntity[]): ArcadeSpawnCircle[] {
  return asteroids.map((asteroid) => ({
    position: asteroid.position,
    radius: ASTEROIDS[asteroid.tier].collisionRadius,
  }));
}

function chooseWaveTier(wave: number): AsteroidTier {
  const roll = Math.random();
  const megaChance = Math.min(0.15, wave * 0.02);
  const bigChance = Math.min(0.4, wave * 0.05);
  if (wave >= 10 && roll < megaChance) return 'mega';
  if (wave >= 5 && roll < megaChance + bigChance) return 'big';
  if (wave >= 3 && roll < megaChance + bigChance + 0.3) return 'medium';
  return 'small';
}
