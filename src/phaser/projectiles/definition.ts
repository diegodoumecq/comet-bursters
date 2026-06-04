import type { AsteroidEntity } from '../asteroids/types';

export const BLACK_HOLE_DEFINITION = {
  absorption: {
    asteroidMassScale: 0.25,
    fuelBlobMassScale: 0.25,
    fuelBlobsByAsteroidTier: {
      small: 1,
      medium: 2,
      big: 4,
      mega: 8,
    } satisfies Record<AsteroidEntity['tier'], number>,
  },
  gravity: {
    fuelRangeMultiplier: 12,
    fuelStrengthMultiplier: 24,
    strength: 1.5,
  },
  lifecycle: {
    collapseDurationMs: 700,
    growthDurationMs: 1000,
    matureAfterMs: 3000,
  },
  render: {
    distortionRadius: 200,
    distortionStrength: 0.8,
    matureRadius: 25,
    radius: 6,
  },
  runtime: {
    maxBlackHoles: 10,
  },
};

export const BLACK_HOLE_RADIUS = BLACK_HOLE_DEFINITION.render.radius;
export const BLACK_HOLE_MATURE_AFTER_MS = BLACK_HOLE_DEFINITION.lifecycle.matureAfterMs;
export const BLACK_HOLE_MATURE_RADIUS = BLACK_HOLE_DEFINITION.render.matureRadius;
export const BLACK_HOLE_GRAVITY_STRENGTH = BLACK_HOLE_DEFINITION.gravity.strength;
export const BLACK_HOLE_FUEL_GRAVITY_RANGE_MULTIPLIER =
  BLACK_HOLE_DEFINITION.gravity.fuelRangeMultiplier;
export const BLACK_HOLE_FUEL_GRAVITY_STRENGTH_MULTIPLIER =
  BLACK_HOLE_DEFINITION.gravity.fuelStrengthMultiplier;
export const BLACK_HOLE_GROWTH_DURATION_MS = BLACK_HOLE_DEFINITION.lifecycle.growthDurationMs;
export const BLACK_HOLE_COLLAPSE_DURATION_MS =
  BLACK_HOLE_DEFINITION.lifecycle.collapseDurationMs;
export const DISTORTION_RADIUS = BLACK_HOLE_DEFINITION.render.distortionRadius;
export const DISTORTION_STRENGTH = BLACK_HOLE_DEFINITION.render.distortionStrength;
export const MAX_BLACK_HOLES = BLACK_HOLE_DEFINITION.runtime.maxBlackHoles;
export const MAX_BLACK_HOLE_RENDER_SAMPLES = MAX_BLACK_HOLES * 9;
export const BLACK_HOLE_ASTEROID_MASS_SCALE =
  BLACK_HOLE_DEFINITION.absorption.asteroidMassScale;
export const BLACK_HOLE_FUEL_BLOB_MASS_SCALE =
  BLACK_HOLE_DEFINITION.absorption.fuelBlobMassScale;
export const BLACK_HOLE_ABSORBED_FUEL_BLOBS =
  BLACK_HOLE_DEFINITION.absorption.fuelBlobsByAsteroidTier;
