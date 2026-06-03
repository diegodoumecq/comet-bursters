import { ASTEROIDS } from '../../asteroids/config';
import type { AsteroidTier } from '../../asteroids/types';
import type { RandomSource } from '../../core/random';
import { createSeededRandom, pickWeighted } from '../../core/random';
import type { SpawnCircle } from '../../core/spawn';
import type { Vector, WorldSize } from '../../core/types';
import { PLANET_SPECS } from '../../planets/config';
import type { PlanetKind } from '../../planets/types';
import type { NebulaRegion } from './nebulaRegions';
import type {
  SandboxAuthoredAsteroidConfig,
  SandboxAuthoredPlanetConfig,
  SandboxBiomeConfig,
  SandboxBiomePreset,
  SandboxLandmarkConfig,
  SandboxWorldConfig,
} from './sandboxWorldConfig';

export type SandboxBiomeRegion = {
  id: string;
  points: Vector[];
  profile: Required<SandboxBiomePreset>;
  source: 'authored' | 'generated';
};

export type SandboxBiomeSpawnPlan = {
  asteroids: {
    position: Vector;
    source: 'authored' | 'generated';
    tier: AsteroidTier;
    velocity: Vector;
  }[];
  biomes: SandboxBiomeRegion[];
  nebulaRegions: NebulaRegion[];
  planets: { kind: PlanetKind; position: Vector; source: 'authored' | 'generated' }[];
};

const AREA_UNIT = 1_000_000;
const VORONOI_NEIGHBOR_LIMIT = 10;
const VORONOI_SITE_CANDIDATES = 12;
const GENERATED_BIOME_OVERLAP_SHRINK_STEPS = [0.82, 0.68, 0.54, 0.42];
const DEFAULT_PROFILE: Required<SandboxBiomePreset> = {
  asteroidDensity: 0,
  asteroidTiers: [{ value: 'small', weight: 1 }],
  nebulaDensity: 0,
  nebulaEffectCombos: [{ value: { effects: [] }, weight: 1 }],
  nebulaVisuals: {
    alphaScale: 1.22,
    blue: { b: 0.576, g: 0.22, r: 0.078 },
    coreStrength: 0.34,
    cyan: { b: 0.62, g: 0.502, r: 0.078 },
    densityScale: 1.28,
    hazeStrength: 0.42,
    highlight: { b: 0.937, g: 0.678, r: 0.361 },
    tint: { b: 0.878, g: 0.78, r: 0.259 },
    tintStrength: 0.42,
    violet: { b: 0.478, g: 0.11, r: 0.278 },
  },
  planetDensity: 0,
  planetKinds: [{ value: 'desert', weight: 1 }],
};

export function createSandboxBiomeSpawnPlan(
  config: SandboxWorldConfig,
  reservations: SpawnCircle[],
  playthroughSeed: string,
): SandboxBiomeSpawnPlan {
  const random = createSeededRandom(playthroughSeed);
  const landmarkSpawns = createLandmarkSpawns(config.landmarks, random);
  const authored = config.authoredBiomes.map((biome) =>
    resolveBiomeConfig(config, biome, 'authored'),
  );
  const generated = createGeneratedBiomeRegions(config, authored, random);
  const biomes = [...authored, ...generated];
  const authoredPlanets = [...config.authoredPlanets, ...landmarkSpawns.planets].map((planet) => ({
    ...planet,
    source: 'authored' as const,
  }));
  const authoredAsteroids = [...config.authoredAsteroids, ...landmarkSpawns.asteroids].map((asteroid) => ({
    position: asteroid.position,
    source: 'authored' as const,
    tier: asteroid.tier,
    velocity: asteroid.velocity ?? createAsteroidVelocity(asteroid.tier, random),
  }));
  const authoredNebulaReservations = config.authoredNebulaRegions.map((region) =>
    createNebulaReservation(region),
  );
  const authoredReservations = [
    ...reservations,
    ...authoredPlanets.map((planet) => ({
      position: planet.position,
      radius: PLANET_SPECS[planet.kind].radius,
    })),
    ...authoredAsteroids.map((asteroid) => ({
      position: asteroid.position,
      radius: ASTEROIDS[asteroid.tier].collisionRadius,
    })),
    ...authoredNebulaReservations,
  ];
  const proceduralPlanets = createPlanetPlans(biomes, authoredReservations, config.world, random);
  const planets = [...authoredPlanets, ...proceduralPlanets];
  const proceduralPlanetReservations = proceduralPlanets.map((planet) => ({
    position: planet.position,
    radius: PLANET_SPECS[planet.kind].radius,
  }));
  const proceduralAsteroids = createAsteroidPlans(
    biomes,
    [...authoredReservations, ...proceduralPlanetReservations],
    config.world,
    random,
  );
  const asteroids = [...authoredAsteroids, ...proceduralAsteroids];
  const proceduralAsteroidReservations = proceduralAsteroids.map((asteroid) => ({
    position: asteroid.position,
    radius: ASTEROIDS[asteroid.tier].collisionRadius,
  }));
  const nebulaRegions = [
    ...config.authoredNebulaRegions,
    ...createNebulaPlans(
      biomes,
      [
        ...authoredReservations,
        ...proceduralPlanetReservations,
        ...proceduralAsteroidReservations,
      ],
      config.world,
      random,
    ),
  ];
  return { asteroids, biomes, nebulaRegions, planets };
}

