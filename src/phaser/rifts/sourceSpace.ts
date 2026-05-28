import Phaser from 'phaser';

import { ASTEROIDS, createAsteroid } from '../asteroids/logic';
import type { AsteroidEntity, AsteroidTier } from '../asteroids/types';
import type { SpawnCircle } from '../core/spawn';
import { overlapsAnySpawnCircle } from '../core/spawn';
import type { Vector, WorldSize } from '../core/types';
import {
  RIFT_ASTEROID_SPAWN_RADIUS,
  RIFT_ASTEROID_SPEED_SCALE,
  RIFT_CLOSE_DURATION_MS,
  RIFT_DEEP_INSIDE_CULL_MARGIN,
  RIFT_DURATION_MS,
  RIFT_EDGE_MARGIN,
  RIFT_MOVE_START_OPEN_PROGRESS,
  RIFT_OPEN_DURATION_MS,
  RIFT_PORTAL_RADIUS_X,
  RIFT_PORTAL_RADIUS_Y,
  RIFT_PORTAL_VISIBILITY_MARGIN,
  RIFT_REPULSOR_MAX_SPEED,
  RIFT_REPULSOR_MIN_DISTANCE,
  RIFT_REPULSOR_OFFSET_Y,
  RIFT_REPULSOR_STRENGTH,
  RIFT_SOURCE_DRAG,
  RIFT_SOURCE_HEIGHT,
  RIFT_SOURCE_WIDTH,
  RIFT_TIMEOUT_DRAIN_GRACE_MS,
} from './config';
import { getRiftSourceLocalPosition, projectRiftSourceToScene } from './geometry';
import type {
  RiftBurst,
  RiftLifecycleState,
  RiftPortal,
  RiftProjection,
  RiftProjectionStatus,
  RiftSourceAsteroid,
  RiftSourceSpace,
} from './types';

const RIFT_POSITION_ATTEMPTS = 80;
const RIFT_SAFETY_PADDING = 60;

export function createRiftBurst(input: {
  asteroidCount: number;
  burstIndex: number;
  exclusions: SpawnCircle[];
  now: number;
  world: WorldSize;
}): RiftBurst {
  const portal = createPortal(input.world, input.exclusions, input.burstIndex, input.now);
  const asteroids = createSourceAsteroids(input.asteroidCount, input.burstIndex, portal);
  return {
    portal,
    sourceSpace: {
      asteroids,
      id: portal.id,
      portal,
      size: { width: RIFT_SOURCE_WIDTH, height: RIFT_SOURCE_HEIGHT },
      state: portal.state,
      timedOutAt: null,
    },
  };
}

export function updateRiftSourceSpace(input: {
  deltaSeconds: number;
  now: number;
  sourceSpace: RiftSourceSpace;
}): void {
  syncRiftLifecycle(input.sourceSpace, input.now);
  if (!riftSourceSpaceCanMove(input.sourceSpace, input.now)) return;

  const frameScale = input.deltaSeconds * 60;
  for (const sourceAsteroid of input.sourceSpace.asteroids) {
    applySourceRepulsor(input.sourceSpace, sourceAsteroid, frameScale);
    sourceAsteroid.sourcePosition.x += sourceAsteroid.asteroid.velocity.x * frameScale;
    sourceAsteroid.sourcePosition.y += sourceAsteroid.asteroid.velocity.y * frameScale;
  }
}

export function updateRiftSourceAsteroids(input: {
  deltaSeconds: number;
  sourceAsteroids: RiftSourceAsteroid[];
}): void {
  const frameScale = input.deltaSeconds * 60;
  for (const sourceAsteroid of input.sourceAsteroids) {
    sourceAsteroid.sourcePosition.x += sourceAsteroid.asteroid.velocity.x * frameScale;
    sourceAsteroid.sourcePosition.y += sourceAsteroid.asteroid.velocity.y * frameScale;
  }
}

