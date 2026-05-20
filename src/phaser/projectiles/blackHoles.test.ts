import { describe, expect, it, vi } from 'vitest';

import type { AsteroidBodies } from '../asteroids/bodies';
import type { AsteroidEntity } from '../asteroids/types';
import type { MatterImage } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ProjectileBodies } from './bodies';
import {
  BLACK_HOLE_ASTEROID_MASS_SCALE,
  BLACK_HOLE_GROWTH_DURATION_MS,
  BLACK_HOLE_MATURE_AFTER_MS,
  BLACK_HOLE_MATURE_RADIUS,
  getBlackHoleRenderRadius,
  updateBlackHoles,
} from './blackHoles';
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
  return {
    absorbedFuel: 0,
    ageMs: BLACK_HOLE_MATURE_AFTER_MS,
    angle: 0,
    collapseStartedAt: null,
    createdAt: 0,
    id: 1,
    kind: 'blackHole',
    lifetimeMs: 10000,
    position: { x: 100, y: 0 },
    velocity: { x: 0, y: 0 },
    ...input,
  };
}

function createAsteroid(): AsteroidEntity {
  return {
    id: 1,
    position: { x: 80, y: 0 },
    tier: 'small',
    velocity: { x: 0, y: 0 },
    visualVariant: 0,
  };
}

function createBody() {
  const body = {
    body: { velocity: { x: 0, y: 0 } },
    setVelocity: vi.fn((x: number, y: number) => {
      body.body.velocity = { x, y };
    }),
  };
  return body as unknown as MatterImage;
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
  onBlackHoleRemoved?: (blackHole: ProjectileEntity) => void;
  onFuelBlobAbsorbed?: (blob: FuelBlobEntity) => void;
  onPlayerAbsorbed?: (blackHole: ProjectileEntity) => void;
  playerActive?: boolean;
  playerPosition?: { x: number; y: number };
  playerBody?: MatterImage;
  playerVelocity?: { x: number; y: number };
  projectiles?: ProjectileEntity[];
}) {
  const asteroids = input.asteroids ?? [input.asteroid ?? createAsteroid()];
  const asteroid = asteroids[0] ?? createAsteroid();
  const projectiles = input.projectiles ?? [input.blackHole];
  const asteroidBody = {
    setVelocity: vi.fn(),
  };
  const asteroidBodies = {
    get: () => asteroidBody,
  } as unknown as AsteroidBodies;
  updateBlackHoles({
    asteroids,
    asteroidBodies,
    distance: (fromX, fromY, toX, toY) => Math.hypot(toX - fromX, toY - fromY),
    fuelBlobs: input.fuelBlob ? [input.fuelBlob] : [],
    getDelta: (fromX, fromY, toX, toY) => ({ x: toX - fromX, y: toY - fromY }),
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
    onPlayerAbsorbed: input.onPlayerAbsorbed,
    player: input.playerBody && input.playerVelocity ? {
      active: input.playerActive ?? true,
      body: input.playerBody,
      position: input.playerPosition ?? { x: 80, y: 0 },
      velocity: input.playerVelocity,
    } : undefined,
    projectileBodies: createProjectileBodies(),
    projectiles,
    timeScale: 1,
  });
  return { asteroid, asteroidBody, projectiles };
}

describe('black-hole gravity', () => {
  it('pulls asteroids, player ships, and fuel blobs when mature', () => {
    const playerBody = createBody();
    const playerVelocity = { x: 0, y: 0 };
    const fuelBlob = {
      id: 1,
      position: { x: 80, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    const { asteroid, asteroidBody } = update({
      blackHole: createBlackHole(),
      fuelBlob,
      playerBody,
      playerVelocity,
    });

    expect(asteroid.velocity.x).toBeGreaterThan(0);
    expect(asteroidBody.setVelocity).toHaveBeenCalledWith(asteroid.velocity.x, asteroid.velocity.y);
    expect(playerVelocity.x).toBeGreaterThan(0);
    expect(playerBody.setVelocity).toHaveBeenCalledWith(playerVelocity.x, playerVelocity.y);
    expect(fuelBlob.velocity.x).toBeGreaterThan(0);
  });

  it('does not pull targets before the black hole matures', () => {
    const fuelBlob = {
      id: 1,
      position: { x: 80, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    const { asteroid } = update({
      blackHole: createBlackHole({ ageMs: BLACK_HOLE_MATURE_AFTER_MS - 1 }),
      fuelBlob,
    });

    expect(asteroid.velocity).toEqual({ x: 0, y: 0 });
    expect(fuelBlob.velocity).toEqual({ x: 0, y: 0 });
  });

  it('does not pull targets while collapsing', () => {
    const playerBody = createBody();
    const playerVelocity = { x: 0, y: 0 };

    const { asteroid } = update({
      blackHole: createBlackHole({ collapseStartedAt: BLACK_HOLE_MATURE_AFTER_MS }),
      playerBody,
      playerVelocity,
    });

    expect(asteroid.velocity).toEqual({ x: 0, y: 0 });
    expect(playerVelocity).toEqual({ x: 0, y: 0 });
    expect(playerBody.setVelocity).not.toHaveBeenCalled();
  });
});

describe('black-hole fuel absorption', () => {
  it('consumes fuel blobs inside a mature black hole radius', () => {
    const blackHole = createBlackHole();
    const fuelBlob = {
      id: 1,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };
    const onFuelBlobAbsorbed = vi.fn();

    update({ asteroids: [], blackHole, fuelBlob, onFuelBlobAbsorbed });

    expect(blackHole.absorbedFuel).toBe(1);
    expect(onFuelBlobAbsorbed).toHaveBeenCalledWith(fuelBlob);
  });

  it('does not consume fuel blobs outside the render radius', () => {
    const blackHole = createBlackHole();
    const fuelBlob = {
      id: 1,
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
      playerBody: createBody(),
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
      playerBody: createBody(),
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
      playerBody: createBody(),
      playerPosition: { x: 100, y: 0 },
      playerVelocity: { x: 0, y: 0 },
    });
    update({
      asteroids: [],
      blackHole: createBlackHole({ ageMs: BLACK_HOLE_MATURE_AFTER_MS - 1 }),
      onPlayerAbsorbed,
      playerBody: createBody(),
      playerPosition: { x: 100, y: 0 },
      playerVelocity: { x: 0, y: 0 },
    });
    update({
      asteroids: [],
      blackHole: createBlackHole({ collapseStartedAt: BLACK_HOLE_MATURE_AFTER_MS }),
      onPlayerAbsorbed,
      playerBody: createBody(),
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
      blackHoleMass: 4,
      createdAt: 0,
      id: 1,
      position: { x: 100, y: 0 },
      velocity: { x: 4, y: 0 },
    });
    const larger = createBlackHole({
      absorbedFuel: 5,
      blackHoleMass: 9,
      createdAt: 10,
      id: 2,
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
    expect(getBlackHoleRenderRadius(right, ageMs)).toBeCloseTo(BLACK_HOLE_MATURE_RADIUS * Math.sqrt(13));
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
    const collapsingRight = createBlackHole({ blackHoleMass: 9, id: 4, position: { x: 105, y: 0 } });
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
