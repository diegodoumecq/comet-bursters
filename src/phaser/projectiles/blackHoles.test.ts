import { describe, expect, it, vi } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import {
  getBlackHoleInfluenceRadius,
  getBlackHoleRenderRadius,
  updateBlackHoles,
} from './blackHoles';
import type { ProjectileBodies } from './bodies';
import {
  BLACK_HOLE_ASTEROID_MASS_SCALE,
  BLACK_HOLE_FUEL_BLOB_MASS_SCALE,
  BLACK_HOLE_GROWTH_DURATION_MS,
  BLACK_HOLE_MATURE_AFTER_MS,
  BLACK_HOLE_MATURE_RADIUS,
} from './definition';
import type { ProjectileEntity } from './types';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: () => 0,
      FloatBetween: (_min: number, max: number) => max,
    },
  },
}));

function createBlackHole(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  const blackHole: ProjectileEntity = {
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
    kind: 'blackHole',
    lifetimeMs: 10000,
    position: { x: 100, y: 0 },
    radius: 6,
    velocity: { x: 0, y: 0 },
  };
  return { ...blackHole, ...input };
}

function createAsteroid(): AsteroidEntity {
  return {
    angularVelocity: 0,
    id: 1,
    position: { x: 80, y: 0 },
    rotation: 0,
    tier: 'small',
    velocity: { x: 0, y: 0 },
    visualVariant: 0,
  };
}