export function syncRiftLifecycle(sourceSpace: RiftSourceSpace, now: number): void {
  const nextState = getNextLifecycleState(sourceSpace, now);
  sourceSpace.state = nextState;
  sourceSpace.portal.state = nextState;
  if (nextState === 'closing' && sourceSpace.portal.closeStartedAt === null) {
    sourceSpace.portal.closeStartedAt = now;
  }
}

export function riftSourceSpaceCanMove(sourceSpace: RiftSourceSpace, now: number): boolean {
  const progress = getRiftPortalOpenProgress(sourceSpace.portal, now);
  return (
    sourceSpace.state !== 'closing' &&
    sourceSpace.state !== 'disposed' &&
    progress >= RIFT_MOVE_START_OPEN_PROGRESS
  );
}

export function getRiftPortalOpenProgress(portal: RiftPortal, now: number): number {
  return Phaser.Math.Clamp((now - portal.openedAt) / Math.max(1, portal.openDurationMs), 0, 1);
}

export function getRenderableRiftPortals(sourceSpaces: RiftSourceSpace[]): RiftPortal[] {
  return sourceSpaces
    .filter((sourceSpace) => sourceSpace.state !== 'disposed')
    .map((sourceSpace) => sourceSpace.portal);
}

export function getRiftProjections(
  sourceAsteroids: RiftSourceAsteroid[],
  portal: RiftPortal,
): RiftProjection[] {
  return sourceAsteroids.map((sourceAsteroid) => {
    const localPosition = getRiftSourceLocalPosition(portal, sourceAsteroid.sourcePosition);
    const scenePosition = projectRiftSourceToScene(portal, sourceAsteroid.sourcePosition);
    sourceAsteroid.asteroid.position = scenePosition;
    return {
      portal,
      scenePosition,
      sourceAsteroid,
      status: getProjectionStatus(sourceAsteroid.asteroid, localPosition, portal),
    };
  });
}

export function isVisibleInPortal(
  asteroid: AsteroidEntity,
  localPosition: Vector,
  portal: RiftPortal,
): boolean {
  const radius = ASTEROIDS[asteroid.tier].radius;
  const boundary = getPortalBoundaryAtX(portal, localPosition.x);
  return (
    Math.abs(localPosition.x) <= portal.radiusX + radius + RIFT_PORTAL_VISIBILITY_MARGIN &&
    localPosition.y + radius >= -boundary - RIFT_PORTAL_VISIBILITY_MARGIN &&
    localPosition.y - radius <= boundary + RIFT_PORTAL_VISIBILITY_MARGIN
  );
}

function getProjectionStatus(
  asteroid: AsteroidEntity,
  localPosition: Vector,
  portal: RiftPortal,
): RiftProjectionStatus {
  const radius = ASTEROIDS[asteroid.tier].radius;
  const boundary = getPortalBoundaryAtX(portal, localPosition.x);
  if (localPosition.y - radius > boundary) return 'emerged';
  if (localPosition.y + radius > -boundary) return 'crossing';
  return 'insidePortal';
}

function getPortalBoundaryAtX(portal: RiftPortal, localX: number): number {
  const normalizedX = Phaser.Math.Clamp(Math.abs(localX) / Math.max(1, portal.radiusX), 0, 1);
  return portal.radiusY * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX));
}

function getNextLifecycleState(sourceSpace: RiftSourceSpace, now: number): RiftLifecycleState {
  if (sourceSpace.state === 'disposed') return 'disposed';
  if (sourceSpace.portal.closeStartedAt !== null) {
    return now - sourceSpace.portal.closeStartedAt >= sourceSpace.portal.closeDurationMs
      ? 'disposed'
      : 'closing';
  }
  if (now - sourceSpace.portal.openedAt >= sourceSpace.portal.durationMs) {
    if (sourceSpace.timedOutAt === null) {
      sourceSpace.timedOutAt = now;
    }
    removeTimedOutAsteroids(sourceSpace, false);
    if (now - sourceSpace.timedOutAt >= RIFT_TIMEOUT_DRAIN_GRACE_MS) {
      removeTimedOutAsteroids(sourceSpace, true);
    }
    if (sourceSpace.asteroids.length === 0) return 'closing';
  }
  if (sourceSpace.asteroids.length === 0) return 'closing';
  if (getRiftPortalOpenProgress(sourceSpace.portal, now) < 1) return 'opening';
  return sourceSpace.asteroids.some((sourceAsteroid) => {
    const status = getProjectionStatus(
      sourceAsteroid.asteroid,
      getRiftSourceLocalPosition(sourceSpace.portal, sourceAsteroid.sourcePosition),
      sourceSpace.portal,
    );
    return status === 'crossing';
  })
    ? 'draining'
    : 'active';
}

