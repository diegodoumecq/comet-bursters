import Phaser from 'phaser';

import { ASTEROIDS } from '../../asteroids/logic';
import type { AsteroidEntity } from '../../asteroids/types';
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

const PLAYER_ATTEMPTS = 40;
const PLAYER_SAFE_RADIUS = PLAYER_COLLISION_RADIUS + 80;

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

export function spawnCirclesOverlap(
  left: ArcadeSpawnCircle,
  right: ArcadeSpawnCircle,
  padding = 0,
): boolean {
  return coreSpawnCirclesOverlap(left, right, padding);
}

function getAsteroidCircles(asteroids: AsteroidEntity[]): ArcadeSpawnCircle[] {
  return asteroids.map((asteroid) => ({
    position: asteroid.position,
    radius: ASTEROIDS[asteroid.tier].collisionRadius,
  }));
}
