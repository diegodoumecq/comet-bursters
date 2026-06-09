import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import type { PlanetEntity } from '../planets/types';
import { getMatureBlackHoleRadius, isMatureBlackHole } from '../projectiles/blackHoles';
import { BLACK_HOLE_GRAVITY_STRENGTH } from '../projectiles/definition';
import type { ProjectileEntity } from '../projectiles/types';
import { wrappedDelta } from './geometry';

type GravityPlayer = {
  active: boolean;
  gravityScale?: number;
  position: Vector;
  velocity: Vector;
};

type GravityDelta = (fromX: number, fromY: number, toX: number, toY: number) => Vector;

type WorldGravityInput = {
  asteroids?: AsteroidEntity[];
  blackHoles?: ProjectileEntity[];
  deltaSeconds: number;
  fuelBlobs?: FuelBlobEntity[];
  getDelta?: GravityDelta;
  onAsteroidVelocityChanged?: (asteroid: AsteroidEntity) => void;
  onFuelBlobVelocityChanged?: (blob: FuelBlobEntity) => void;
  onPlayerVelocityChanged?: (player: GravityPlayer) => void;
  onProjectileVelocityChanged?: (projectile: ProjectileEntity) => void;
  particles?: ParticleEntity[];
  planets?: PlanetEntity[];
  player?: GravityPlayer;
  projectiles?: ProjectileEntity[];
  world: WorldSize;
};

export type GravitySource = {
  owner?: object;
  position: Vector;
  range: number;
  strength: number;
};

type GravityTarget = {
  gravityScale?: number;
  owner?: object;
  position: Vector;
  velocity: Vector;
};

export function applyWorldGravity(input: WorldGravityInput): void {
  const sources = buildWorldGravitySources({
    blackHoles: input.blackHoles ?? input.projectiles ?? [],
    planets: input.planets ?? [],
  });
  const timeScale = input.deltaSeconds * 60;
  const getDelta =
    input.getDelta ??
    ((fromX, fromY, toX, toY) =>
      wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, input.world));

  for (const asteroid of input.asteroids ?? []) {
    if (
      applyGravityToTarget({
        getDelta,
        sources,
        target: asteroid,
        timeScale,
      })
    ) {
      input.onAsteroidVelocityChanged?.(asteroid);
    }
  }

  for (const projectile of input.projectiles ?? []) {
    if (
      applyGravityToTarget({
        getDelta,
        sources,
        target: {
          gravityScale: projectile.gravityScale,
          owner: projectile,
          position: projectile.position,
          velocity: projectile.velocity,
        },
        timeScale,
      })
    ) {
      input.onProjectileVelocityChanged?.(projectile);
    }
  }

  for (const blob of input.fuelBlobs ?? []) {
    if (
      applyGravityToTarget({
        getDelta,
        sources,
        target: blob,
        timeScale,
      })
    ) {
      input.onFuelBlobVelocityChanged?.(blob);
    }
  }

  for (const particle of input.particles ?? []) {
    applyGravityToTarget({
      getDelta,
      sources,
      target: particle,
      timeScale,
    });
  }

  if (input.player?.active) {
    if (
      applyGravityToTarget({
        getDelta,
        sources,
        target: input.player,
        timeScale,
      })
    ) {
      input.onPlayerVelocityChanged?.(input.player);
    }
  }
}

export function buildWorldGravitySources(input: {
  blackHoles?: ProjectileEntity[];
  planets?: PlanetEntity[];
}): GravitySource[] {
  return [
    ...getPlanetGravitySources(input.planets ?? []),
    ...getBlackHoleGravitySources(input.blackHoles ?? []),
  ];
}

export function applyGravityToTarget(input: {
  getDelta: GravityDelta;
  sources: GravitySource[];
  target: GravityTarget;
  timeScale: number;
}): boolean {
  const gravityScale = getGravityScale(input.target);
  if (gravityScale <= 0) return false;

  let changed = false;
  for (const source of input.sources) {
    if (source.owner === undefined || source.owner !== input.target.owner) {
      const delta = input.getDelta(
        input.target.position.x,
        input.target.position.y,
        source.position.x,
        source.position.y,
      );
      const distanceSq = delta.x * delta.x + delta.y * delta.y;
      if (distanceSq > 0 && distanceSq < source.range * source.range) {
        const distance = Math.sqrt(distanceSq);
        const force = (source.strength * gravityScale) / distanceSq;
        input.target.velocity.x += (delta.x / distance) * force * input.timeScale;
        input.target.velocity.y += (delta.y / distance) * force * input.timeScale;
        changed = true;
      }
    }
  }
  return changed;
}

export function getGravityScale(target: { gravityScale?: number }): number {
  if (target.gravityScale === undefined) return 1;
  if (!Number.isFinite(target.gravityScale)) return 0;
  return Math.min(1, Math.max(0, target.gravityScale));
}

function getPlanetGravitySources(planets: PlanetEntity[]): GravitySource[] {
  return planets.map((planet) => ({
    owner: planet,
    position: planet.position,
    range: planet.radius * 6,
    strength: planet.gravityStrength * 0.5 * planet.radius * planet.radius,
  }));
}

function getBlackHoleGravitySources(projectiles: ProjectileEntity[]): GravitySource[] {
  return projectiles
    .filter(
      (projectile) =>
        projectile.kind === 'blackHole' &&
        projectile.collapseStartedAt === null &&
        isMatureBlackHole(projectile),
    )
    .map((projectile) => {
      const radius = getMatureBlackHoleRadius(projectile);
      return {
        owner: projectile,
        position: projectile.position,
        range: radius * 6,
        strength: BLACK_HOLE_GRAVITY_STRENGTH * 0.5 * radius * radius,
      };
    });
}