function removeTimedOutAsteroids(sourceSpace: RiftSourceSpace, removeStranded: boolean): void {
  for (let index = sourceSpace.asteroids.length - 1; index >= 0; index -= 1) {
    const sourceAsteroid = sourceSpace.asteroids[index];
    const localPosition = getRiftSourceLocalPosition(
      sourceSpace.portal,
      sourceAsteroid.sourcePosition,
    );
    if (canCullTimedOutAsteroid(sourceAsteroid.asteroid, localPosition, sourceSpace.portal)) {
      sourceSpace.asteroids.splice(index, 1);
    } else if (removeStranded) {
      if (!isVisibleInPortal(sourceAsteroid.asteroid, localPosition, sourceSpace.portal)) {
        sourceSpace.asteroids.splice(index, 1);
      }
    }
  }
}

function canCullTimedOutAsteroid(
  asteroid: AsteroidEntity,
  localPosition: Vector,
  portal: RiftPortal,
): boolean {
  const radius = ASTEROIDS[asteroid.tier].radius;
  const boundary = getPortalBoundaryAtX(portal, localPosition.x);
  return localPosition.y + radius <= -boundary - RIFT_DEEP_INSIDE_CULL_MARGIN;
}

function createPortal(
  world: WorldSize,
  exclusions: SpawnCircle[],
  burstIndex: number,
  openedAt: number,
): RiftPortal {
  const radius = Math.max(RIFT_PORTAL_RADIUS_X, RIFT_PORTAL_RADIUS_Y) + RIFT_SAFETY_PADDING;
  const position = choosePortalPosition(world, exclusions, radius);
  return {
    angle: getPortalAngleFacingPlayfield(position, world),
    closeDurationMs: RIFT_CLOSE_DURATION_MS,
    closeStartedAt: null,
    durationMs: RIFT_DURATION_MS,
    id: burstIndex,
    openDurationMs: RIFT_OPEN_DURATION_MS,
    openedAt,
    position,
    radiusX: RIFT_PORTAL_RADIUS_X,
    radiusY: RIFT_PORTAL_RADIUS_Y,
    sourcePosition: { x: RIFT_SOURCE_WIDTH * 0.5, y: RIFT_SOURCE_HEIGHT * 0.58 },
    state: 'opening',
  };
}

function createSourceAsteroids(
  asteroidCount: number,
  burstIndex: number,
  portal: RiftPortal,
): RiftSourceAsteroid[] {
  const asteroids: RiftSourceAsteroid[] = [];
  for (let index = 0; index < asteroidCount; index += 1) {
    const tier = chooseBurstTier(burstIndex);
    const config = ASTEROIDS[tier];
    const spawnAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const spawnDistance = RIFT_ASTEROID_SPAWN_RADIUS * Math.sqrt(Phaser.Math.FloatBetween(0, 1));
    const sourcePosition = {
      x: Phaser.Math.Clamp(
        portal.sourcePosition.x + Math.cos(spawnAngle) * spawnDistance,
        config.radius,
        RIFT_SOURCE_WIDTH - config.radius,
      ),
      y: Phaser.Math.Clamp(
        portal.sourcePosition.y -
          RIFT_REPULSOR_OFFSET_Y * 0.85 +
          Math.sin(spawnAngle) * spawnDistance,
        config.radius,
        RIFT_SOURCE_HEIGHT - config.radius,
      ),
    };
    const speed = config.speed * RIFT_ASTEROID_SPEED_SCALE * Phaser.Math.FloatBetween(0.12, 0.36);
    const asteroid = createAsteroid(tier, projectRiftSourceToScene(portal, sourcePosition), {
      x: Math.cos(spawnAngle) * speed,
      y: Math.max(0.08, Math.sin(spawnAngle) * speed),
    });
    asteroids.push({
      asteroid,
      portalId: portal.id,
      sourcePosition,
      sourceSpaceId: portal.id,
    });
  }
  return asteroids;
}