function createParticle(position: { x: number; y: number }): ParticleEntity {
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

function createProjectileBodies() {
  return {
    get: () => ({
      setRadius: vi.fn(),
      setVelocity: vi.fn(),
    }),
  } as unknown as ProjectileBodies;
}

function update(input: {
  asteroid?: AsteroidEntity;
  asteroids?: AsteroidEntity[];
  blackHole: ProjectileEntity;
  fuelBlob?: FuelBlobEntity;
  fuelBlobs?: FuelBlobEntity[];
  onBlackHoleRemoved?: (blackHole: ProjectileEntity) => void;
  onFuelBlobAbsorbed?: (blob: FuelBlobEntity) => void;
  onParticleAbsorbed?: (particle: ParticleEntity) => void;
  onPlayerAbsorbed?: (blackHole: ProjectileEntity) => void;
  particles?: ParticleEntity[];
  playerActive?: boolean;
  playerPosition?: { x: number; y: number };
  playerVelocity?: { x: number; y: number };
  projectiles?: ProjectileEntity[];
}) {
  const asteroids = input.asteroids ?? [input.asteroid ?? createAsteroid()];
  const asteroid = asteroids[0] ?? createAsteroid();
  const projectiles = input.projectiles ?? [input.blackHole];
  updateBlackHoles({
    asteroids,
    distance: (fromX, fromY, toX, toY) => Math.hypot(toX - fromX, toY - fromY),
    fuelBlobs: input.fuelBlobs ?? (input.fuelBlob ? [input.fuelBlob] : []),
    now: input.blackHole.ageMs,
    onAsteroidAbsorbed: vi.fn(),
    onAsteroidRemoved: vi.fn(),
    onBlackHoleRemoved: (blackHole) => {
      input.onBlackHoleRemoved?.(blackHole);
      const index = projectiles.indexOf(blackHole);
      if (index !== -1) projectiles.splice(index, 1);
    },
    onFuelBurst: vi.fn(),
    onFuelBlobAbsorbed: input.onFuelBlobAbsorbed ?? vi.fn(),
    onParticleAbsorbed: input.onParticleAbsorbed,
    onPlayerAbsorbed: input.onPlayerAbsorbed,
    particles: input.particles,
    player: input.playerVelocity
      ? {
          active: input.playerActive ?? true,
          position: input.playerPosition ?? { x: 80, y: 0 },
          velocity: input.playerVelocity,
        }
      : undefined,
    projectileBodies: createProjectileBodies(),
    projectiles,
  });
  return { asteroid, projectiles };
}

describe('black-hole gravity', () => {
  it('scales render influence with the distortion radius', () => {
    expect(getBlackHoleInfluenceRadius(6)).toBe(200);
    expect(getBlackHoleInfluenceRadius(25)).toBeCloseTo(833.333, 3);
  });

  it('absorbs particles that collide with a mature black hole', () => {
    const particle = createParticle({ x: 100, y: 0 });
    const onParticleAbsorbed = vi.fn();

    update({
      asteroids: [],
      blackHole: createBlackHole(),
      onParticleAbsorbed,
      particles: [particle],
    });

    expect(onParticleAbsorbed).toHaveBeenCalledWith(particle);
  });

  it('absorbs zero-gravity-scale particles that collide with a mature black hole', () => {
    const particle = createParticle({ x: 100, y: 0 });
    particle.gravityScale = 0;
    const onParticleAbsorbed = vi.fn();

    update({
      asteroids: [],
      blackHole: createBlackHole(),
      onParticleAbsorbed,
      particles: [particle],
    });

    expect(onParticleAbsorbed).toHaveBeenCalledWith(particle);
  });
});

describe('black-hole fuel absorption', () => {
  it('consumes fuel blobs inside a mature black hole radius', () => {
    const blackHole = createBlackHole();
    const fuelBlob = {
      id: 1,
      airResistance: 0.015,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };
    const onFuelBlobAbsorbed = vi.fn();

    update({ asteroids: [], blackHole, fuelBlob, onFuelBlobAbsorbed });

    expect(blackHole.absorbedFuel).toBe(1);
    expect(blackHole.blackHoleMass).toBe(1 + BLACK_HOLE_FUEL_BLOB_MASS_SCALE);
    expect(onFuelBlobAbsorbed).toHaveBeenCalledWith(fuelBlob);
  });

  it('uses absorbed fuel blob mass for the black hole radius', () => {
    const ageMs = BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS;
    const blackHole = createBlackHole({ ageMs });
    const fuelBlob = {
      id: 1,
      airResistance: 0.015,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };
    const radiusBefore = getBlackHoleRenderRadius(blackHole, ageMs);

    update({ asteroids: [], blackHole, fuelBlob });

    expect(getBlackHoleRenderRadius(blackHole, ageMs)).toBeGreaterThan(radiusBefore);
  });

  it('grows the same from an asteroid and its equivalent absorbed fuel blobs', () => {
    const asteroidBlackHole = createBlackHole();
    const fuelBlackHole = createBlackHole();
    const asteroid = createAsteroid();
    asteroid.tier = 'big';
    asteroid.position = { x: 100, y: 0 };
    const fuelBlobs = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      airResistance: 0.015,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    }));

    update({ asteroid, blackHole: asteroidBlackHole });
    update({ asteroids: [], blackHole: fuelBlackHole, fuelBlobs });

    expect(asteroidBlackHole.absorbedFuel).toBe(4);
    expect(fuelBlackHole.absorbedFuel).toBe(4);
    expect(asteroidBlackHole.blackHoleMass).toBe(fuelBlackHole.blackHoleMass);
    expect(getBlackHoleRenderRadius(asteroidBlackHole)).toBe(
      getBlackHoleRenderRadius(fuelBlackHole),
    );
  });

  it('does not consume fuel blobs outside the render radius', () => {
    const blackHole = createBlackHole();
    const fuelBlob = {
      id: 1,
      airResistance: 0.015,
      position: { x: 140, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };
    const onFuelBlobAbsorbed = vi.fn();

    update({ asteroids: [], blackHole, fuelBlob, onFuelBlobAbsorbed });

    expect(blackHole.absorbedFuel).toBe(0);
    expect(onFuelBlobAbsorbed).not.toHaveBeenCalled();
  });

  it('does not consume fuel blobs before maturity or while collapsing', () => {
    const immatureBlackHole = createBlackHole({ ageMs: BLACK_HOLE_MATURE_AFTER_MS - 1 });
    const collapsingBlackHole = createBlackHole({ collapseStartedAt: BLACK_HOLE_MATURE_AFTER_MS });
    const fuelBlob = {
      id: 1,
      airResistance: 0.015,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };
    const onFuelBlobAbsorbed = vi.fn();

    update({ asteroids: [], blackHole: immatureBlackHole, fuelBlob, onFuelBlobAbsorbed });
    update({ asteroids: [], blackHole: collapsingBlackHole, fuelBlob, onFuelBlobAbsorbed });

    expect(immatureBlackHole.absorbedFuel).toBe(0);
    expect(collapsingBlackHole.absorbedFuel).toBe(0);
    expect(onFuelBlobAbsorbed).not.toHaveBeenCalled();
  });
});

