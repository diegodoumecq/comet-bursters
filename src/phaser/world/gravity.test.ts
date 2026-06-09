import { describe, expect, it, vi } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import type { PlanetEntity } from '../planets/types';
import {
  BLACK_HOLE_GROWTH_DURATION_MS,
  BLACK_HOLE_MATURE_AFTER_MS,
} from '../projectiles/definition';
import type { ProjectileEntity } from '../projectiles/types';
import { applyGravityToTarget, applyWorldGravity } from './gravity';

const world = { width: 1000, height: 1000 };

function createAsteroid(position = { x: 80, y: 0 }): AsteroidEntity {
  return {
    angularVelocity: 0,
    id: 1,
    position,
    rotation: 0,
    tier: 'small',
    velocity: { x: 0, y: 0 },
    visualVariant: 0,
  };
}

function createFuelBlob(position = { x: 80, y: 0 }): FuelBlobEntity {
  return {
    airResistance: 0.015,
    id: 1,
    position,
    velocity: { x: 0, y: 0 },
    wobbleSeed: 0,
  };
}

function createParticle(position = { x: 80, y: 0 }): ParticleEntity {
  return {
    alphaDecayPerSecond: 1,
    color: 0xffffff,
    dragPerSecond: 1,
    id: 1,
    kind: 'shard',
    lifetimeMs: 100,
    maxLifetimeMs: 100,
    position,
    rotation: 0,
    velocity: { x: 0, y: 0 },
  };
}

function createPlanet(): PlanetEntity {
  return {
    altitudeVariations: [],
    color: 0xffffff,
    colorHex: '#ffffff',
    gravityStrength: 1,
    id: 1,
    kind: 'lush',
    position: { x: 100, y: 0 },
    radius: 50,
    rotation: 0,
    rotationSpeed: 0,
  };
}

function createProjectile(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  const projectile: ProjectileEntity = {
    absorbedFuel: 0,
    ageMs: BLACK_HOLE_MATURE_AFTER_MS,
    angle: 0,
    airResistance: 0.01,
    baseSpeed: 1,
    collapseStartedAt: null,
    createdAt: 0,
    damage: 0,
    id: 1,
    impact: 0,
    kind: 'small',
    lifetimeMs: 10000,
    position: { x: 80, y: 0 },
    radius: 6,
    velocity: { x: 0, y: 0 },
  };
  return { ...projectile, ...input };
}

function createBlackHole(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  return createProjectile({
    ageMs: BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS,
    kind: 'blackHole',
    position: { x: 100, y: 0 },
    ...input,
  });
}

