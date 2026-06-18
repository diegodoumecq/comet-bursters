import { ASTEROID_TEXTURES } from '../asteroids/textures';
import type { AsteroidTier } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import {
  ARCADE_RIFT_ASTEROIDS_PER_BURST,
  ARCADE_RIFT_BASE_ASTEROIDS,
  ARCADE_RIFT_INITIAL_INTERVAL_MS,
  ARCADE_RIFT_INTERVAL_DECAY_PER_BURST_MS,
  ARCADE_RIFT_MAX_ASTEROIDS,
  ARCADE_RIFT_MIN_INTERVAL_MS,
  RIFT_CLOSE_DURATION_MS,
  RIFT_OPEN_DURATION_MS,
  RIFT_PORTAL_APERTURE_RADIUS_X,
  RIFT_PORTAL_APERTURE_RADIUS_Y,
  RIFT_PORTAL_RADIUS_X,
  RIFT_PORTAL_RADIUS_Y,
} from '../dimensions/config';
import {
  addVector,
  getPortalTangent,
  normalizeVector,
  scaleVector,
  subtractVector,
  wrappedDistance,
} from '../dimensions/portalGeometry';
import type { PortalEntity, PortalViewPolicy } from '../dimensions/types';
import { buildPortalMetaballData, PORTAL_METABALL_COUNT } from '../portals/PortalMetaballSamples';
import { ENTITIES } from './config';
import type { GameEntity } from './types';

const PORTAL_EDGE_MARGIN = Math.max(RIFT_PORTAL_RADIUS_X, RIFT_PORTAL_RADIUS_Y) + 96;
const PLAYER_SAFE_DISTANCE = 260;
const PLACEMENT_ATTEMPTS = 96;
const ACTIVE_DURATION_MS = 5400;
const PREPARE_DISTANCE = 420;
const PREPARE_READY_DISTANCE = 84;
const PREPARE_TIMEOUT_MS = 2600;
const AMBIENT_TARGET_INTERVAL_MS = 2200;
const ASTEROID_LAUNCH_INITIAL_SCALE = 0.12;
const ASTEROID_LAUNCH_SCALE_DURATION_MS = 420;
const ASTEROID_LAUNCH_LEAD_MS = RIFT_OPEN_DURATION_MS + 220;
const ASTEROID_LAUNCH_INTERVAL_MS = 170;
const ASTEROID_PORTAL_TARGET_SPREAD = 0.62;
const ASTEROID_PORTAL_TARGET_EXIT_OFFSET = 0.18;

let nextMonolithAsteroidId = 1_200_000;

export type PortalSeedBallPlan = {
  arrivalAt: number;
  radius: number;
  target: Vector;
};

export type MonolithAsteroidLaunch = {
  angularVelocity: number;
  launchAt: number;
  portalId: number;
  portalTarget: Vector;
  rotation: number;
  scaleDurationMs: number;
  speed: number;
  tier: AsteroidTier;
  visualVariant: number;
};

export type MonolithRiftAttack = {
  burstCount: number;
  portal: PortalEntity;
  seedBalls: PortalSeedBallPlan[];
};

export type MonolithRiftUpdateResult = {
  attack: MonolithRiftAttack | null;
  movementTarget: Vector;
};

type PendingPortalPreparation = {
  portalPosition: Vector;
  preparedAt: number;
  viewPolicy: PortalViewPolicy;
};

export class MonolithRiftDirector {
  burstCount = 0;
  private ambientTarget: Vector | null = null;
  private nextAmbientTargetAt = 0;
  private nextPortalAt = 0;
  private pendingPreparation: PendingPortalPreparation | null = null;
  private readonly pendingAsteroidLaunches: MonolithAsteroidLaunch[] = [];

  constructor(initialIntensity = 1) {
    this.burstCount = Math.max(0, Math.floor(initialIntensity) - 1);
  }