function createLandmarkSpawns(
  landmarks: SandboxLandmarkConfig[],
  random: RandomSource,
): { asteroids: SandboxAuthoredAsteroidConfig[]; planets: SandboxAuthoredPlanetConfig[] } {
  const asteroids: SandboxAuthoredAsteroidConfig[] = [];
  const planets: SandboxAuthoredPlanetConfig[] = [];
  for (const landmark of landmarks) {
    if (landmark.type === 'planetAsteroidBelt') {
      planets.push(landmark.planet);
      asteroids.push(...createPlanetAsteroidBelt(landmark, random));
    }
  }
  return { asteroids, planets };
}

function createPlanetAsteroidBelt(
  landmark: Extract<SandboxLandmarkConfig, { type: 'planetAsteroidBelt' }>,
  random: RandomSource,
): SandboxAuthoredAsteroidConfig[] {
  const asteroids: SandboxAuthoredAsteroidConfig[] = [];
  const tier = landmark.asteroidTier ?? 'small';
  for (let index = 0; index < landmark.asteroidCount; index += 1) {
    const angle = (Math.PI * 2 * index) / landmark.asteroidCount;
    const tangentSpeed = ASTEROIDS[tier].speed * random.floatBetween(0.55, 0.85);
    asteroids.push({
      position: {
        x: landmark.planet.position.x + Math.cos(angle) * landmark.orbitRadius,
        y: landmark.planet.position.y + Math.sin(angle) * landmark.orbitRadius,
      },
      tier,
      velocity: {
        x: -Math.sin(angle) * tangentSpeed,
        y: Math.cos(angle) * tangentSpeed,
      },
    });
  }
  return asteroids;
}

function createAsteroidVelocity(tier: AsteroidTier, random: RandomSource): Vector {
  const angle = random.floatBetween(0, Math.PI * 2);
  const speed = ASTEROIDS[tier].speed * random.floatBetween(0.35, 0.8);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

function createNebulaReservation(region: NebulaRegion): SpawnCircle {
  const center = region.points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= region.points.length;
  center.y /= region.points.length;
  const radius = region.points.reduce(
    (maxDistance, point) =>
      Math.max(maxDistance, Math.hypot(point.x - center.x, point.y - center.y)),
    0,
  );
  return { position: center, radius };
}

function resolveBiomeConfig(
  config: SandboxWorldConfig,
  biome: SandboxBiomeConfig,
  source: SandboxBiomeRegion['source'],
): SandboxBiomeRegion {
  const presetProfile = [...config.defaultBiomePresets, ...biome.presets].reduce(
    (profile, presetId) => ({ ...profile, ...config.biomePresets[presetId] }),
    DEFAULT_PROFILE,
  );
  return {
    id: biome.id,
    points: biome.points,
    profile: { ...presetProfile, ...withoutUndefined(withoutIdentity(biome)) },
    source,
  };
}

function withoutIdentity(biome: SandboxBiomeConfig): SandboxBiomePreset {
  const {
    asteroidDensity,
    asteroidTiers,
    nebulaDensity,
    nebulaEffectCombos,
    nebulaVisuals,
    planetDensity,
    planetKinds,
  } = biome;
  return {
    asteroidDensity,
    asteroidTiers,
    nebulaDensity,
    nebulaEffectCombos,
    nebulaVisuals,
    planetDensity,
    planetKinds,
  };
}

function withoutUndefined(profile: SandboxBiomePreset): SandboxBiomePreset {
  return Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined),
  ) as SandboxBiomePreset;
}