function applySourceRepulsor(
  sourceSpace: RiftSourceSpace,
  sourceAsteroid: RiftSourceAsteroid,
  frameScale: number,
): void {
  const repulsor = {
    x: sourceSpace.portal.sourcePosition.x,
    y: sourceSpace.portal.sourcePosition.y - RIFT_REPULSOR_OFFSET_Y,
  };
  const delta = {
    x: sourceAsteroid.sourcePosition.x - repulsor.x,
    y: sourceAsteroid.sourcePosition.y - repulsor.y,
  };
  const distance = Math.max(RIFT_REPULSOR_MIN_DISTANCE, Math.hypot(delta.x, delta.y));
  const force = RIFT_REPULSOR_STRENGTH / Math.max(1, distance / RIFT_REPULSOR_MIN_DISTANCE);
  sourceAsteroid.asteroid.velocity.x =
    (sourceAsteroid.asteroid.velocity.x + (delta.x / distance) * force * frameScale) *
    RIFT_SOURCE_DRAG;
  sourceAsteroid.asteroid.velocity.y =
    (sourceAsteroid.asteroid.velocity.y + (delta.y / distance) * force * frameScale) *
    RIFT_SOURCE_DRAG;
  const speed = Math.hypot(sourceAsteroid.asteroid.velocity.x, sourceAsteroid.asteroid.velocity.y);
  if (speed > RIFT_REPULSOR_MAX_SPEED) {
    const scale = RIFT_REPULSOR_MAX_SPEED / speed;
    sourceAsteroid.asteroid.velocity.x *= scale;
    sourceAsteroid.asteroid.velocity.y *= scale;
  }
}

function choosePortalPosition(world: WorldSize, exclusions: SpawnCircle[], radius: number): Vector {
  for (let attempt = 0; attempt < RIFT_POSITION_ATTEMPTS; attempt += 1) {
    const candidate = {
      x: Phaser.Math.Between(
        RIFT_EDGE_MARGIN,
        Math.max(RIFT_EDGE_MARGIN, world.width - RIFT_EDGE_MARGIN),
      ),
      y: Phaser.Math.Between(
        RIFT_EDGE_MARGIN,
        Math.max(RIFT_EDGE_MARGIN, world.height - RIFT_EDGE_MARGIN),
      ),
    };
    if (!overlapsAnySpawnCircle({ position: candidate, radius }, exclusions, 0)) {
      return candidate;
    }
  }
  return { x: world.width * 0.5, y: Math.max(RIFT_EDGE_MARGIN, world.height * 0.22) };
}

function getPortalAngleFacingPlayfield(position: Vector, world: WorldSize): number {
  return Math.atan2(world.height * 0.5 - position.y, world.width * 0.5 - position.x);
}

function chooseBurstTier(burstIndex: number): AsteroidTier {
  const roll = Math.random();
  const megaChance = Math.min(0.13, burstIndex * 0.012);
  const bigChance = Math.min(0.34, burstIndex * 0.032);
  const mediumChance = Math.min(0.38, burstIndex * 0.045);
  if (burstIndex >= 12 && roll < megaChance) return 'mega';
  if (burstIndex >= 6 && roll < megaChance + bigChance) return 'big';
  if (burstIndex >= 3 && roll < megaChance + bigChance + mediumChance) return 'medium';
  return 'small';
}