  update(input: {
    activePortal: PortalEntity | null;
    forcePortal?: boolean;
    forcedViewPolicy?: PortalViewPolicy;
    monolith: GameEntity;
    now: number;
    playerPosition: Vector;
    portalId: number;
    world: WorldSize;
  }): MonolithRiftUpdateResult {
    this.beginPreparationIfNeeded(input);
    const movementTarget = this.getMovementTarget(input);
    const attack = this.createAttackIfReady(input, movementTarget);
    return { attack, movementTarget };
  }

  consumeDueAsteroidLaunches(input: {
    monolithPosition: Vector;
    now: number;
    portal: PortalEntity | null;
  }): Array<{
    launch: MonolithAsteroidLaunch;
    position: Vector;
    velocity: Vector;
  }> {
    if (input.portal === null) return [];
    const launches: Array<{
      launch: MonolithAsteroidLaunch;
      position: Vector;
      velocity: Vector;
    }> = [];
    const remaining: MonolithAsteroidLaunch[] = [];
    for (const launch of this.pendingAsteroidLaunches) {
      const portal = input.portal;
      const portalMatches = portal?.id === launch.portalId;
      if (launch.launchAt <= input.now && portalMatches && portal) {
        const direction = getLaunchDirection(input.monolithPosition, launch.portalTarget);
        launches.push({
          launch,
          position: addVector(
            input.monolithPosition,
            scaleVector(direction, ENTITIES.monolith.collisionRadius + 10),
          ),
          velocity: scaleVector(direction, launch.speed),
        });
      } else if (!portalMatches || launch.launchAt > input.now) {
        remaining.push(launch);
      }
    }
    this.pendingAsteroidLaunches.length = 0;
    this.pendingAsteroidLaunches.push(...remaining);
    return launches;
  }

  getLaunchInitialScale(): number {
    return ASTEROID_LAUNCH_INITIAL_SCALE;
  }

  private beginPreparationIfNeeded(input: {
    activePortal: PortalEntity | null;
    forcePortal?: boolean;
    forcedViewPolicy?: PortalViewPolicy;
    now: number;
    playerPosition: Vector;
    world: WorldSize;
  }): void {
    if (input.activePortal !== null || this.pendingPreparation !== null) return;
    const automaticDue = this.nextPortalAt === 0 || input.now >= this.nextPortalAt;
    const shouldPrepare =
      automaticDue || input.forcePortal === true || input.forcedViewPolicy !== undefined;
    if (!shouldPrepare) return;
    this.pendingPreparation = {
      portalPosition: this.choosePortalPosition(input),
      preparedAt: input.now,
      viewPolicy: input.forcedViewPolicy ?? this.chooseViewPolicy(),
    };
  }

  private getMovementTarget(input: {
    activePortal: PortalEntity | null;
    monolith: GameEntity;
    now: number;
    world: WorldSize;
  }): Vector {
    if (this.pendingPreparation) {
      return this.getPreparePosition(this.pendingPreparation.portalPosition, input.world);
    }
    if (input.activePortal) {
      return this.getPreparePosition(input.activePortal.position, input.world);
    }
    return this.getAmbientTarget(input.monolith, input.now, input.world);
  }

  private createAttackIfReady(
    input: {
      activePortal: PortalEntity | null;
      monolith: GameEntity;
      now: number;
      portalId: number;
      world: WorldSize;
    },
    movementTarget: Vector,
  ): MonolithRiftAttack | null {
    const preparation = this.pendingPreparation;
    if (!preparation || input.activePortal !== null) return null;
    const distance = wrappedDistance(input.monolith.position, movementTarget, input.world);
    const timedOut = input.now - preparation.preparedAt >= PREPARE_TIMEOUT_MS;
    if (distance > PREPARE_READY_DISTANCE && !timedOut) return null;

    this.burstCount += 1;
    this.nextPortalAt = input.now + this.getIntervalMs();
    const normal = getLaunchDirection(input.monolith.position, preparation.portalPosition);
    const portal = this.createPortal({
      normal,
      now: input.now,
      portalId: input.portalId,
      position: preparation.portalPosition,
      viewPolicy: preparation.viewPolicy,
    });
    const seedBalls = this.createSeedBalls(portal, input.now);
    this.pendingAsteroidLaunches.push(...this.createAsteroidLaunches(portal, input.now));
    this.pendingPreparation = null;
    return { burstCount: this.burstCount, portal, seedBalls };
  }

