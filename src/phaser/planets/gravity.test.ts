import { describe, expect, it } from 'vitest';

import type { ParticleEntity } from '../particles/types';
import { applyPlanetGravity, getParticlesCollidingWithPlanets } from './gravity';
import type { PlanetEntity } from './types';

const world = { width: 1000, height: 1000 };

const planet: PlanetEntity = {
  altitudeVariations: [],
  color: 0xffffff,
  colorHex: '#ffffff',
  gravityStrength: 10,
  id: 1,
  kind: 'lush',
  position: { x: 200, y: 100 },
  radius: 100,
  rotation: 0,
  rotationSpeed: 0,
};

describe('planet gravity', () => {
  it('applies gravity to a velocity target', () => {
    const velocity = { x: 0, y: 0 };

    applyPlanetGravity(velocity, { x: 100, y: 100 }, [planet], world, 1 / 60);

    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBe(0);
  });

  it('finds particles that have crossed a planet surface', () => {
    const inside = createParticle({ x: 250, y: 100 }, 1);
    const outside = createParticle({ x: 310, y: 100 }, 2);

    expect(getParticlesCollidingWithPlanets([inside, outside], [planet], world)).toEqual([inside]);
  });

  it('finds particle planet collisions across wrapped world edges', () => {
    const wrappedPlanet = { ...planet, position: { x: 960, y: 100 } };
    const particle = createParticle({ x: 20, y: 100 });

    expect(getParticlesCollidingWithPlanets([particle], [wrappedPlanet], world)).toEqual([
      particle,
    ]);
  });
});

function createParticle(position: { x: number; y: number }, id = 1): ParticleEntity {
  return {
    alphaDecayPerSecond: 1,
    color: 0xffffff,
    dragPerSecond: 1,
    id,
    kind: 'spark',
    lifetimeMs: 100,
    maxLifetimeMs: 100,
    position,
    rotation: 0,
    velocity: { x: 0, y: 0 },
  };
}
