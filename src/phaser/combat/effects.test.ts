import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import {
  createAsteroidExplosion,
  createAsteroidImpactDebris,
  createAsteroidPlanetImpactDebris,
  createBlackHolePlanetAbsorption,
  createExplosionBurst,
  createShipExplosion,
  createShipPlanetImpactDebris,
} from './effects';

describe('combat particle effects', () => {
  it('builds asteroid explosions from dense layered particle kinds', () => {
    const effect = createAsteroidExplosion(createAsteroid('big'), 1);

    expect(effect.particles.length).toBeGreaterThan(60);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'shard', 'shockwave', 'smoke', 'spark']),
    );
    expect(
      effect.particles
        .filter((particle) => particle.kind === 'shard')
        .every((particle) => particle.gravityScale === undefined),
    ).toBe(true);
    expect(
      effect.particles
        .filter((particle) => particle.kind !== 'shard')
        .every((particle) => particle.gravityScale === 0),
    ).toBe(true);
  });

  it('builds generic explosion particles that ignore gravity', () => {
    const effect = createExplosionBurst({ x: 120, y: 80 }, { x: 4, y: -2 }, 1);

    expect(effect.particles.every((particle) => particle.gravityScale === 0)).toBe(true);
  });

  it('creates impact debris with directional shards, sparks, and smoke', () => {
    const effect = createAsteroidImpactDebris(createAsteroid('medium'), { x: 8, y: 0 });

    expect(effect.particles.length).toBeGreaterThan(25);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['shard', 'smoke', 'spark']),
    );
  });

  it('creates planet impact debris that bounces outward from the surface normal', () => {
    const effect = createAsteroidPlanetImpactDebris({
      asteroid: { ...createAsteroid('medium'), velocity: { x: -8, y: 0 } },
      normal: { x: 1, y: 0 },
      position: { x: 200, y: 100 },
    });
    const averageVelocityX =
      effect.particles.reduce((sum, particle) => sum + particle.velocity.x, 0) /
      effect.particles.length;

    expect(effect.particles.length).toBeGreaterThan(20);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['shard', 'smoke', 'spark']),
    );
    expect(averageVelocityX).toBeGreaterThan(0);
  });

  it('creates black-hole planet absorption particles without ship debris', () => {
    const effect = createBlackHolePlanetAbsorption({
      blackHole: {
        absorbedFuel: 0,
        ageMs: 4000,
        airResistance: 0.01,
        angle: 0,
        baseSpeed: 2,
        blackHoleMass: 1,
        collapseStartedAt: null,
        createdAt: 0,
        damage: 0,
        id: 1,
        impact: 0,
        kind: 'blackHole',
        lifetimeMs: 10000,
        position: { x: 100, y: 100 },
        radius: 6,
        velocity: { x: -6, y: 0 },
      },
      normal: { x: 1, y: 0 },
      position: { x: 300, y: 100 },
    });

    expect(effect.particles.length).toBeGreaterThan(30);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'shockwave', 'smoke', 'spark']),
    );
    expect(effect.particles.some((particle) => particle.kind === 'panel')).toBe(false);
    expect(effect.particles.some((particle) => particle.kind === 'wing')).toBe(false);
    expect(effect.shakeDurationMs).toBeGreaterThan(0);
  });

  it('includes ship debris and a full explosion burst on player death', () => {
    const effects = createShipExplosion({ x: 120, y: 80 }, { x: 4, y: -2 });
    const particles = effects.flatMap((effect) => effect.particles);

    expect(particles.length).toBeGreaterThan(80);
    expect(new Set(particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'panel', 'shard', 'shockwave', 'smoke', 'spark', 'wing']),
    );
  });

  it('creates ship planet impact debris that ejects away from the planet center', () => {
    const effect = createShipPlanetImpactDebris({
      normal: { x: 1, y: 0 },
      position: { x: 300, y: 100 },
      velocity: { x: -12, y: 0 },
    });
    const averageVelocityX =
      effect.particles.reduce((sum, particle) => sum + particle.velocity.x, 0) /
      effect.particles.length;

    expect(effect.particles.length).toBeGreaterThan(60);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'panel', 'shard', 'smoke', 'spark', 'wing']),
    );
    expect(averageVelocityX).toBeGreaterThan(0);
    expect(effect.particles.every((particle) => particle.gravityScale === undefined)).toBe(true);
  });
});

function createAsteroid(tier: AsteroidEntity['tier']): AsteroidEntity {
  return {
    angularVelocity: 0,
    id: 1,
    position: { x: 100, y: 100 },
    rotation: 0,
    tier,
    velocity: { x: 2, y: -1 },
    visualVariant: 0,
  };
}
