import {
  ASTEROID_CONFIGS,
  BLACK_HOLE_GRAVITY_STRENGTH,
  BLACK_HOLE_MATURE_AFTER_MS,
  BLACK_HOLE_MATURE_RADIUS,
  BLACK_HOLE_RADIUS,
  type Asteroid,
  type Bullet,
  type Planet,
} from '@/constants';
import { asteroids, bullets, player } from '@/state';

export const BLACK_HOLE_GROWTH_DURATION_MS = 1000;
export const BLACK_HOLE_COLLAPSE_DURATION_MS = 700;

const BLACK_HOLE_ABSORBED_FUEL_BLOBS: Record<Asteroid['size'], number> = {
  small: 1,
  medium: 2,
  big: 4,
  mega: 8,
};

type BlackHoleLifecycleOptions = {
  now: number;
  deltaScale?: number;
  planets?: Planet[];
  getDelta: (fromX: number, fromY: number, toX: number, toY: number) => { x: number; y: number };
  distance: (fromX: number, fromY: number, toX: number, toY: number) => number;
  onAsteroidAbsorbed: (asteroid: Asteroid) => void;
  onAsteroidRemoved?: (asteroid: Asteroid) => void;
  onBlackHoleRemoved?: (blackHole: Bullet) => void;
  onFuelBurst: (
    x: number,
    y: number,
    count: number,
    now: number,
    baseVx: number,
    baseVy: number,
  ) => void;
  createExplosionBurst: (
    x: number,
    y: number,
    intensity: number,
    baseVx: number,
    baseVy: number,
  ) => void;
};

export function isMatureBlackHole(blackHole: Bullet, now = Date.now()): boolean {
  return now - blackHole.spawnTime >= BLACK_HOLE_MATURE_AFTER_MS;
}

export function getMatureBlackHoleRadius(blackHole: Bullet, now = Date.now()): number {
  const growthProgress = Math.min(
    1,
    Math.max(
      0,
      (now - blackHole.spawnTime - BLACK_HOLE_MATURE_AFTER_MS) / BLACK_HOLE_GROWTH_DURATION_MS,
    ),
  );
  return BLACK_HOLE_RADIUS + (BLACK_HOLE_MATURE_RADIUS - BLACK_HOLE_RADIUS) * growthProgress;
}

export function getBlackHoleRenderRadius(blackHole: Bullet, now = Date.now()): number {
  const matureRadius = getMatureBlackHoleRadius(blackHole, now);
  if (!blackHole.collapseStartTime || !blackHole.collapseDuration) {
    return matureRadius;
  }

  const collapseProgress = Math.min(
    1,
    Math.max(0, (now - blackHole.collapseStartTime) / blackHole.collapseDuration),
  );
  return matureRadius * (1 - collapseProgress);
}

export function absorbAsteroidIntoBlackHole(blackHole: Bullet, asteroid: Asteroid): void {
  blackHole.absorbedFuelBlobs =
    (blackHole.absorbedFuelBlobs ?? 0) + BLACK_HOLE_ABSORBED_FUEL_BLOBS[asteroid.size];

  const shooter = player?.id === blackHole.playerId ? player : null;
  if (shooter) {
    shooter.score += ASTEROID_CONFIGS[asteroid.size].points * shooter.lives;
  }
}

export function removeBlackHolesCollidingWithPlanets(
  activePlanets: Planet[],
  distance: BlackHoleLifecycleOptions['distance'],
  onBlackHoleRemoved?: BlackHoleLifecycleOptions['onBlackHoleRemoved'],
): void {
  if (activePlanets.length === 0) {
    return;
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (bullet.type === 'blackHole') {
      const hitPlanet = activePlanets.some(
        (planet) =>
          distance(bullet.x, bullet.y, planet.x, planet.y) <=
          planet.getRadius() + BLACK_HOLE_RADIUS,
      );
      if (hitPlanet) {
        onBlackHoleRemoved?.(bullet);
        bullets.splice(i, 1);
      }
    }
  }
}

export function applyBlackHoleGravity({
  now,
  deltaScale = 1,
  getDelta,
}: Pick<BlackHoleLifecycleOptions, 'now' | 'deltaScale' | 'getDelta'>): void {
  const activeBlackHoles = bullets.filter(
    (bullet) =>
      bullet.type === 'blackHole' && !bullet.collapseStartTime && isMatureBlackHole(bullet, now),
  );
  if (activeBlackHoles.length === 0) {
    return;
  }

  for (const blackHole of activeBlackHoles) {
    const radius = getMatureBlackHoleRadius(blackHole, now);
    const gravityRange = radius * 6;
    for (const asteroid of asteroids) {
      const { x: dx, y: dy } = getDelta(asteroid.x, asteroid.y, blackHole.x, blackHole.y);
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      if (dist > 0 && dist < gravityRange) {
        const force = (BLACK_HOLE_GRAVITY_STRENGTH * 0.5 * radius * radius) / distSq;
        asteroid.vx += (dx / dist) * force * deltaScale;
        asteroid.vy += (dy / dist) * force * deltaScale;
      }
    }
  }
}

export function updateBlackHoleLifecycles({
  now,
  deltaScale = 1,
  planets = [],
  getDelta,
  distance,
  onAsteroidAbsorbed,
  onAsteroidRemoved,
  onBlackHoleRemoved,
  onFuelBurst,
  createExplosionBurst,
}: BlackHoleLifecycleOptions): void {
  removeBlackHolesCollidingWithPlanets(planets, distance, onBlackHoleRemoved);
  applyBlackHoleGravity({ now, deltaScale, getDelta });

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (bullet.type === 'blackHole') {
      if (bullet.collapseStartTime && bullet.collapseDuration) {
        if (now - bullet.collapseStartTime >= bullet.collapseDuration) {
          createExplosionBurst(
            bullet.x,
            bullet.y,
            Math.max(0.45, (bullet.absorbedFuelBlobs ?? 0) * 0.08),
            bullet.vx,
            bullet.vy,
          );
          onFuelBurst(bullet.x, bullet.y, bullet.absorbedFuelBlobs ?? 0, now, bullet.vx, bullet.vy);
          onBlackHoleRemoved?.(bullet);
          bullets.splice(i, 1);
        }
      } else if (now - bullet.spawnTime >= bullet.lifetime) {
        bullet.collapseStartTime = now;
        bullet.collapseDuration = BLACK_HOLE_COLLAPSE_DURATION_MS;
        bullet.vx = 0;
        bullet.vy = 0;
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (bullet.type === 'blackHole' && !bullet.collapseStartTime) {
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const asteroid = asteroids[j];
        const hitDistance = distance(bullet.x, bullet.y, asteroid.x, asteroid.y);
        if (hitDistance <= getBlackHoleRenderRadius(bullet, now) + asteroid.getRadius()) {
          absorbAsteroidIntoBlackHole(bullet, asteroid);
          onAsteroidAbsorbed(asteroid);
          onAsteroidRemoved?.(asteroid);
          asteroids.splice(j, 1);
        }
      }
    }
  }
}
