import type { Vector } from '../core/types';
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
} from './config';
import { normalizeVector, wrappedDistance } from './portalGeometry';
import type { PortalDirectorPlan, PortalPlacementInput, PortalViewPolicy } from './types';

const EDGE_MARGIN = Math.max(RIFT_PORTAL_RADIUS_X, RIFT_PORTAL_RADIUS_Y) + 72;
const PLAYER_SAFE_DISTANCE = 260;
const PLACEMENT_ATTEMPTS = 96;
const ACTIVE_DURATION_MS = 5400;
const SPAWN_DISTANCE = 360;
const SPAWN_SPREAD_RADIUS = 34;

export class PortalDirector {
  burstCount = 0;
  private nextPortalAt = 0;

  constructor(initialIntensity = 1) {
    this.burstCount = Math.max(0, Math.floor(initialIntensity) - 1);
  }

  shouldOpenPortal(input: { activePortal: boolean; now: number }): boolean {
    if (input.activePortal) return false;
    if (this.nextPortalAt === 0) return true;
    return input.now >= this.nextPortalAt;
  }

  createPortalPlan(input: PortalPlacementInput): PortalDirectorPlan {
    this.burstCount += 1;
    this.nextPortalAt = input.now + this.getIntervalMs();
    const position = this.choosePortalPosition(input);
    const angle = floatBetween(0, Math.PI * 2);
    const normal = normalizeVector({ x: Math.cos(angle), y: Math.sin(angle) });
    return {
      portal: {
        activeDurationMs: ACTIVE_DURATION_MS,
        aperture: {
          radiusX: RIFT_PORTAL_APERTURE_RADIUS_X,
          radiusY: RIFT_PORTAL_APERTURE_RADIUS_Y,
        },
        closeStartedAt: null,
        closingDurationMs: RIFT_CLOSE_DURATION_MS,
        id: input.portalId,
        lifecycle: 'openingVisual',
        normal,
        openedAt: input.now,
        openingDurationMs: RIFT_OPEN_DURATION_MS,
        position,
        viewPolicy: this.chooseViewPolicy(),
        visualRadiusX: RIFT_PORTAL_RADIUS_X,
        visualRadiusY: RIFT_PORTAL_RADIUS_Y,
      },
      spawn: {
        asteroidCount: this.getAsteroidCount(),
        asteroidSpeed: this.getAsteroidSpeed(),
        spawnDistance: SPAWN_DISTANCE,
        spreadRadius: SPAWN_SPREAD_RADIUS,
      },
    };
  }

  private choosePortalPosition(input: PortalPlacementInput): Vector {
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
      const candidate = {
        x: randomInt(EDGE_MARGIN, Math.max(EDGE_MARGIN, input.world.width - EDGE_MARGIN)),
        y: randomInt(EDGE_MARGIN, Math.max(EDGE_MARGIN, input.world.height - EDGE_MARGIN)),
      };
      if (wrappedDistance(candidate, input.playerPosition, input.world) >= PLAYER_SAFE_DISTANCE) {
        return candidate;
      }
    }
    return {
      x: clamp(input.world.width * 0.5, EDGE_MARGIN, input.world.width - EDGE_MARGIN),
      y: clamp(input.world.height * 0.3, EDGE_MARGIN, input.world.height - EDGE_MARGIN),
    };
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
    return floatBetween(3.8, 6.8);
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(floatBetween(min, max + 1));
}

function floatBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