  private createPortal(input: {
    normal: Vector;
    now: number;
    portalId: number;
    position: Vector;
    viewPolicy: PortalViewPolicy;
  }): PortalEntity {
    return {
      activeDurationMs: ACTIVE_DURATION_MS,
      aperture: {
        radiusX: RIFT_PORTAL_APERTURE_RADIUS_X,
        radiusY: RIFT_PORTAL_APERTURE_RADIUS_Y,
      },
      closeStartedAt: null,
      closingDurationMs: RIFT_CLOSE_DURATION_MS,
      id: input.portalId,
      lifecycle: 'openingVisual',
      normal: input.normal,
      openedAt: input.now,
      openingDurationMs: RIFT_OPEN_DURATION_MS,
      position: input.position,
      viewPolicy: input.viewPolicy,
      visualRadiusX: RIFT_PORTAL_RADIUS_X,
      visualRadiusY: RIFT_PORTAL_RADIUS_Y,
    };
  }

  private createSeedBalls(portal: PortalEntity, now: number): PortalSeedBallPlan[] {
    const data = buildPortalMetaballData(portal, now + RIFT_OPEN_DURATION_MS);
    const tangent = { x: -portal.normal.y, y: portal.normal.x };
    const balls: PortalSeedBallPlan[] = [];
    for (let index = 0; index < PORTAL_METABALL_COUNT; index += 1) {
      const local = {
        x: data[index * 4],
        y: data[index * 4 + 1],
      };
      const target = addVector(
        portal.position,
        addVector(scaleVector(tangent, local.x), scaleVector(portal.normal, local.y)),
      );
      balls.push({
        arrivalAt: now + RIFT_OPEN_DURATION_MS,
        radius: Math.max(5, data[index * 4 + 2] * 0.18),
        target,
      });
    }
    return balls;
  }

  private createAsteroidLaunches(portal: PortalEntity, now: number): MonolithAsteroidLaunch[] {
    const count = this.getAsteroidCount();
    const launches: MonolithAsteroidLaunch[] = [];
    for (let index = 0; index < count; index += 1) {
      const tier = chooseBurstTier(this.burstCount);
      launches.push({
        angularVelocity: randomBetween(-0.025, 0.025),
        launchAt: now + ASTEROID_LAUNCH_LEAD_MS + index * ASTEROID_LAUNCH_INTERVAL_MS,
        portalId: portal.id,
        portalTarget: this.createPortalAsteroidTarget(portal, index, count),
        rotation: randomBetween(0, Math.PI * 2),
        scaleDurationMs: ASTEROID_LAUNCH_SCALE_DURATION_MS,
        speed: this.getAsteroidSpeed() * randomBetween(0.88, 1.12),
        tier,
        visualVariant: randomInt(0, ASTEROID_TEXTURES[tier].length - 1),
      });
    }
    return launches;
  }

  private createPortalAsteroidTarget(portal: PortalEntity, index: number, count: number): Vector {
    const tangent = getPortalTangent(portal);
    const sequence =
      count <= 1 ? 0 : ((index / (count - 1)) * 2 - 1) * ASTEROID_PORTAL_TARGET_SPREAD;
    const jitter = (randomBetween(-1, 1) * ASTEROID_PORTAL_TARGET_SPREAD) / Math.max(2, count);
    const tangentOffset = (sequence + jitter) * portal.aperture.radiusX;
    const normalOffset = portal.aperture.radiusY * ASTEROID_PORTAL_TARGET_EXIT_OFFSET;
    return addVector(
      portal.position,
      addVector(scaleVector(tangent, tangentOffset), scaleVector(portal.normal, normalOffset)),
    );
  }

