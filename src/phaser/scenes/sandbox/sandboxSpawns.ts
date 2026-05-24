import Phaser from 'phaser';

import { ASTEROIDS, createAsteroid } from '../../asteroids/logic';
import type { AsteroidEntity, AsteroidTier } from '../../asteroids/types';
import { overlapsAnySpawnCircle, spawnCirclesOverlap, type SpawnCircle } from '../../core/spawn';
import type { Vector, WorldSize } from '../../core/types';
import { PLAYER_COLLISION_RADIUS } from '../../player/config';
import { createPlanet, getFuelReserveForPlanet } from '../../planets/logic';
import type { PlanetEntity } from '../../planets/types';
import { wrappedDelta } from '../../world/geometry';
import { MOTHERSHIP_CARGO_BAY_OFFSET, MOTHERSHIP_WIDTH } from './Mothership';
import type { SandboxPlanetEntity } from './planetFuel';

export type SandboxStartup = {
  asteroids: AsteroidEntity[];
  planets: SandboxPlanetEntity[];
  spawnPoint: Vector;
};

const ASTEROID_TIERS: AsteroidTier[] = ['small', 'medium', 'big', 'mega'];
const DEFAULT_ATTEMPTS = 120;
const MOTHERSHIP_RESERVE_RADIUS = MOTHERSHIP_WIDTH * 0.5;
export const PLANET_COUNT = 40;
const PLANET_MARGIN = 900;
const PLANET_PADDING = 500;
const PLANET_GRID_STEP = 1800;
const ASTEROID_MARGIN = 200;
const ASTEROID_PADDING = 80;
const PLAYER_GRAVITY_SAFE_PADDING = 240;

export function createSandboxStartup(
  world: WorldSize,
  asteroidCount: number,
  planetCount = PLANET_COUNT,
): SandboxStartup {
  const spawnPoint = chooseMothershipSpawn(world);
  const reservations: SpawnCircle[] = [
    { position: spawnPoint, radius: MOTHERSHIP_RESERVE_RADIUS },
    { position: getCargoBayPosition(spawnPoint), radius: PLAYER_COLLISION_RADIUS + 120 },
  ];
  const planets = createStartupPlanets(world, getCargoBayPosition(spawnPoint), reservations, planetCount);
  for (const planet of planets) reservations.push({ position: planet.position, radius: planet.radius });
  const asteroids = createStartupAsteroids(world, asteroidCount, reservations);
  return { asteroids, planets, spawnPoint };
}

export function circlesOverlapWrapped(
  left: SpawnCircle,
  right: SpawnCircle,
  world: WorldSize,
  padding = 0,
): boolean {
  return spawnCirclesOverlap(left, right, padding, { type: 'wrapped', world });
}

export function planetInfluencesPlayerAtSpawn(
  planet: PlanetEntity,
  playerPosition: Vector,
  world: WorldSize,
): boolean {
  const delta = wrappedDelta(playerPosition, planet.position, world);
  const safeDistance = planet.radius * 6 + PLAYER_COLLISION_RADIUS + PLAYER_GRAVITY_SAFE_PADDING;
  return Math.hypot(delta.x, delta.y) <= safeDistance;
}

function chooseMothershipSpawn(world: WorldSize): Vector {
  return {
    x: world.width * 0.5 + Phaser.Math.Between(-700, 700),
    y: world.height * 0.5 + Phaser.Math.Between(-700, 700),
  };
}

function createStartupPlanets(
  world: WorldSize,
  playerSpawn: Vector,
  reservations: SpawnCircle[],
  planetCount: number,
): SandboxPlanetEntity[] {
  const planets: SandboxPlanetEntity[] = [];
  for (let index = 0; index < planetCount; index += 1) {
    const planet = createSeparatedPlanet(planets, world, playerSpawn, reservations);
    planets.push(planet);
  }
  return planets;
}

