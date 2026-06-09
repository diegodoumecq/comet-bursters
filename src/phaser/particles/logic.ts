import type { Vector } from '../core/types';
import type { ParticleEntity, ParticleKind } from './types';

type BurstOptions = {
  color2?: number;
  color: number;
  count: number;
  dragPerSecond?: number;
  gravityScale?: number;
  glowColor?: number;
  inheritedVelocity?: Vector;
  inheritedVelocityScale?: number;
  kind?: Exclude<ParticleKind, 'shockwave' | 'thruster'>;
  lifetimeMs: number;
  radius: { max: number; min: number };
  rotationSpeed?: { max: number; min: number };
  speed: { max: number; min: number };
  velocityBias?: Vector;
};

type DirectedBurstOptions = BurstOptions & {
  direction: Vector;
  spreadRadians: number;
};

type ShockwaveOptions = {
  color: number;
  color2?: number;
  gravityScale?: number;
  inheritedVelocity?: Vector;
  lifetimeMs: number;
  radius: number;
};

let nextParticleId = 1;

export function spawnBurst(position: Vector, options: BurstOptions): ParticleEntity[] {
  const inherited = options.inheritedVelocity ?? { x: 0, y: 0 };
  const inheritedScale = options.inheritedVelocityScale ?? 0.18;
  const velocityBias = options.velocityBias ?? { x: 0, y: 0 };
  const particles: ParticleEntity[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(options.speed.min, options.speed.max);
    particles.push(
      createParticle(position, options, {
        x: inherited.x * inheritedScale + velocityBias.x + Math.cos(angle) * speed,
        y: inherited.y * inheritedScale + velocityBias.y + Math.sin(angle) * speed,
      }),
    );
  }
  return particles;
}

export function spawnDirectedBurst(
  position: Vector,
  options: DirectedBurstOptions,
): ParticleEntity[] {
  const inherited = options.inheritedVelocity ?? { x: 0, y: 0 };
  const inheritedScale = options.inheritedVelocityScale ?? 0.18;
  const velocityBias = options.velocityBias ?? { x: 0, y: 0 };
  const directionLength = Math.hypot(options.direction.x, options.direction.y);
  const direction =
    directionLength > 0
      ? { x: options.direction.x / directionLength, y: options.direction.y / directionLength }
      : { x: 1, y: 0 };
  const baseAngle = Math.atan2(direction.y, direction.x);
  const particles: ParticleEntity[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const angle =
      baseAngle + randomBetween(-options.spreadRadians * 0.5, options.spreadRadians * 0.5);
    const speed = randomBetween(options.speed.min, options.speed.max);
    particles.push(
      createParticle(position, options, {
        x: inherited.x * inheritedScale + velocityBias.x + Math.cos(angle) * speed,
        y: inherited.y * inheritedScale + velocityBias.y + Math.sin(angle) * speed,
      }),
    );
  }
  return particles;
}

export function spawnShockwave(position: Vector, options: ShockwaveOptions): ParticleEntity {
  const inherited = options.inheritedVelocity ?? { x: 0, y: 0 };
  return {
    alphaDecayPerSecond: 1 / (options.lifetimeMs / 1000),
    color: options.color,
    color2: options.color2,
    dragPerSecond: 2.4,
    glowColor: options.color,
    gravityScale: options.gravityScale,
    id: nextParticleId++,
    kind: 'shockwave',
    lifetimeMs: options.lifetimeMs,
    maxLifetimeMs: options.lifetimeMs,
    position: { x: position.x, y: position.y },
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: 0,
    size: options.radius,
    velocity: { x: inherited.x * 0.2, y: inherited.y * 0.2 },
  };
}

export function updateParticle(particle: ParticleEntity, deltaMs: number): boolean {
  particle.lifetimeMs -= deltaMs;
  const deltaSeconds = deltaMs / 1000;
  const drag = getParticleDrag(particle, deltaSeconds);
  particle.velocity.x *= drag;
  particle.velocity.y *= drag;
  if (particle.kind === 'smoke') {
    particle.velocity.y -= (0.015 * deltaMs) / (1000 / 60);
    particle.size = (particle.size ?? particle.radius ?? 1) * Math.exp(0.36 * deltaSeconds);
  }
  if (particle.kind === 'shockwave') {
    particle.size = (particle.size ?? 1) * Math.exp(6.2 * deltaSeconds);
  }
  particle.position.x += (particle.velocity.x * deltaMs) / (1000 / 60);
  particle.position.y += (particle.velocity.y * deltaMs) / (1000 / 60);
  if (particle.rotationSpeed) {
    particle.rotation += (particle.rotationSpeed * deltaMs) / (1000 / 60);
  }
  return particle.lifetimeMs > 0;
}

