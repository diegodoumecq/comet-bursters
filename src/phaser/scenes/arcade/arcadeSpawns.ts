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
export type ArcadeRift = {
  angle: number;
  durationMs: number;
  id: number;
  intensity: number;
  length: number;
  openedAt: number;
  position: Vector;
  releaseAt: number;
  width: number;
};

export type ArcadeRiftAsteroid = {
  asteroid: AsteroidEntity;
  id: number;
  intensity: number;
  normal: Vector;
  releaseAt: number;
  riftId: number;
};

export type ArcadeRiftAsteroidEvent = {
  asteroids: ArcadeRiftAsteroid[];
  rifts: ArcadeRift[];
};

const ASTEROID_ATTEMPTS = 80;
const PLAYER_ATTEMPTS = 40;
const RIFT_ATTEMPTS = 80;
const RIFT_DURATION_MS = 2600;
const RIFT_RELEASE_DELAY_MS = 500;
const RIFT_EDGE_MARGIN = 140;
const PLAYER_SAFE_RADIUS = PLAYER_COLLISION_RADIUS + 80;
const ASTEROID_PADDING = 30;
const RIFT_SLOT_MARGIN = 8;
const RIFT_EXIT_MARGIN = 8;

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
  return createRiftAsteroidEvent(wave, world, exclusions, 0, 0).asteroids.map(
    (pending) => pending.asteroid,
  );
}

export function createRiftAsteroidEvent(
  intensity: number,
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[] = [],
  eventId = 0,
  openedAt = 0,
): ArcadeRiftAsteroidEvent {
  const asteroids: ArcadeRiftAsteroid[] = [];
  const rifts = createRifts(intensity, world, exclusions, eventId, openedAt);
  const riftSlots = new Map<number, number>();
  for (let index = 0; index < intensity + 2; index += 1) {
    const tier = chooseWaveTier(intensity);
    const rift = rifts[index % rifts.length];
    const slot = riftSlots.get(rift.id) ?? 0;
    riftSlots.set(rift.id, slot + 1);
    const reservations = [...exclusions, ...asteroids.map((pending) => getAsteroidCircle(pending.asteroid))];
    const asteroid = createSafeRiftAsteroid(tier, rift, slot, reservations);
    asteroids.push({
      asteroid,
      id: asteroid.id,
      intensity,
      normal: getRiftNormal(rift),
      releaseAt: rift.releaseAt,
      riftId: rift.id,
    });
  }
  return { asteroids, rifts };
}

export function spawnCirclesOverlap(
  left: ArcadeSpawnCircle,
  right: ArcadeSpawnCircle,
  padding = 0,
): boolean {
  return coreSpawnCirclesOverlap(left, right, padding);
}

function createSafeRiftAsteroid(
  tier: AsteroidTier,
  rift: ArcadeRift,
  slot: number,
  reservations: ArcadeSpawnCircle[],
): AsteroidEntity {
  for (let attempt = 0; attempt < ASTEROID_ATTEMPTS; attempt += 1) {
    const asteroid = createRiftAsteroid(tier, rift, slot, attempt);
    const circle = {
      position: asteroid.position,
      radius: ASTEROIDS[asteroid.tier].collisionRadius,
    };
    if (!overlapsAnySpawnCircle(circle, reservations, ASTEROID_PADDING)) {
      return asteroid;
    }
  }
  return createRiftAsteroid(tier, rift, slot, ASTEROID_ATTEMPTS);
}

function createRiftAsteroid(
  tier: AsteroidTier,
  rift: ArcadeRift,
  slot: number,
  attempt: number,
): AsteroidEntity {
  const config = ASTEROIDS[tier];
  const normal = getRiftNormal(rift);
  const tangent = getRiftTangent(rift);
  const spacing =
    ASTEROIDS[getLargestLikelyWaveTier(rift.intensity)].collisionRadius * 2 +
    ASTEROID_PADDING +
    RIFT_SLOT_MARGIN;
  const maxOffset = Math.max(0, rift.length * 0.5 - config.collisionRadius * 0.5);
  const rawOffset = getRiftSlotOffset(slot + attempt, spacing);
  const offset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));
  const depth = config.radius + rift.width * 0.4 + RIFT_EXIT_MARGIN;
  const position = {
    x: rift.position.x - normal.x * depth + tangent.x * offset,
    y: rift.position.y - normal.y * depth + tangent.y * offset,
  };
  const angle = rift.angle + Phaser.Math.FloatBetween(-0.62, 0.62);
  const speed = config.speed * Phaser.Math.FloatBetween(0.8, 1.2);
  return createAsteroid(tier, position, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
}

function getRiftSlotOffset(slot: number, spacing: number): number {
  if (slot === 0) return 0;
  const side = slot % 2 === 1 ? -1 : 1;
  const ring = Math.ceil(slot / 2);
  return side * ring * spacing;
}