describe('black-hole player absorption', () => {
  it('kills active players inside a mature black hole radius', () => {
    const blackHole = createBlackHole();
    const onPlayerAbsorbed = vi.fn();

    update({
      asteroids: [],
      blackHole,
      onPlayerAbsorbed,
      playerPosition: { x: 100, y: 0 },
      playerVelocity: { x: 0, y: 0 },
    });

    expect(onPlayerAbsorbed).toHaveBeenCalledWith(blackHole);
  });

  it('does not kill players outside the black hole and ship radii', () => {
    const onPlayerAbsorbed = vi.fn();

    update({
      asteroids: [],
      blackHole: createBlackHole(),
      onPlayerAbsorbed,
      playerPosition: { x: 150, y: 0 },
      playerVelocity: { x: 0, y: 0 },
    });

    expect(onPlayerAbsorbed).not.toHaveBeenCalled();
  });

  it('does not kill inactive players, immature black holes, or collapsing black holes', () => {
    const onPlayerAbsorbed = vi.fn();

    update({
      asteroids: [],
      blackHole: createBlackHole(),
      onPlayerAbsorbed,
      playerActive: false,
      playerPosition: { x: 100, y: 0 },
      playerVelocity: { x: 0, y: 0 },
    });
    update({
      asteroids: [],
      blackHole: createBlackHole({ ageMs: BLACK_HOLE_MATURE_AFTER_MS - 1 }),
      onPlayerAbsorbed,
      playerPosition: { x: 100, y: 0 },
      playerVelocity: { x: 0, y: 0 },
    });
    update({
      asteroids: [],
      blackHole: createBlackHole({ collapseStartedAt: BLACK_HOLE_MATURE_AFTER_MS }),
      onPlayerAbsorbed,
      playerPosition: { x: 100, y: 0 },
      playerVelocity: { x: 0, y: 0 },
    });

    expect(onPlayerAbsorbed).not.toHaveBeenCalled();
  });
});