function createParticle(position: Vector, options: BurstOptions, velocity: Vector): ParticleEntity {
  const radius = randomBetween(options.radius.min, options.radius.max);
  return {
    alphaDecayPerSecond: 1 / (options.lifetimeMs / 1000),
    color: options.color,
    color2: options.color2,
    dragPerSecond: options.dragPerSecond ?? 1.8,
    gravityScale: options.gravityScale,
    glowColor: options.glowColor,
    id: nextParticleId++,
    kind: options.kind ?? 'circle',
    lifetimeMs: options.lifetimeMs,
    maxLifetimeMs: options.lifetimeMs,
    position: { x: position.x, y: position.y },
    radius,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: getRotationSpeed(options),
    size: radius,
    velocity,
  };
}

function getRotationSpeed(options: BurstOptions): number {
  const range = options.rotationSpeed ?? { min: -0.1, max: 0.1 };
  return randomBetween(range.min, range.max);
}

function getParticleDrag(particle: ParticleEntity, deltaSeconds: number): number {
  const dragPerSecond =
    particle.kind === 'smoke'
      ? particle.dragPerSecond * 2.8
      : particle.kind === 'shockwave'
        ? particle.dragPerSecond * 1.6
        : particle.dragPerSecond;
  return Math.exp(-dragPerSecond * deltaSeconds);
}

export function spawnThrusterParticle(
  position: Vector,
  direction: Vector,
  power: number,
): ParticleEntity | null {
  if (Math.abs(direction.x) < 0.01 && Math.abs(direction.y) < 0.01) return null;
  const clampedPower = Math.max(0.1, Math.min(1, power));
  const spread = 0.32 + clampedPower * 0.18;
  const randomAngle = randomBetween(-spread * 0.5, spread * 0.5);
  const cos = Math.cos(randomAngle);
  const sin = Math.sin(randomAngle);
  const vx = direction.x * cos - direction.y * sin;
  const vy = direction.x * sin + direction.y * cos;
  const speed = randomBetween(4, 10) * (0.38 + clampedPower * 0.62);
  const lifetimeFactor = 0.5 + Math.pow(Math.random(), 0.55) * 0.5;
  const lifetimeMs = 700 * lifetimeFactor;
  const size = randomBetween(8, 16) * (0.58 + clampedPower * 0.42);
  const color =
    clampedPower < 0.5
      ? interpolateColor(0xbfdbfe, 0x38bdf8, (lifetimeFactor - 0.5) * 2)
      : interpolateColor(0xfff93d, 0xff3f05, (lifetimeFactor - 0.5) * 2);
  return {
    alphaDecayPerSecond: 1 / 0.7,
    color,
    dragPerSecond: 3.08,
    id: nextParticleId++,
    kind: 'thruster',
    lifetimeMs,
    maxLifetimeMs: 700,
    position: { x: position.x, y: position.y },
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: randomBetween(-0.05, 0.05),
    size,
    velocity: { x: vx * speed, y: vy * speed },
  };
}

export function updateParticles(particles: ParticleEntity[], deltaMs: number): ParticleEntity[] {
  return particles.filter((particle) => !updateParticle(particle, deltaMs));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function interpolateColor(from: number, to: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const fromRgb = toRgb(from);
  const toRgbValue = toRgb(to);
  return (
    (mixChannel(fromRgb.r, toRgbValue.r, t) << 16) |
    (mixChannel(fromRgb.g, toRgbValue.g, t) << 8) |
    mixChannel(fromRgb.b, toRgbValue.b, t)
  );
}

function toRgb(color: number): { b: number; g: number; r: number } {
  return {
    b: color & 255,
    g: (color >> 8) & 255,
    r: (color >> 16) & 255,
  };
}

function mixChannel(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}
