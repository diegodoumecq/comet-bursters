import type { AsteroidEntity } from '../../asteroids/types';
import type { ParticleEntity } from '../../particles/types';
import type { Vector } from '../../core/types';
import { ASTEROIDS } from '../../asteroids/logic';
import { spawnBurst, spawnThrusterParticle } from '../../particles/logic';

export type EffectResult = {
  particles: ParticleEntity[];
  shakeDurationMs: number;
  shakeIntensity: number;
};

export function createAsteroidExplosion(asteroid: AsteroidEntity, scale: number): EffectResult {
  const config = ASTEROIDS[asteroid.tier];
  return {
    particles: spawnBurst(asteroid.position, {
      color: config.color,
      count: Math.max(8, Math.round(config.radius * 0.18 * scale)),
      inheritedVelocity: asteroid.velocity,
      lifetimeMs: 420,
      radius: { min: 2, max: Math.max(4, config.radius * 0.08) },
      speed: { min: 1.3333, max: 4.3333 * scale },
    }),
    shakeDurationMs: 180,
    shakeIntensity: Math.max(2, config.radius * 0.04 * scale),
  };
}

export function createExplosionBurst(position: Vector, inheritedVelocity: Vector, scale: number): EffectResult {
  return {
    particles: spawnBurst(position, {
      color: 0xffffff,
      count: Math.round(10 * scale),
      inheritedVelocity,
      lifetimeMs: 260,
      radius: { min: 2, max: 5 * scale },
      speed: { min: 1.1667, max: 3.6667 * scale },
    }),
    shakeDurationMs: 240,
    shakeIntensity: 8 * scale,
  };
}

export function createShipExplosion(position: Vector, velocity: Vector): EffectResult[] {
  return [
    {
      particles: spawnBurst(position, {
        color: 0xffb454,
        count: 26,
        inheritedVelocity: velocity,
        lifetimeMs: 680,
        radius: { min: 2, max: 7 },
        speed: { min: 1.8333, max: 6.5 },
      }),
      shakeDurationMs: 0,
      shakeIntensity: 0,
    },
    createExplosionBurst(position, velocity, 1.4),
  ];
}

export function createThrusterParticles(
  emitter: Vector,
  direction: Vector,
  thrustScale: number,
): ParticleEntity[] {
  const particle = spawnThrusterParticle(emitter, direction, thrustScale);
  if (!particle) return [];
  return [particle];
}