describe('black-hole merging', () => {
  it('merges overlapping black holes into the larger survivor', () => {
    const smaller = createBlackHole({
      absorbedFuel: 3,
      ageMs: BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS,
      blackHoleMass: 4,
      createdAt: 0,
      id: 1,
      lifetimeMs: 11000,
      position: { x: 100, y: 0 },
      velocity: { x: 4, y: 0 },
    });
    const larger = createBlackHole({
      absorbedFuel: 5,
      ageMs: BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS,
      blackHoleMass: 9,
      createdAt: 10,
      id: 2,
      lifetimeMs: 12000,
      position: { x: 105, y: 0 },
      velocity: { x: 0, y: 6 },
    });
    const onBlackHoleRemoved = vi.fn();

    const { projectiles } = update({
      asteroids: [],
      blackHole: larger,
      onBlackHoleRemoved,
      projectiles: [smaller, larger],
    });

    expect(projectiles).toEqual([larger]);
    expect(onBlackHoleRemoved).toHaveBeenCalledWith(smaller);
    expect(larger.blackHoleMass).toBe(13);
    expect(larger.absorbedFuel).toBe(8);
    expect(larger.velocity.x).toBeCloseTo(16 / 13);
    expect(larger.velocity.y).toBeCloseTo(54 / 13);
  });

  it('keeps the visibly larger expanded black hole over a heavier pre-expanding one', () => {
    const expanded = createBlackHole({
      ageMs: BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS,
      blackHoleMass: 1,
      id: 1,
      position: { x: 100, y: 0 },
    });
    const preExpanding = createBlackHole({
      ageMs: BLACK_HOLE_MATURE_AFTER_MS,
      blackHoleMass: 9,
      id: 2,
      position: { x: 105, y: 0 },
    });

    const { projectiles } = update({
      asteroids: [],
      blackHole: expanded,
      projectiles: [preExpanding, expanded],
    });

    expect(projectiles).toEqual([expanded]);
    expect(expanded.blackHoleMass).toBe(10);
  });

  it('sums remaining active lifespans while preserving the survivor age', () => {
    const expanded = createBlackHole({
      ageMs: BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS,
      blackHoleMass: 1,
      id: 1,
      lifetimeMs: 9000,
      position: { x: 100, y: 0 },
    });
    const preExpanding = createBlackHole({
      ageMs: BLACK_HOLE_MATURE_AFTER_MS,
      blackHoleMass: 9,
      id: 2,
      lifetimeMs: 8000,
      position: { x: 105, y: 0 },
    });

    update({
      asteroids: [],
      blackHole: expanded,
      projectiles: [preExpanding, expanded],
    });

    expect(expanded.ageMs).toBe(BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS);
    expect(expanded.lifetimeMs).toBe(14000);
  });

  it('uses the summed mass for the merged black hole radius', () => {
    const ageMs = BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS;
    const left = createBlackHole({
      ageMs,
      blackHoleMass: 4,
      id: 1,
      position: { x: 100, y: 0 },
    });
    const right = createBlackHole({
      ageMs,
      blackHoleMass: 9,
      id: 2,
      position: { x: 120, y: 0 },
    });
    const largestSourceRadius = Math.max(
      getBlackHoleRenderRadius(left, ageMs),
      getBlackHoleRenderRadius(right, ageMs),
    );

    update({ asteroids: [], blackHole: right, projectiles: [left, right] });

    expect(right.blackHoleMass).toBe(13);
    expect(getBlackHoleRenderRadius(right, ageMs)).toBeGreaterThan(largestSourceRadius);
    expect(getBlackHoleRenderRadius(right, ageMs)).toBeCloseTo(
      BLACK_HOLE_MATURE_RADIUS * Math.sqrt(13),
    );
  });

  it('does not merge separated or collapsing black holes', () => {
    const separatedLeft = createBlackHole({ blackHoleMass: 4, id: 1, position: { x: 100, y: 0 } });
    const separatedRight = createBlackHole({ blackHoleMass: 9, id: 2, position: { x: 300, y: 0 } });
    const collapsingLeft = createBlackHole({
      blackHoleMass: 4,
      collapseStartedAt: BLACK_HOLE_MATURE_AFTER_MS,
      id: 3,
      position: { x: 100, y: 0 },
    });
    const collapsingRight = createBlackHole({
      blackHoleMass: 9,
      id: 4,
      position: { x: 105, y: 0 },
    });
    const onBlackHoleRemoved = vi.fn();

    const separated = update({
      asteroids: [],
      blackHole: separatedLeft,
      onBlackHoleRemoved,
      projectiles: [separatedLeft, separatedRight],
    });
    const collapsing = update({
      asteroids: [],
      blackHole: collapsingLeft,
      onBlackHoleRemoved,
      projectiles: [collapsingLeft, collapsingRight],
    });

    expect(separated.projectiles).toEqual([separatedLeft, separatedRight]);
    expect(collapsing.projectiles).toEqual([collapsingLeft, collapsingRight]);
    expect(onBlackHoleRemoved).not.toHaveBeenCalled();
  });

  it('grows when it absorbs asteroids', () => {
    const blackHole = createBlackHole();

    update({ blackHole });

    expect(blackHole.blackHoleMass).toBe(1 + BLACK_HOLE_ASTEROID_MASS_SCALE);
  });
});
