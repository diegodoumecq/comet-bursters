import { ASTEROIDS, createAsteroid } from '../../asteroids/logic';
import type { AsteroidEntity, AsteroidTier } from '../../asteroids/types';
import { createSeededRandom, type RandomSource } from '../../core/random';
import { overlapsAnySpawnCircle, spawnCirclesOverlap, type SpawnCircle } from '../../core/spawn';
import type { Vector, WorldSize } from '../../core/types';
import { PLANET_SPECS } from '../../planets/config';
import {
  createFuelExtractionPlanet,
  type FuelExtractionPlanetEntity,
} from '../../planets/fuelExtraction';
import { createPlanet } from '../../planets/logic';
import type { PlanetEntity } from '../../planets/types';
import { PLAYER_COLLISION_RADIUS } from '../../player/config';
import { wrappedDelta } from '../../world/geometry';
import { createSandboxBiomeSpawnPlan, type SandboxBiomeRegion } from './biomeGeneration';
import { MOTHERSHIP_CARGO_BAY_OFFSET, MOTHERSHIP_WIDTH } from './Mothership';
import type { NebulaRegion } from './nebulaRegions';
import { SANDBOX_WORLD_CONFIG, type SandboxWorldConfig } from './sandboxWorldConfig';

export type SandboxStartup = {
  asteroids: AsteroidEntity[];
  biomes: SandboxBiomeRegion[];
  nebulaRegions: NebulaRegion[];
  planets: FuelExtractionPlanetEntity[];
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
const DEFAULT_PLAYTHROUGH_SEED = 'sandbox-playthrough-v1';

export function createSandboxStartup(
  world: WorldSize = SANDBOX_WORLD_CONFIG.world,
  asteroidCount = 22,
  planetCount = PLANET_COUNT,
  config: SandboxWorldConfig = { ...SANDBOX_WORLD_CONFIG, world },
  playthroughSeed = DEFAULT_PLAYTHROUGH_SEED,
): SandboxStartup {
  const entityRandom = createSeededRandom(`${playthroughSeed}:entities`);
  const spawnPoint = config.spawnPoint;
  const reservations: SpawnCircle[] = [
    { position: spawnPoint, radius: MOTHERSHIP_RESERVE_RADIUS },
    { position: getCargoBayPosition(spawnPoint), radius: PLAYER_COLLISION_RADIUS + 120 },
  ];
  const plan = createSandboxBiomeSpawnPlan(config, reservations, `${playthroughSeed}:biomes`);
  const planets = createStartupPlanets(
    world,
    getCargoBayPosition(spawnPoint),
    reservations,
    plan,
    entityRandom,
    planetCount,
  );
  for (const planet of planets)
    reservations.push({ position: planet.position, radius: planet.radius });
  const asteroids = createStartupAsteroids(world, asteroidCount, reservations, plan, entityRandom);
  return {
    asteroids,
    biomes: plan.biomes,
    nebulaRegions: plan.nebulaRegions,
    planets,
    spawnPoint,
  };
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

function createStartupPlanets(
  world: WorldSize,
  playerSpawn: Vector,
  reservations: SpawnCircle[],
  plan: ReturnType<typeof createSandboxBiomeSpawnPlan>,
  random: RandomSource,
  planetCount: number,
): FuelExtractionPlanetEntity[] {
  const plannedPlanets = plan.planets
    .map((planned) => ({
      planet: withSandboxFuel(
        createPlanet(planned.position.x, planned.position.y, PLANET_SPECS[planned.kind], random),
        random,
      ),
      source: planned.source,
    }))
    .filter(
      (planned) =>
        planned.source === 'authored' ||
        planetPlacementIsValid(planned.planet, reservations, playerSpawn, world),
    )
    .map((planned) => planned.planet);
  if (plannedPlanets.length > 0) return plannedPlanets;
  return createFallbackPlanets(world, playerSpawn, reservations, random, planetCount);
}

function createFallbackPlanets(
  world: WorldSize,
  playerSpawn: Vector,
  reservations: SpawnCircle[],
  random: RandomSource,
  planetCount: number,
): FuelExtractionPlanetEntity[] {
  const planets: FuelExtractionPlanetEntity[] = [];
  for (let index = 0; index < planetCount; index += 1) {
    const planet = createSeparatedPlanet(planets, world, playerSpawn, reservations, random);
    planets.push(planet);
  }
  return planets;
}

function createSeparatedPlanet(
  existingPlanets: PlanetEntity[],
  world: WorldSize,
  playerSpawn: Vector,
  reservations: SpawnCircle[],
  random: RandomSource,
): FuelExtractionPlanetEntity {
  const allReservations = [
    ...reservations,
    ...existingPlanets.map((planet) => ({ position: planet.position, radius: planet.radius })),
  ];
  for (let attempt = 0; attempt < DEFAULT_ATTEMPTS; attempt += 1) {
    const candidate = withSandboxFuel(
      createPlanet(
        random.between(PLANET_MARGIN, world.width - PLANET_MARGIN),
        random.between(PLANET_MARGIN, world.height - PLANET_MARGIN),
        undefined,
        random,
      ),
      random,
    );
    if (planetPlacementIsValid(candidate, allReservations, playerSpawn, world)) return candidate;
  }
  return createGridSeparatedPlanet(allReservations, world, playerSpawn, random);
}

function createGridSeparatedPlanet(
  reservations: SpawnCircle[],
  world: WorldSize,
  playerSpawn: Vector,
  random: RandomSource,
): FuelExtractionPlanetEntity {
  let bestCandidate: FuelExtractionPlanetEntity | null = null;
  let y = PLANET_MARGIN;
  while (!bestCandidate && y <= world.height - PLANET_MARGIN) {
    let x = PLANET_MARGIN;
    while (!bestCandidate && x <= world.width - PLANET_MARGIN) {
      const candidate = withSandboxFuel(createPlanet(x, y, undefined, random), random);
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
  planet: FuelExtractionPlanetEntity,
  reservations: SpawnCircle[],
  playerSpawn: Vector,
  world: WorldSize,
): boolean {
  const circle = { position: planet.position, radius: planet.radius };
  const separated = !overlapsAnySpawnCircle(circle, reservations, PLANET_PADDING, {
    type: 'wrapped',
    world,
  });
  return separated && !planetInfluencesPlayerAtSpawn(planet, playerSpawn, world);
}

function createStartupAsteroids(
  world: WorldSize,
  asteroidCount: number,
  reservations: SpawnCircle[],
  plan: ReturnType<typeof createSandboxBiomeSpawnPlan>,
  random: RandomSource,
): AsteroidEntity[] {
  const asteroids = plan.asteroids.map((planned) =>
    createAsteroid(planned.tier, planned.position, planned.velocity, random),
  );
  if (asteroids.length > 0) return asteroids;
  return createFallbackAsteroids(world, asteroidCount, reservations, random);
}

function createFallbackAsteroids(
  world: WorldSize,
  asteroidCount: number,
  reservations: SpawnCircle[],
  random: RandomSource,
): AsteroidEntity[] {
  const asteroids: AsteroidEntity[] = [];
  for (let index = 0; index < asteroidCount; index += 1) {
    const tier = ASTEROID_TIERS[random.between(0, ASTEROID_TIERS.length - 1)];
    const asteroid = createSeparatedAsteroid(
      tier,
      world,
      [
        ...reservations,
        ...asteroids.map((existing) => ({
          position: existing.position,
          radius: ASTEROIDS[existing.tier].collisionRadius,
        })),
      ],
      random,
    );
    asteroids.push(asteroid);
  }
  return asteroids;
}

function createSeparatedAsteroid(
  tier: AsteroidTier,
  world: WorldSize,
  reservations: SpawnCircle[],
  random: RandomSource,
): AsteroidEntity {
  const radius = ASTEROIDS[tier].collisionRadius;
  const angle = random.float() * Math.PI * 2;
  const speed = ASTEROIDS[tier].speed * random.floatBetween(0.35, 0.8);
  for (let attempt = 0; attempt < DEFAULT_ATTEMPTS; attempt += 1) {
    const position = {
      x: random.between(ASTEROID_MARGIN, world.width - ASTEROID_MARGIN),
      y: random.between(ASTEROID_MARGIN, world.height - ASTEROID_MARGIN),
    };
    const separated = !overlapsAnySpawnCircle(
      { position, radius },
      reservations,
      ASTEROID_PADDING,
      { type: 'wrapped', world },
    );
    if (separated) {
      return createAsteroid(
        tier,
        position,
        {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        random,
      );
    }
  }
  return createAsteroid(
    tier,
    { x: world.width * 0.5, y: world.height * 0.5 },
    { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    random,
  );
}

function getCargoBayPosition(mothershipPosition: Vector): Vector {
  return {
    x: mothershipPosition.x + MOTHERSHIP_CARGO_BAY_OFFSET.x,
    y: mothershipPosition.y + MOTHERSHIP_CARGO_BAY_OFFSET.y,
  };
}

function withSandboxFuel(planet: PlanetEntity, random: RandomSource): FuelExtractionPlanetEntity {
  return createFuelExtractionPlanet(planet, random);
}
