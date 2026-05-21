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
const PLANET_COUNT = 8;
const PLANET_MARGIN = 900;
const PLANET_PADDING = 500;
const ASTEROID_MARGIN = 200;
const ASTEROID_PADDING = 80;
const PLAYER_GRAVITY_SAFE_PADDING = 240;

export function createSandboxStartup(world: WorldSize, asteroidCount: number): SandboxStartup {
  const spawnPoint = chooseMothershipSpawn(world);
  const reservations: SpawnCircle[] = [
    { position: spawnPoint, radius: MOTHERSHIP_RESERVE_RADIUS },
    { position: getCargoBayPosition(spawnPoint), radius: PLAYER_COLLISION_RADIUS + 120 },
  ];
  const planets = createStartupPlanets(world, getCargoBayPosition(spawnPoint), reservations);
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
): SandboxPlanetEntity[] {
  const planets: SandboxPlanetEntity[] = [];
  for (let index = 0; index < PLANET_COUNT; index += 1) {
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
    const circle = { position: candidate.position, radius: candidate.radius };
    const separated = !overlapsAnySpawnCircle(circle, allReservations, PLANET_PADDING, { type: 'wrapped', world });
    if (separated && !planetInfluencesPlayerAtSpawn(candidate, playerSpawn, world)) return candidate;
  }
  return withSandboxFuel(createPlanet(world.width * 0.5, world.height * 0.5));
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
