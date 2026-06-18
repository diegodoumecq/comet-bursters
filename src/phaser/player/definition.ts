import type { MatterBodySpec } from '../core/matterBodySpec';

const PLAYER_MASS = 18;

export const PLAYER_DEFINITIONS = {
  arcade: {
    body: {
      bounce: 0.8,
      fixedRotation: true,
      frictionAir: 0,
      mass: PLAYER_MASS,
    } satisfies MatterBodySpec,
  },
  demo: {
    body: {
      bounce: 0.8,
      frictionAir: 0.045,
      mass: PLAYER_MASS,
    } satisfies MatterBodySpec,
  },
  sandbox: {
    body: {
      frictionAir: 0,
      mass: PLAYER_MASS,
    } satisfies MatterBodySpec,
  },
  shipInterior: {
    body: {
      fixedRotation: true,
      frictionAir: 0.22,
      mass: PLAYER_MASS,
    } satisfies MatterBodySpec,
  },
};