function createSeparatedPlanet(
  existingPlanets: PlanetEntity[],
  world: WorldSize,
  playerSpawn: Vector,
  reservations: SpawnCircle[],
): SandboxPlanetEntity {
  const allReservations = [
    ...reservations,
    ...existingPlanets.map((planet) => ({ position: planet.position, radius: planet.radius })),
  ];
  for (let attempt = 0; attempt < DEFAULT_ATTEMPTS; attempt += 1) {
    const candidate = withSandboxFuel(
      createPlanet(
        Phaser.Math.Between(PLANET_MARGIN, world.width - PLANET_MARGIN),
        Phaser.Math.Between(PLANET_MARGIN, world.height - PLANET_MARGIN),
      ),
    );
    if (planetPlacementIsValid(candidate, allReservations, playerSpawn, world)) return candidate;
  }
  return createGridSeparatedPlanet(allReservations, world, playerSpawn);
}

function createGridSeparatedPlanet(
  reservations: SpawnCircle[],
  world: WorldSize,
  playerSpawn: Vector,
): SandboxPlanetEntity {
  let bestCandidate: SandboxPlanetEntity | null = null;
  let y = PLANET_MARGIN;
  while (!bestCandidate && y <= world.height - PLANET_MARGIN) {
    let x = PLANET_MARGIN;
    while (!bestCandidate && x <= world.width - PLANET_MARGIN) {
      const candidate = withSandboxFuel(createPlanet(x, y));
      if (planetPlacementIsValid(candidate, reservations, playerSpawn, world)) {
        bestCandidate = candidate;
      }
      x += PLANET_GRID_STEP;
    }
    y += PLANET_GRID_STEP;
  }
  if (bestCandidate) return bestCandidate;
  throw new Error(`Unable to place sandbox planet ${reservations.length + 1}`);
}

function planetPlacementIsValid(
  planet: SandboxPlanetEntity,
  reservations: SpawnCircle[],
  playerSpawn: Vector,
  world: WorldSize,
): boolean {
  const circle = { position: planet.position, radius: planet.radius };
  const separated = !overlapsAnySpawnCircle(circle, reservations, PLANET_PADDING, { type: 'wrapped', world });
  return separated && !planetInfluencesPlayerAtSpawn(planet, playerSpawn, world);
}

function createStartupAsteroids(
  world: WorldSize,
  asteroidCount: number,
  reservations: SpawnCircle[],
): AsteroidEntity[] {
  const asteroids: AsteroidEntity[] = [];
  for (let index = 0; index < asteroidCount; index += 1) {
    const tier = ASTEROID_TIERS[Phaser.Math.Between(0, ASTEROID_TIERS.length - 1)];
    const asteroid = createSeparatedAsteroid(tier, world, [
      ...reservations,
      ...asteroids.map((existing) => ({
        position: existing.position,
        radius: ASTEROIDS[existing.tier].collisionRadius,
      })),
    ]);
    asteroids.push(asteroid);
  }
  return asteroids;
}

function createSeparatedAsteroid(
  tier: AsteroidTier,
  world: WorldSize,
  reservations: SpawnCircle[],
): AsteroidEntity {
  const radius = ASTEROIDS[tier].collisionRadius;
  const angle = Math.random() * Math.PI * 2;
  const speed = ASTEROIDS[tier].speed * Phaser.Math.FloatBetween(0.35, 0.8);
  for (let attempt = 0; attempt < DEFAULT_ATTEMPTS; attempt += 1) {
    const position = {
      x: Phaser.Math.Between(ASTEROID_MARGIN, world.width - ASTEROID_MARGIN),
      y: Phaser.Math.Between(ASTEROID_MARGIN, world.height - ASTEROID_MARGIN),
    };
    const separated = !overlapsAnySpawnCircle({ position, radius }, reservations, ASTEROID_PADDING, { type: 'wrapped', world });
    if (separated) {
      return createAsteroid(tier, position, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    }
  }
  return createAsteroid(tier, { x: world.width * 0.5, y: world.height * 0.5 }, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
}

function getCargoBayPosition(mothershipPosition: Vector): Vector {
  return {
    x: mothershipPosition.x + MOTHERSHIP_CARGO_BAY_OFFSET.x,
    y: mothershipPosition.y + MOTHERSHIP_CARGO_BAY_OFFSET.y,
  };
}

function withSandboxFuel(planet: PlanetEntity): SandboxPlanetEntity {
  return {
    ...planet,
    extractor: {
      angle: Math.random() * Math.PI * 2,
      blobs: [],
      nextExtractAt: 0,
    },
    fuelReserve: getFuelReserveForPlanet(planet),
    inspectedUntil: 0,
    visualSeed: Math.random() * Math.PI * 2,
  };
}
