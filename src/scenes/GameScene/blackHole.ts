import {
  BLACK_HOLE_MATURE_AFTER_MS,
  BLACK_HOLE_MATURE_RADIUS,
  BLACK_HOLE_RADIUS,
  type Bullet,
} from '@/constants';

export const BLACK_HOLE_GROWTH_DURATION_MS = 1000;

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
