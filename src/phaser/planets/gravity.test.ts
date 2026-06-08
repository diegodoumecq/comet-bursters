import { describe, expect, it } from 'vitest';

import type { MatterImage } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import {
  applyPlanetGravityToBody,
  applyPlanetGravityToFuelBlobs,
  applyPlanetGravityToParticles,
  getParticlesCollidingWithPlanets,
} from './gravity';
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

function createBody() {
  const body = {
    body: {
      velocity: { x: 0, y: 0 },
    },
    x: 100,
    y: 100,
    setVelocity(x: number, y: number) {
      this.body.velocity = { x, y };
    },
  };

  return body as unknown as MatterImage;
}

describe('planet gravity', () => {
  it('applies gravity to player bodies', () => {
    const body = createBody();

    applyPlanetGravityToBody(body, [planet], world, 1 / 60);

    expect(body.body.velocity.x).toBeGreaterThan(0);
    expect(body.body.velocity.y).toBe(0);
  });

  it('applies gravity to fuel blobs', () => {
    const blob: FuelBlobEntity = {
      id: 1,
      affectedByPlanetGravity: true,
      airResistance: 0.015,
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    applyPlanetGravityToFuelBlobs([blob], [planet], world, 1 / 60);

    expect(blob.velocity.x).toBeGreaterThan(0);
    expect(blob.velocity.y).toBe(0);
  });

  it('skips planet gravity for fuel blobs that ignore planet gravity', () => {
    const blob: FuelBlobEntity = {
      id: 1,
      affectedByPlanetGravity: false,
      airResistance: 0.015,
      position: { x: 100, y: 100 },
      velocity: { x: 24, y: 0 },
      wobbleSeed: 0,
    };

    applyPlanetGravityToFuelBlobs([blob], [planet], world, 1 / 60);

    expect(blob.velocity).toEqual({ x: 24, y: 0 });
  });

  it('applies gravity to particles by default', () => {
    const particle = createParticle({ x: 100, y: 100 });

    applyPlanetGravityToParticles([particle], [planet], world, 1 / 60);

    expect(particle.velocity.x).toBeGreaterThan(0);
    expect(particle.velocity.y).toBe(0);
  });

  it('skips planet gravity for particles that opt out', () => {
    const particle = createParticle({ x: 100, y: 100 });
    particle.affectedByPlanetGravity = false;
    particle.velocity = { x: 4, y: 0 };

    applyPlanetGravityToParticles([particle], [planet], world, 1 / 60);

    expect(particle.velocity).toEqual({ x: 4, y: 0 });
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
