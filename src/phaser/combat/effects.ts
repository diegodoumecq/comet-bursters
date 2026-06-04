import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import type { Vector } from '../core/types';
import {
  spawnBurst,
  spawnDirectedBurst,
  spawnShockwave,
  spawnThrusterParticle,
} from '../particles/logic';
import type { ParticleEntity } from '../particles/types';

export type EffectResult = {
  particles: ParticleEntity[];
  shakeDurationMs: number;
  shakeIntensity: number;
};

export function createAsteroidExplosion(asteroid: AsteroidEntity, scale: number): EffectResult {
  const config = ASTEROIDS[asteroid.tier];
  const intensity = Math.max(0.45, scale);
  const particles = [
    spawnShockwave(asteroid.position, {
      color: 0xffffff,
      color2: config.color,
      inheritedVelocity: asteroid.velocity,
      lifetimeMs: 260 + config.radius * 1.2 * intensity,
      radius: 12 + config.radius * 0.24 * intensity,
    }),
    ...spawnBurst(asteroid.position, {
      color: 0xffd36b,
      color2: 0xdc2626,
      count: Math.max(7, Math.round(config.radius * 0.2 * intensity)),
      glowColor: 0xffbe5a,
      inheritedVelocity: asteroid.velocity,
      inheritedVelocityScale: 0.22,
      kind: 'core',
      lifetimeMs: 360 + config.radius * 1.3,
      radius: { min: 3, max: Math.max(6, config.radius * 0.1 * intensity) },
      speed: { min: 1.8, max: 5.2 * intensity },
    }),
    ...spawnBurst(asteroid.position, {
      color: config.color,
      color2: 0x7f1d1d,
      count: Math.max(12, Math.round(config.radius * 0.34 * intensity)),
      glowColor: 0xffc878,
      inheritedVelocity: asteroid.velocity,
      kind: 'shard',
      lifetimeMs: 620 + config.radius * 1.8,
      radius: { min: 4, max: Math.max(7, config.radius * 0.09 * intensity) },
      rotationSpeed: { min: -0.18, max: 0.18 },
      speed: { min: 1.8, max: 5.8 * intensity },
    }),
    ...spawnBurst(asteroid.position, {
      color: 0xfbbf24,
      color2: 0xf97316,
      count: Math.max(10, Math.round(config.radius * 0.24 * intensity)),
      glowColor: 0xffdc82,
      inheritedVelocity: asteroid.velocity,
      kind: 'spark',
      lifetimeMs: 480 + config.radius,
      radius: { min: 3, max: Math.max(5, config.radius * 0.055 * intensity) },
      rotationSpeed: { min: -0.24, max: 0.24 },
      speed: { min: 3.2, max: 8.2 * intensity },
    }),
    ...spawnBurst(asteroid.position, {
      color: 0x6a4631,
      color2: 0x271a19,
      count: Math.max(5, Math.round(config.radius * 0.12 * intensity)),
      dragPerSecond: 1.15,
      glowColor: 0xff965a,
      inheritedVelocity: asteroid.velocity,
      inheritedVelocityScale: 0.08,
      kind: 'smoke',
      lifetimeMs: 820 + config.radius * 2.3,
      radius: { min: 10, max: Math.max(16, config.radius * 0.18 * intensity) },
      rotationSpeed: { min: -0.035, max: 0.035 },
      speed: { min: 0.7, max: 2.6 * intensity },
      velocityBias: { x: 0, y: -0.35 },
    }),
  ];
  return {
    particles,
    shakeDurationMs: 180,
    shakeIntensity: Math.max(2, config.radius * 0.04 * intensity),
  };
}

export function createExplosionBurst(
  position: Vector,
  inheritedVelocity: Vector,
  scale: number,
): EffectResult {
  const intensity = Math.max(0.25, scale);
  const particles = [
    spawnShockwave(position, {
      color: 0xffffff,
      color2: 0xffd36b,
      inheritedVelocity,
      lifetimeMs: 240 + intensity * 120,
      radius: 14 + intensity * 8,
    }),
    ...spawnBurst(position, {
      color: 0xffd36b,
      color2: 0xdc2626,
      count: Math.max(8, Math.round(18 * intensity)),
      glowColor: 0xffbe5a,
      inheritedVelocity,
      kind: 'core',
      lifetimeMs: 360 + intensity * 140,
      radius: { min: 4, max: Math.max(6, 10 * intensity) },
      speed: { min: 2.4, max: 5.2 * intensity },
    }),
    ...spawnBurst(position, {
      color: 0xfbbf24,
      color2: 0xf97316,
      count: Math.max(8, Math.round(14 * intensity)),
      glowColor: 0xffdc82,
      inheritedVelocity,
      kind: 'spark',
      lifetimeMs: 420 + intensity * 110,
      radius: { min: 3, max: Math.max(5, 7 * intensity) },
      speed: { min: 3, max: 7.5 * intensity },
    }),
    ...spawnBurst(position, {
      color: 0x54403a,
      color2: 0x271a19,
      count: Math.max(3, Math.round(5 * intensity)),
      dragPerSecond: 1.1,
      glowColor: 0xff965a,
      inheritedVelocity,
      inheritedVelocityScale: 0.08,
      kind: 'smoke',
      lifetimeMs: 720 + intensity * 220,
      radius: { min: 10, max: Math.max(14, 22 * intensity) },
      speed: { min: 0.8, max: 2.2 * intensity },
      velocityBias: { x: 0, y: -0.35 },
    }),
  ];
  return {
    particles,
    shakeDurationMs: 240,
    shakeIntensity: 8 * intensity,
  };
}