  private choosePortalPosition(input: { playerPosition: Vector; world: WorldSize }): Vector {
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
      const candidate = {
        x: randomInt(
          PORTAL_EDGE_MARGIN,
          Math.max(PORTAL_EDGE_MARGIN, input.world.width - PORTAL_EDGE_MARGIN),
        ),
        y: randomInt(
          PORTAL_EDGE_MARGIN,
          Math.max(PORTAL_EDGE_MARGIN, input.world.height - PORTAL_EDGE_MARGIN),
        ),
      };
      if (wrappedDistance(candidate, input.playerPosition, input.world) >= PLAYER_SAFE_DISTANCE) {
        return candidate;
      }
    }
    return {
      x: clamp(input.world.width * 0.5, PORTAL_EDGE_MARGIN, input.world.width - PORTAL_EDGE_MARGIN),
      y: clamp(
        input.world.height * 0.3,
        PORTAL_EDGE_MARGIN,
        input.world.height - PORTAL_EDGE_MARGIN,
      ),
    };
  }

  private getPreparePosition(portalPosition: Vector, world: WorldSize): Vector {
    const angle = Math.atan2(
      portalPosition.y - world.height * 0.5,
      portalPosition.x - world.width * 0.5,
    );
    const awayFromCenter = normalizeVector({ x: Math.cos(angle), y: Math.sin(angle) });
    return {
      x: clamp(portalPosition.x - awayFromCenter.x * PREPARE_DISTANCE, 80, world.width - 80),
      y: clamp(portalPosition.y - awayFromCenter.y * PREPARE_DISTANCE, 80, world.height - 80),
    };
  }

  private getAmbientTarget(monolith: GameEntity, now: number, world: WorldSize): Vector {
    if (this.ambientTarget && now < this.nextAmbientTargetAt) return this.ambientTarget;
    this.nextAmbientTargetAt = now + AMBIENT_TARGET_INTERVAL_MS + randomBetween(-360, 580);
    const aroundCenter = {
      x: world.width * randomBetween(0.22, 0.78),
      y: world.height * randomBetween(0.18, 0.82),
    };
    const currentBias = scaleVector(subtractVector(monolith.position, aroundCenter), -0.18);
    this.ambientTarget = {
      x: clamp(aroundCenter.x + currentBias.x, 80, world.width - 80),
      y: clamp(aroundCenter.y + currentBias.y, 80, world.height - 80),
    };
    return this.ambientTarget;
  }

  private chooseViewPolicy(): PortalViewPolicy {
    return Math.random() < 0.72 ? 'window' : 'cameraTransfer';
  }

  private getIntervalMs(): number {
    return Math.max(
      ARCADE_RIFT_MIN_INTERVAL_MS,
      ARCADE_RIFT_INITIAL_INTERVAL_MS - this.burstCount * ARCADE_RIFT_INTERVAL_DECAY_PER_BURST_MS,
    );
  }

  private getAsteroidCount(): number {
    return Math.min(
      ARCADE_RIFT_MAX_ASTEROIDS,
      Math.floor(ARCADE_RIFT_BASE_ASTEROIDS + this.burstCount * ARCADE_RIFT_ASTEROIDS_PER_BURST),
    );
  }

  private getAsteroidSpeed(): number {
    return randomBetween(3.8, 6.8);
  }
}

export function createMonolithAsteroidId(): number {
  const id = nextMonolithAsteroidId;
  nextMonolithAsteroidId += 1;
  return id;
}

function chooseBurstTier(burstCount: number): AsteroidTier {
  const roll = Math.random();
  const megaChance = Math.min(0.13, burstCount * 0.012);
  const bigChance = Math.min(0.34, burstCount * 0.032);
  const mediumChance = Math.min(0.38, burstCount * 0.045);
  if (burstCount >= 12 && roll < megaChance) return 'mega';
  if (burstCount >= 6 && roll < megaChance + bigChance) return 'big';
  if (burstCount >= 3 && roll < megaChance + bigChance + mediumChance) return 'medium';
  return 'small';
}

function getLaunchDirection(from: Vector, to: Vector): Vector {
  return normalizeVector(subtractVector(to, from));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
