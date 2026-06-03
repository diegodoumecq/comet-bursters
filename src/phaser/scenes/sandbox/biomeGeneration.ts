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
  SandboxBiomeConfig,
  SandboxBiomePreset,
  SandboxWorldConfig,
} from './sandboxWorldConfig';

export type SandboxBiomeRegion = {
  id: string;
  points: Vector[];
  profile: Required<SandboxBiomePreset>;
  source: 'authored' | 'generated';
};

export type SandboxBiomeSpawnPlan = {
  asteroids: { position: Vector; tier: AsteroidTier; velocity: Vector }[];
  biomes: SandboxBiomeRegion[];
  nebulaRegions: NebulaRegion[];
  planets: { kind: PlanetKind; position: Vector }[];
};

const AREA_UNIT = 1_000_000;
const GENERATED_BIOME_PRESETS = [
  'sandboxFallback',
  'asteroidBelt',
  'planetCluster',
  'nebulaVeil',
  'dangerousNebula',
];
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
): SandboxBiomeSpawnPlan {
  const random = createSeededRandom(config.seed);
  const authored = config.authoredBiomes.map((biome) =>
    resolveBiomeConfig(config, biome, 'authored'),
  );
  const generated = createGeneratedBiomeRegions(config, authored, random);
  const biomes = [...authored, ...generated];
  const planets = createPlanetPlans(biomes, reservations, config.world, random);
  const planetReservations = planets.map((planet) => ({
    position: planet.position,
    radius: PLANET_SPECS[planet.kind].radius,
  }));
  const asteroids = createAsteroidPlans(
    biomes,
    [...reservations, ...planetReservations],
    config.world,
    random,
  );
  const asteroidReservations = asteroids.map((asteroid) => ({
    position: asteroid.position,
    radius: ASTEROIDS[asteroid.tier].collisionRadius,
  }));
  const nebulaRegions = createNebulaPlans(
    biomes,
    [...reservations, ...planetReservations, ...asteroidReservations],
    config.world,
    random,
  );
  return { asteroids, biomes, nebulaRegions, planets };
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
    planetDensity,
    planetKinds,
  } = biome;
  return {
    asteroidDensity,
    asteroidTiers,
    nebulaDensity,
    nebulaEffectCombos,
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
  let index = 0;
  let y = 0;
  while (y < config.world.height) {
    let x = 0;
    while (x < config.world.width) {
      const points = createJitteredCellPolygon(
        x,
        y,
        config.generatedBiomeSize,
        config.world,
        random,
      );
      if (
        !polygonTouchesAny(
          points,
          authored.map((biome) => biome.points),
        )
      ) {
        const preset = chooseGeneratedPreset(points, config.world, random);
        generated.push(
          resolveBiomeConfig(
            config,
            { id: `generated-${index}`, points, presets: [preset] },
            'generated',
          ),
        );
        index += 1;
      }
      x += config.generatedBiomeSize;
    }
    y += config.generatedBiomeSize;
  }
  return generated;
}

function createJitteredCellPolygon(
  x: number,
  y: number,
  size: number,
  world: WorldSize,
  random: RandomSource,
): Vector[] {
  const right = Math.min(world.width, x + size);
  const bottom = Math.min(world.height, y + size);
  const jitter = size * 0.16;
  return [
    {
      x: clamp(x + random.floatBetween(0, jitter), 0, world.width),
      y: clamp(y + random.floatBetween(0, jitter), 0, world.height),
    },
    {
      x: clamp(right - random.floatBetween(0, jitter), 0, world.width),
      y: clamp(y + random.floatBetween(0, jitter), 0, world.height),
    },
    {
      x: clamp(right - random.floatBetween(0, jitter), 0, world.width),
      y: clamp(bottom - random.floatBetween(0, jitter), 0, world.height),
    },
    {
      x: clamp(x + random.floatBetween(0, jitter), 0, world.width),
      y: clamp(bottom - random.floatBetween(0, jitter), 0, world.height),
    },
  ];
}

function chooseGeneratedPreset(points: Vector[], world: WorldSize, random: RandomSource): string {
  const center = getPolygonCenter(points);
  const distance = Math.hypot(center.x - world.width * 0.5, center.y - world.height * 0.5);
  const maxDistance = Math.hypot(world.width * 0.5, world.height * 0.5);
  const danger = distance / maxDistance;
  return pickWeighted(
    [
      { value: 'sandboxFallback', weight: 40 },
      { value: 'planetCluster', weight: 22 - danger * 8 },
      { value: 'asteroidBelt', weight: 18 + danger * 18 },
      { value: 'nebulaVeil', weight: 12 + danger * 10 },
      { value: 'dangerousNebula', weight: Math.max(0, danger - 0.42) * 18 },
    ].filter((entry) => GENERATED_BIOME_PRESETS.includes(entry.value)),
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
        planets.push({ kind, position });
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
  const bounds = polygonBounds(polygon);
  let selected: Vector | null = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = {
      x: random.floatBetween(bounds.left + radius, bounds.right - radius),
      y: random.floatBetween(bounds.top + radius, bounds.bottom - radius),
    };
    if (
      pointInPolygon(candidate, polygon) &&
      !overlapsReservations(candidate, radius, reservations)
    ) {
      selected = candidate;
      attempt = 80;
    }
  }
  if (selected && withinWorld(selected, world)) return selected;
  return null;
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

function withinWorld(point: Vector, world: WorldSize): boolean {
  return point.x >= 0 && point.x <= world.width && point.y >= 0 && point.y <= world.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