function createRifts(
  intensity: number,
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[],
  eventId: number,
  openedAt: number,
): ArcadeRift[] {
  const count = Math.min(2, 1 + Math.floor(Math.max(1, intensity) / 4));
  const rifts: ArcadeRift[] = [];
  for (let index = 0; index < count; index += 1) {
    const reservations = [
      ...exclusions,
      ...rifts.map((rift) => ({ position: rift.position, radius: getRiftSafetyRadius(rift) })),
    ];
    rifts.push(createRift(intensity, world, reservations, eventId, openedAt, index, count));
  }
  return rifts;
}

function createRift(
  intensity: number,
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[],
  eventId: number,
  openedAt: number,
  index: number,
  riftCount: number,
): ArcadeRift {
  const length = getRiftLength(intensity, riftCount);
  const width = 24 + Math.min(42, intensity * 2.6);
  const radius = Math.max(length, width) * 0.72 + ASTEROID_PADDING;
  const position = chooseRiftPosition(world, exclusions, radius, length);
  const angle = getRiftAngleFacingPlayfield(position, world);
  return {
    angle,
    durationMs: RIFT_DURATION_MS,
    id: eventId * 10 + index,
    intensity,
    length,
    openedAt,
    position,
    releaseAt: openedAt + RIFT_RELEASE_DELAY_MS,
    width,
  };
}

function getRiftLength(intensity: number, riftCount: number): number {
  const baseLength = 116 + Math.min(130, intensity * 11);
  const asteroidCount = intensity + 2;
  const asteroidsPerRift = Math.ceil(asteroidCount / Math.max(1, riftCount));
  const tier = getLargestLikelyWaveTier(intensity);
  const spacing = ASTEROIDS[tier].collisionRadius * 2 + ASTEROID_PADDING + RIFT_SLOT_MARGIN;
  return Math.max(baseLength, asteroidsPerRift * spacing + 80);
}

function getLargestLikelyWaveTier(intensity: number): AsteroidTier {
  if (intensity >= 10) return 'mega';
  if (intensity >= 5) return 'big';
  if (intensity >= 3) return 'medium';
  return 'small';
}

function chooseRiftPosition(
  world: WorldSize,
  exclusions: ArcadeSpawnCircle[],
  radius: number,
  length: number,
): Vector {
  const horizontalMargin = Math.min(world.width * 0.5, RIFT_EDGE_MARGIN + length * 0.5);
  for (let attempt = 0; attempt < RIFT_ATTEMPTS; attempt += 1) {
    const candidate = {
      x: Phaser.Math.FloatBetween(horizontalMargin, Math.max(horizontalMargin, world.width - horizontalMargin)),
      y: Phaser.Math.FloatBetween(RIFT_EDGE_MARGIN, Math.max(RIFT_EDGE_MARGIN, world.height - RIFT_EDGE_MARGIN)),
    };
    if (!overlapsAnySpawnCircle({ position: candidate, radius }, exclusions, ASTEROID_PADDING)) {
      return candidate;
    }
  }
  return createFallbackRiftPosition(world);
}

function getRiftAngleFacingPlayfield(position: Vector, world: WorldSize): number {
  return Math.atan2(world.height * 0.5 - position.y, world.width * 0.5 - position.x);
}

function createFallbackRiftPosition(world: WorldSize): Vector {
  const side = Phaser.Math.Between(0, 3);
  return side === 0
    ? { x: RIFT_EDGE_MARGIN, y: world.height * 0.5 }
    : side === 1
      ? { x: world.width - RIFT_EDGE_MARGIN, y: world.height * 0.5 }
      : side === 2
        ? { x: world.width * 0.5, y: RIFT_EDGE_MARGIN }
        : { x: world.width * 0.5, y: world.height - RIFT_EDGE_MARGIN };
}

function getRiftNormal(rift: ArcadeRift): Vector {
  return { x: Math.cos(rift.angle), y: Math.sin(rift.angle) };
}

function getRiftTangent(rift: ArcadeRift): Vector {
  const normal = getRiftNormal(rift);
  return { x: -normal.y, y: normal.x };
}

function getRiftSafetyRadius(rift: ArcadeRift): number {
  const tier = getLargestLikelyWaveTier(rift.intensity);
  const asteroid = ASTEROIDS[tier];
  const depth = asteroid.radius + rift.width * 0.4 + RIFT_EXIT_MARGIN;
  const reach = Math.hypot(rift.length * 0.5, depth);
  return reach + asteroid.collisionRadius + ASTEROID_PADDING;
}

function getAsteroidCircle(asteroid: AsteroidEntity): ArcadeSpawnCircle {
  return {
    position: asteroid.position,
    radius: ASTEROIDS[asteroid.tier].collisionRadius,
  };
}

function getAsteroidCircles(asteroids: AsteroidEntity[]): ArcadeSpawnCircle[] {
  return asteroids.map(getAsteroidCircle);
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
