import { describe, expect, it, vi } from 'vitest';

import type { AsteroidBodies } from '../asteroids/bodies';
import type { AsteroidEntity } from '../asteroids/types';
import type { MatterImage } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ProjectileBodies } from './bodies';
import {
  BLACK_HOLE_MATURE_AFTER_MS,
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
  onFuelBlobAbsorbed?: (blob: FuelBlobEntity) => void;
  onPlayerAbsorbed?: (blackHole: ProjectileEntity) => void;
  playerActive?: boolean;
  playerPosition?: { x: number; y: number };
  playerBody?: MatterImage;
  playerVelocity?: { x: number; y: number };
}) {
  const asteroids = input.asteroids ?? [input.asteroid ?? createAsteroid()];
  const asteroid = asteroids[0] ?? createAsteroid();
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
    onBlackHoleRemoved: vi.fn(),
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
    projectiles: [input.blackHole],
    timeScale: 1,
  });
  return { asteroid, asteroidBody };
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
