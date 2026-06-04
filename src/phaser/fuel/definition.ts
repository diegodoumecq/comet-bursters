import type { MatterBodySpec } from '../core/matterBodySpec';

export const FUEL_BLOB_DEFINITION = {
  body: {
    bounce: 0,
    frictionAir: 0,
    mass: 0.06,
  } satisfies MatterBodySpec,
  collection: {
    amount: 5,
    radius: 10,
  },
  motion: {
    attractionAcceleration: 0.035 * 60,
    attractionRadius: 260,
    chainReactionRadius: 92,
  },
  spawn: {
    defaultAirResistance: 0.015,
    driftSpeed: 8 / 60,
  },
};

export const FUEL_BLOB_AMOUNT = FUEL_BLOB_DEFINITION.collection.amount;
export const FUEL_BLOB_RADIUS = FUEL_BLOB_DEFINITION.collection.radius;
export const FUEL_BLOB_ATTRACTION_RADIUS = FUEL_BLOB_DEFINITION.motion.attractionRadius;
export const FUEL_BLOB_ATTRACTION_ACCELERATION =
  FUEL_BLOB_DEFINITION.motion.attractionAcceleration;
export const FUEL_BLOB_CHAIN_REACTION_RADIUS = FUEL_BLOB_DEFINITION.motion.chainReactionRadius;
export const FUEL_BLOB_SPAWN_DRIFT_SPEED = FUEL_BLOB_DEFINITION.spawn.driftSpeed;