function createGeneratedBiomeRegions(
  config: SandboxWorldConfig,
  authored: SandboxBiomeRegion[],
  random: RandomSource,
): SandboxBiomeRegion[] {
  const generated: SandboxBiomeRegion[] = [];
  const authoredPolygons = authored.map((biome) => biome.points);
  const sites = createGeneratedBiomeSites(config.world, config.generatedBiomeSize, random);
  for (let index = 0; index < sites.length; index += 1) {
    const points = resolveGeneratedBiomePolygon(
      createVoronoiBiomePolygon(sites[index], sites, config.world),
      sites[index],
      authoredPolygons,
      config.world,
    );
    if (points.length >= 3 && !polygonTouchesAnyWrapped(points, authoredPolygons, config.world)) {
      const preset = chooseGeneratedPreset(points, config, random);
      generated.push(
        resolveBiomeConfig(
          config,
          { id: `generated-${generated.length}`, points, presets: [preset] },
          'generated',
        ),
      );
    }
  }
  return generated;
}

function resolveGeneratedBiomePolygon(
  points: Vector[],
  site: Vector,
  authoredPolygons: Vector[][],
  world: WorldSize,
): Vector[] {
  if (!polygonTouchesAnyWrapped(points, authoredPolygons, world)) return points;
  for (const scale of GENERATED_BIOME_OVERLAP_SHRINK_STEPS) {
    const candidate = points.map((point) => ({
      x: site.x + (point.x - site.x) * scale,
      y: site.y + (point.y - site.y) * scale,
    }));
    if (!polygonTouchesAnyWrapped(candidate, authoredPolygons, world)) return candidate;
  }
  return [];
}

function createGeneratedBiomeSites(
  world: WorldSize,
  spacing: number,
  random: RandomSource,
): Vector[] {
  const sites: Vector[] = [];
  const targetCount = Math.max(1, Math.round((world.width * world.height) / (spacing * spacing)));
  sites.push({
    x: random.floatBetween(spacing * 0.25, world.width - spacing * 0.25),
    y: random.floatBetween(spacing * 0.25, world.height - spacing * 0.25),
  });
  while (sites.length < targetCount) {
    sites.push(createBestCandidateBiomeSite(sites, world, spacing, random));
  }
  return sites;
}

function createBestCandidateBiomeSite(
  sites: Vector[],
  world: WorldSize,
  spacing: number,
  random: RandomSource,
): Vector {
  let bestCandidate = createBiomeSiteCandidate(world, spacing, random);
  let bestDistance = nearestWrappedSiteDistanceSquared(bestCandidate, sites, world);
  for (let index = 1; index < VORONOI_SITE_CANDIDATES; index += 1) {
    const candidate = createBiomeSiteCandidate(world, spacing, random);
    const distance = nearestWrappedSiteDistanceSquared(candidate, sites, world);
    if (distance > bestDistance) {
      bestCandidate = candidate;
      bestDistance = distance;
    }
  }
  return bestCandidate;
}

function createBiomeSiteCandidate(world: WorldSize, spacing: number, random: RandomSource): Vector {
  const margin = Math.min(spacing * 0.2, world.width * 0.05, world.height * 0.05);
  return {
    x: random.floatBetween(margin, world.width - margin),
    y: random.floatBetween(margin, world.height - margin),
  };
}