export function createAsteroidImpactDebris(
  asteroid: AsteroidEntity,
  impactVelocity: Vector,
): EffectResult {
  const config = ASTEROIDS[asteroid.tier];
  const speed = Math.hypot(impactVelocity.x, impactVelocity.y);
  const direction = speed > 0 ? impactVelocity : asteroid.velocity;
  const particles = [
    ...spawnDirectedBurst(asteroid.position, {
      color: config.color,
      color2: 0x7f1d1d,
      count: Math.max(12, Math.round(config.radius * 0.3)),
      direction,
      glowColor: 0xffc878,
      inheritedVelocity: impactVelocity,
      kind: 'shard',
      lifetimeMs: 620,
      radius: { min: 3, max: Math.max(5, config.radius * 0.07) },
      rotationSpeed: { min: -0.22, max: 0.22 },
      speed: { min: 1.8 + speed * 0.18, max: 5.2 + speed * 0.5 },
      spreadRadians: Math.PI * 0.62,
    }),
    ...spawnDirectedBurst(asteroid.position, {
      color: 0xfbbf24,
      color2: 0xf97316,
      count: Math.max(8, Math.round(config.radius * 0.18)),
      direction,
      glowColor: 0xffdc82,
      inheritedVelocity: impactVelocity,
      kind: 'spark',
      lifetimeMs: 420,
      radius: { min: 2, max: Math.max(4, config.radius * 0.045) },
      rotationSpeed: { min: -0.28, max: 0.28 },
      speed: { min: 2.8 + speed * 0.24, max: 7.4 + speed * 0.55 },
      spreadRadians: Math.PI * 0.46,
    }),
    ...spawnDirectedBurst(asteroid.position, {
      color: 0x54403a,
      color2: 0x271a19,
      count: Math.max(4, Math.round(config.radius * 0.08)),
      direction,
      dragPerSecond: 1,
      glowColor: 0xff965a,
      inheritedVelocity: impactVelocity,
      inheritedVelocityScale: 0.08,
      kind: 'smoke',
      lifetimeMs: 760,
      radius: { min: 9, max: Math.max(14, config.radius * 0.12) },
      speed: { min: 0.8, max: 2.2 + speed * 0.12 },
      spreadRadians: Math.PI * 0.5,
      velocityBias: { x: 0, y: -0.25 },
    }),
  ];
  return {
    particles,
    shakeDurationMs: 0,
    shakeIntensity: 0,
  };
}

export function createShipExplosion(position: Vector, velocity: Vector): EffectResult[] {
  return [
    {
      particles: [
        ...spawnBurst(position, {
          color: 0x1a202c,
          color2: 0x0f172a,
          count: 10,
          glowColor: 0xe2e8f0,
          inheritedVelocity: velocity,
          inheritedVelocityScale: 0.65,
          kind: 'wing',
          lifetimeMs: 1800,
          radius: { min: 8, max: 16 },
          rotationSpeed: { min: -0.28, max: 0.28 },
          speed: { min: 2.2, max: 7.2 },
        }),
        ...spawnBurst(position, {
          color: 0xf2f6ff,
          color2: 0x9ca3af,
          count: 12,
          glowColor: 0xe2e8f0,
          inheritedVelocity: velocity,
          inheritedVelocityScale: 0.65,
          kind: 'panel',
          lifetimeMs: 1700,
          radius: { min: 7, max: 14 },
          rotationSpeed: { min: -0.34, max: 0.34 },
          speed: { min: 2, max: 7.6 },
        }),
        ...spawnBurst(position, {
          color: 0xffb454,
          color2: 0x7f1d1d,
          count: 22,
          glowColor: 0xffc878,
          inheritedVelocity: velocity,
          inheritedVelocityScale: 0.55,
          kind: 'shard',
          lifetimeMs: 1500,
          radius: { min: 5, max: 11 },
          rotationSpeed: { min: -0.35, max: 0.35 },
          speed: { min: 2.4, max: 8.5 },
        }),
      ],
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