describe('applyWorldGravity', () => {
  it('applies planet gravity to world gravity targets by default', () => {
    const asteroid = createAsteroid();
    const fuelBlob = createFuelBlob();
    const particle = createParticle();
    const projectile = createProjectile();
    const blackHoleProjectile = createBlackHole({ id: 2, position: { x: 600, y: 0 } });
    const player = {
      active: true,
      position: { x: 80, y: 0 },
      velocity: { x: 0, y: 0 },
    };
    const onAsteroidVelocityChanged = vi.fn();
    const onFuelBlobVelocityChanged = vi.fn();
    const onPlayerVelocityChanged = vi.fn();
    const onProjectileVelocityChanged = vi.fn();

    applyWorldGravity({
      asteroids: [asteroid],
      deltaSeconds: 1 / 60,
      fuelBlobs: [fuelBlob],
      onAsteroidVelocityChanged,
      onFuelBlobVelocityChanged,
      onPlayerVelocityChanged,
      onProjectileVelocityChanged,
      particles: [particle],
      planets: [createPlanet()],
      player,
      projectiles: [projectile, blackHoleProjectile],
      world,
    });

    expect(asteroid.velocity.x).toBeGreaterThan(0);
    expect(projectile.velocity.x).toBeGreaterThan(0);
    expect(fuelBlob.velocity.x).toBeGreaterThan(0);
    expect(particle.velocity.x).toBeGreaterThan(0);
    expect(player.velocity.x).toBeGreaterThan(0);
    expect(blackHoleProjectile.velocity).toEqual({ x: 0, y: 0 });
    expect(onAsteroidVelocityChanged).toHaveBeenCalledWith(asteroid);
    expect(onProjectileVelocityChanged).toHaveBeenCalledWith(projectile);
    expect(onFuelBlobVelocityChanged).toHaveBeenCalledWith(fuelBlob);
    expect(onPlayerVelocityChanged).toHaveBeenCalledWith(player);
  });

  it('applies mature black-hole gravity to world gravity targets by default', () => {
    const asteroid = createAsteroid();
    const fuelBlob = createFuelBlob({ x: -20, y: 0 });
    const particle = createParticle();
    const player = {
      active: true,
      position: { x: 80, y: 0 },
      velocity: { x: 0, y: 0 },
    };
    const source = createBlackHole({ id: 1, position: { x: 100, y: 0 } });
    const targetBlackHole = createBlackHole({ id: 2, position: { x: 120, y: 0 } });

    applyWorldGravity({
      asteroids: [asteroid],
      deltaSeconds: 1 / 60,
      fuelBlobs: [fuelBlob],
      particles: [particle],
      player,
      projectiles: [source, targetBlackHole],
      world,
    });

    expect(asteroid.velocity.x).toBeGreaterThan(0);
    expect(fuelBlob.velocity.x).toBeGreaterThan(0);
    expect(particle.velocity.x).toBeGreaterThan(0);
    expect(player.velocity.x).toBeGreaterThan(0);
    expect(source.velocity.x).toBeGreaterThan(0);
    expect(targetBlackHole.velocity.x).toBeLessThan(0);
  });

  it('applies planet gravity to active black holes', () => {
    const blackHole = createBlackHole({ id: 1, position: { x: 80, y: 0 } });
    const onProjectileVelocityChanged = vi.fn();

    applyWorldGravity({
      deltaSeconds: 1 / 60,
      onProjectileVelocityChanged,
      planets: [createPlanet()],
      projectiles: [blackHole],
      world,
    });

    expect(blackHole.velocity.x).toBeGreaterThan(0);
    expect(onProjectileVelocityChanged).toHaveBeenCalledWith(blackHole);
  });

  it('applies one fuel blob velocity mutation for one black-hole gravity source', () => {
    const fuelBlob = createFuelBlob({ x: -20, y: 0 });
    const onFuelBlobVelocityChanged = vi.fn();

    applyWorldGravity({
      deltaSeconds: 1 / 60,
      fuelBlobs: [fuelBlob],
      onFuelBlobVelocityChanged,
      projectiles: [createBlackHole({ id: 1, position: { x: 100, y: 0 } })],
      world,
    });

    expect(fuelBlob.velocity.x).toBeGreaterThan(0);
    expect(onFuelBlobVelocityChanged).toHaveBeenCalledTimes(1);
    expect(onFuelBlobVelocityChanged).toHaveBeenCalledWith(fuelBlob);
  });

  it('scales gravity for target entities', () => {
    const fullStrength = createFuelBlob({ x: 80, y: 0 });
    const partialStrength = createFuelBlob({ x: 80, y: 0 });
    partialStrength.gravityScale = 0.25;

    applyWorldGravity({
      deltaSeconds: 1 / 60,
      fuelBlobs: [fullStrength, partialStrength],
      planets: [createPlanet()],
      world,
    });

    expect(partialStrength.velocity.x).toBeCloseTo(fullStrength.velocity.x * 0.25);
  });

  it('skips every gravity source for zero-scale particles and fuel blobs', () => {
    const fuelBlob = createFuelBlob();
    fuelBlob.gravityScale = 0;
    const particle = createParticle();
    particle.gravityScale = 0;
    const blackHole = createBlackHole({ id: 1, position: { x: 100, y: 0 } });

    applyWorldGravity({
      deltaSeconds: 1 / 60,
      fuelBlobs: [fuelBlob],
      particles: [particle],
      planets: [createPlanet()],
      projectiles: [blackHole],
      world,
    });

    expect(fuelBlob.velocity).toEqual({ x: 0, y: 0 });
    expect(particle.velocity).toEqual({ x: 0, y: 0 });
  });

  it('ignores immature and collapsing sources while still pulling collapsing black-hole targets', () => {
    const asteroid = createAsteroid();
    const immatureSource = createBlackHole({
      ageMs: BLACK_HOLE_MATURE_AFTER_MS - 1,
      id: 1,
      position: { x: 120, y: 0 },
    });
    const collapsingSource = createBlackHole({
      collapseStartedAt: BLACK_HOLE_MATURE_AFTER_MS,
      id: 2,
      position: { x: 100, y: 0 },
    });
    const matureSource = createBlackHole({ id: 3, position: { x: 100, y: 0 } });
    const collapsingTarget = createBlackHole({
      collapseStartedAt: BLACK_HOLE_MATURE_AFTER_MS,
      id: 4,
      position: { x: 120, y: 0 },
    });

    applyWorldGravity({
      asteroids: [asteroid],
      deltaSeconds: 1 / 60,
      projectiles: [immatureSource, collapsingSource, matureSource, collapsingTarget],
      world,
    });

    expect(asteroid.velocity.x).toBeGreaterThan(0);
    expect(immatureSource.velocity.x).toBeLessThan(0);
    expect(collapsingSource.velocity).toEqual({ x: 0, y: 0 });
    expect(collapsingTarget.velocity.x).toBeLessThan(0);
  });

  it('applies planet and black-hole gravity to projectile targets through the same scale', () => {
    const projectile = createProjectile({ gravityScale: 0.5, position: { x: 80, y: 0 } });
    const blackHole = createBlackHole({ id: 2, position: { x: 120, y: 0 } });

    applyWorldGravity({
      deltaSeconds: 1 / 60,
      planets: [createPlanet()],
      projectiles: [projectile, blackHole],
      world,
    });

    expect(projectile.velocity.x).toBeGreaterThan(0);
  });
});

describe('applyGravityToTarget', () => {
  it('applies anonymous gravity sources to anonymous targets', () => {
    const target = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    };

    applyGravityToTarget({
      getDelta: (fromX, fromY, toX, toY) => ({ x: toX - fromX, y: toY - fromY }),
      sources: [{ position: { x: 10, y: 0 }, range: 100, strength: 100 }],
      target,
      timeScale: 1,
    });

    expect(target.velocity.x).toBeGreaterThan(0);
  });
});