function nearestWrappedSiteDistanceSquared(
  point: Vector,
  sites: Vector[],
  world: WorldSize,
): number {
  return sites.reduce(
    (nearest, site) => Math.min(nearest, squaredWrappedDistance(point, site, world)),
    Number.POSITIVE_INFINITY,
  );
}

function createVoronoiBiomePolygon(site: Vector, sites: Vector[], world: WorldSize): Vector[] {
  let polygon = getLocalWrappedWorldPolygon(site, world);
  const neighbors = createWrappedVoronoiNeighborSites(site, sites, world)
    .map((neighbor) => ({
      distance: squaredDistance(site, neighbor),
      site: neighbor,
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, VORONOI_NEIGHBOR_LIMIT);

  for (const neighbor of neighbors) {
    polygon = clipPolygonToVoronoiHalfPlane(polygon, site, neighbor.site);
    if (polygon.length === 0) return [];
  }
  return polygon;
}

function createWrappedVoronoiNeighborSites(
  site: Vector,
  sites: Vector[],
  world: WorldSize,
): Vector[] {
  const neighbors: Vector[] = [];
  for (const neighbor of sites) {
    for (const offsetX of [-world.width, 0, world.width]) {
      for (const offsetY of [-world.height, 0, world.height]) {
        if (neighbor !== site || offsetX !== 0 || offsetY !== 0) {
          neighbors.push({ x: neighbor.x + offsetX, y: neighbor.y + offsetY });
        }
      }
    }
  }
  return neighbors;
}

function getLocalWrappedWorldPolygon(site: Vector, world: WorldSize): Vector[] {
  const left = site.x - world.width * 0.5;
  const right = site.x + world.width * 0.5;
  const top = site.y - world.height * 0.5;
  const bottom = site.y + world.height * 0.5;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function clipPolygonToVoronoiHalfPlane(polygon: Vector[], site: Vector, neighbor: Vector): Vector[] {
  const clipped: Vector[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentInside = pointCloserToSite(current, site, neighbor);
    const nextInside = pointCloserToSite(next, site, neighbor);
    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      clipped.push(getVoronoiEdgeIntersection(current, next, site, neighbor));
    } else if (!currentInside && nextInside) {
      clipped.push(getVoronoiEdgeIntersection(current, next, site, neighbor), next);
    }
  }
  return clipped;
}

function pointCloserToSite(point: Vector, site: Vector, neighbor: Vector): boolean {
  return squaredDistance(point, site) <= squaredDistance(point, neighbor);
}

function getVoronoiEdgeIntersection(
  start: Vector,
  end: Vector,
  site: Vector,
  neighbor: Vector,
): Vector {
  const direction = { x: end.x - start.x, y: end.y - start.y };
  const normal = { x: neighbor.x - site.x, y: neighbor.y - site.y };
  const midpoint = { x: (site.x + neighbor.x) * 0.5, y: (site.y + neighbor.y) * 0.5 };
  const numerator = normal.x * (midpoint.x - start.x) + normal.y * (midpoint.y - start.y);
  const denominator = normal.x * direction.x + normal.y * direction.y;
  const t = denominator === 0 ? 0 : numerator / denominator;
  return {
    x: start.x + direction.x * t,
    y: start.y + direction.y * t,
  };
}

function squaredDistance(left: Vector, right: Vector): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function squaredWrappedDistance(left: Vector, right: Vector, world: WorldSize): number {
  const dx = Math.abs(left.x - right.x);
  const dy = Math.abs(left.y - right.y);
  const wrappedX = Math.min(dx, world.width - dx);
  const wrappedY = Math.min(dy, world.height - dy);
  return wrappedX ** 2 + wrappedY ** 2;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function chooseGeneratedPreset(
  points: Vector[],
  config: SandboxWorldConfig,
  random: RandomSource,
): string {
  const center = getPolygonCenter(points);
  const wrappedCenter = {
    x: positiveModulo(center.x, config.world.width),
    y: positiveModulo(center.y, config.world.height),
  };
  const distance = Math.sqrt(squaredWrappedDistance(wrappedCenter, config.spawnPoint, config.world));
  const maxDistance = Math.hypot(config.world.width * 0.5, config.world.height * 0.5);
  const progression = distance / maxDistance;
  return pickWeighted(
    config.generatedBiomePresets.filter(
      (entry) =>
        progression >= (entry.minDistance ?? 0) && progression <= (entry.maxDistance ?? 1),
    ),
    random,
  );
}

function createPlanetPlans(
  biomes: SandboxBiomeRegion[],
  reservations: SpawnCircle[],
  world: WorldSize,
  random: RandomSource,
): SandboxBiomeSpawnPlan['planets'] {
  const planets: SandboxBiomeSpawnPlan['planets'] = [];
  const occupied = [...reservations];
  for (const biome of biomes) {
    const count = densityCount(biome, biome.profile.planetDensity, random);
    for (let index = 0; index < count; index += 1) {
      const kind = pickWeighted(biome.profile.planetKinds, random);
      const radius = PLANET_SPECS[kind].radius;
      const position = findOpenPointInPolygon(biome.points, radius, occupied, world, random);
      if (position) {
        planets.push({ kind, position, source: 'generated' });
        occupied.push({ position, radius });
      }
    }
  }
  return planets;
}

function createAsteroidPlans(
  biomes: SandboxBiomeRegion[],
  reservations: SpawnCircle[],
  world: WorldSize,
  random: RandomSource,
): SandboxBiomeSpawnPlan['asteroids'] {
  const asteroids: SandboxBiomeSpawnPlan['asteroids'] = [];
  const occupied = [...reservations];
  for (const biome of biomes) {
    const count = densityCount(biome, biome.profile.asteroidDensity, random);
    for (let index = 0; index < count; index += 1) {
      const tier = pickWeighted(biome.profile.asteroidTiers, random);
      const radius = ASTEROIDS[tier].collisionRadius;
      const position = findOpenPointInPolygon(biome.points, radius, occupied, world, random);
      if (position) {
        const angle = random.floatBetween(0, Math.PI * 2);
        const speed = ASTEROIDS[tier].speed * random.floatBetween(0.35, 0.8);
        asteroids.push({
          position,
          source: 'generated',
          tier,
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        });
        occupied.push({ position, radius });
      }
    }
  }
  return asteroids;
}

function createNebulaPlans(
  biomes: SandboxBiomeRegion[],
  reservations: SpawnCircle[],
  world: WorldSize,
  random: RandomSource,
): NebulaRegion[] {
  const regions: NebulaRegion[] = [];
  const occupied = [...reservations];
  for (const biome of biomes) {
    const count = densityCount(biome, biome.profile.nebulaDensity, random);
    for (let index = 0; index < count; index += 1) {
      const radius = random.floatBetween(900, 2600);
      const position = findOpenPointInPolygon(biome.points, radius, occupied, world, random);
      if (position) {
        const combo = pickWeighted(biome.profile.nebulaEffectCombos, random);
        regions.push({
          alpha: random.floatBetween(0.42, 0.68),
          effects: combo.effects,
          featherPx: Math.round(random.floatBetween(260, 440)),
          id: `${biome.id}-nebula-${index}`,
          points: createBlobPolygon(position, radius, random),
          seed: random.floatBetween(0, 10000),
          visuals: biome.profile.nebulaVisuals,
        });
        occupied.push({ position, radius });
      }
    }
  }
  return regions;
}

function densityCount(biome: SandboxBiomeRegion, density: number, random: RandomSource): number {
  const exact = (polygonArea(biome.points) / AREA_UNIT) * density;
  const base = Math.floor(exact);
  return random.float() < exact - base ? base + 1 : base;
}

function findOpenPointInPolygon(
  polygon: Vector[],
  radius: number,
  reservations: SpawnCircle[],
  world: WorldSize,
  random: RandomSource,
): Vector | null {
  const wrappedPolygons = createWorldIntersectingPolygons(polygon, world);
  let selected: Vector | null = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const wrappedPolygon = wrappedPolygons[random.between(0, wrappedPolygons.length - 1)];
    const bounds = polygonBounds(wrappedPolygon);
    const left = Math.max(0, bounds.left + radius);
    const right = Math.min(world.width, bounds.right - radius);
    const top = Math.max(0, bounds.top + radius);
    const bottom = Math.min(world.height, bounds.bottom - radius);
    if (left <= right && top <= bottom) {
      const candidate = {
        x: random.floatBetween(left, right),
        y: random.floatBetween(top, bottom),
      };
      if (
        pointInPolygon(candidate, wrappedPolygon) &&
        !overlapsReservations(candidate, radius, reservations)
      ) {
        selected = candidate;
        attempt = 80;
      }
    }
  }
  return selected;
}

function createWorldIntersectingPolygons(polygon: Vector[], world: WorldSize): Vector[][] {
  const polygons: Vector[][] = [];
  for (const offsetX of [-world.width, 0, world.width]) {
    for (const offsetY of [-world.height, 0, world.height]) {
      const candidate = polygon.map((point) => ({
        x: point.x + offsetX,
        y: point.y + offsetY,
      }));
      if (polygonIntersectsWorld(candidate, world)) polygons.push(candidate);
    }
  }
  return polygons.length > 0 ? polygons : [polygon];
}

function polygonTouchesAnyWrapped(
  points: Vector[],
  polygons: Vector[][],
  world: WorldSize,
): boolean {
  return createWorldIntersectingPolygons(points, world).some((polygon) =>
    polygonTouchesAny(polygon, polygons),
  );
}

function polygonIntersectsWorld(polygon: Vector[], world: WorldSize): boolean {
  const bounds = polygonBounds(polygon);
  return (
    bounds.right >= 0 &&
    bounds.left <= world.width &&
    bounds.bottom >= 0 &&
    bounds.top <= world.height
  );
}

function overlapsReservations(point: Vector, radius: number, reservations: SpawnCircle[]): boolean {
  return reservations.some(
    (reservation) =>
      Math.hypot(point.x - reservation.position.x, point.y - reservation.position.y) <
      radius + reservation.radius + 100,
  );
}

function createBlobPolygon(center: Vector, radius: number, random: RandomSource): Vector[] {
  const points: Vector[] = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const pointRadius = radius * random.floatBetween(0.72, 1.18);
    points.push({
      x: center.x + Math.cos(angle) * pointRadius,
      y: center.y + Math.sin(angle) * pointRadius,
    });
  }
  return points;
}

export function polygonArea(points: Vector[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area) * 0.5;
}

export function pointInPolygon(point: Vector, polygon: Vector[]): boolean {
  let inside = false;
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonTouchesAny(points: Vector[], polygons: Vector[][]): boolean {
  return polygons.some((polygon) => polygonsTouch(points, polygon));
}

function polygonsTouch(left: Vector[], right: Vector[]): boolean {
  const vertexInside =
    left.some((point) => pointInPolygon(point, right)) ||
    right.some((point) => pointInPolygon(point, left));
  return vertexInside || edgesIntersect(left, right);
}

function edgesIntersect(left: Vector[], right: Vector[]): boolean {
  let intersects = false;
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      if (
        segmentsIntersect(
          left[leftIndex],
          left[(leftIndex + 1) % left.length],
          right[rightIndex],
          right[(rightIndex + 1) % right.length],
        )
      ) {
        intersects = true;
      }
    }
  }
  return intersects;
}

function segmentsIntersect(a: Vector, b: Vector, c: Vector, d: Vector): boolean {
  const denominator = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
  if (denominator === 0) return false;
  const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denominator;
  const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denominator;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

function polygonBounds(points: Vector[]): {
  bottom: number;
  left: number;
  right: number;
  top: number;
} {
  return points.reduce(
    (bounds, point) => ({
      bottom: Math.max(bounds.bottom, point.y),
      left: Math.min(bounds.left, point.x),
      right: Math.max(bounds.right, point.x),
      top: Math.min(bounds.top, point.y),
    }),
    {
      bottom: Number.NEGATIVE_INFINITY,
      left: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
    },
  );
}

function getPolygonCenter(points: Vector[]): Vector {
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
    x: 0,
    y: 0,
  });
  return { x: total.x / points.length, y: total.y / points.length };
}
