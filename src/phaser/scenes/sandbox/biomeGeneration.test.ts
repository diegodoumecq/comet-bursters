import { describe, expect, it } from 'vitest';

import { createSandboxBiomeSpawnPlan, pointInPolygon } from './biomeGeneration';
import { SANDBOX_WORLD_CONFIG } from './sandboxWorldConfig';

const PLAYTHROUGH_SEED = 'test-playthrough';

describe('sandbox biome generation', () => {
  it('keeps authored biomes and generated filler biomes as polygon regions', () => {
    const plan = createSandboxBiomeSpawnPlan(SANDBOX_WORLD_CONFIG, [], PLAYTHROUGH_SEED);

    expect(plan.biomes.filter((biome) => biome.source === 'authored')).toHaveLength(
      SANDBOX_WORLD_CONFIG.authoredBiomes.length,
    );
    expect(plan.biomes.some((biome) => biome.source === 'generated')).toBe(true);
    expect(plan.biomes.every((biome) => biome.points.length >= 3)).toBe(true);
  });

  it('lets generated filler biomes cross world wrap seams', () => {
    const world = { height: 10000, width: 10000 };
    const plan = createSandboxBiomeSpawnPlan(
      {
        ...SANDBOX_WORLD_CONFIG,
        authoredAsteroids: [],
        authoredBiomes: [],
        authoredNebulaRegions: [],
        authoredPlanets: [],
        generatedBiomeSize: 3600,
        landmarks: [],
        spawnPoint: { x: 5000, y: 5000 },
        world,
      },
      [],
      PLAYTHROUGH_SEED,
    );
    const generated = plan.biomes.filter((biome) => biome.source === 'generated');

    expect(generated).not.toHaveLength(0);
    expect(
      generated.some((biome) =>
        biome.points.some(
          (point) => point.x < 0 || point.x > world.width || point.y < 0 || point.y > world.height,
        ),
      ),
    ).toBe(true);
  });

  it('uses the configured generated biome preset pool', () => {
    const plan = createSandboxBiomeSpawnPlan(
      {
        ...SANDBOX_WORLD_CONFIG,
        authoredAsteroids: [],
        authoredBiomes: [],
        authoredNebulaRegions: [],
        authoredPlanets: [],
        biomePresets: {
          ...SANDBOX_WORLD_CONFIG.biomePresets,
          forcedGenerated: {
            asteroidDensity: 0.017,
            nebulaDensity: 0.013,
            planetDensity: 0.031,
          },
        },
        generatedBiomePresets: [{ value: 'forcedGenerated', weight: 1 }],
        generatedBiomeSize: 3600,
        landmarks: [],
        spawnPoint: { x: 5000, y: 5000 },
        world: { height: 10000, width: 10000 },
      },
      [],
      PLAYTHROUGH_SEED,
    );
    const generated = plan.biomes.filter((biome) => biome.source === 'generated');

    expect(generated).not.toHaveLength(0);
    expect(generated.every((biome) => biome.profile.asteroidDensity === 0.017)).toBe(true);
    expect(generated.every((biome) => biome.profile.nebulaDensity === 0.013)).toBe(true);
    expect(generated.every((biome) => biome.profile.planetDensity === 0.031)).toBe(true);
  });

  it('does not place generated biome vertices inside authored biome polygons', () => {
    const plan = createSandboxBiomeSpawnPlan(SANDBOX_WORLD_CONFIG, [], PLAYTHROUGH_SEED);
    const authored = plan.biomes.filter((biome) => biome.source === 'authored');
    const generated = plan.biomes.filter((biome) => biome.source === 'generated');

    for (const biome of generated) {
      for (const authoredBiome of authored) {
        expect(
          biome.points.some((point) => pointInPolygon(point, authoredBiome.points)),
          `${biome.id} crosses ${authoredBiome.id}`,
        ).toBe(false);
      }
    }
  });

  it('supports weighted nebula effect combos that can contain multiple effects', () => {
    const effectCombos = Object.values(SANDBOX_WORLD_CONFIG.biomePresets)
      .flatMap((preset) => preset.nebulaEffectCombos ?? [])
      .map((entry) => entry.value.effects);

    expect(effectCombos.some((effects) => effects.length > 1)).toBe(true);
  });

  it('places authored planets and asteroids before procedural fill', () => {
    const plan = createSandboxBiomeSpawnPlan(
      {
        ...SANDBOX_WORLD_CONFIG,
        authoredAsteroids: [
          {
            position: { x: 1700, y: 1800 },
            tier: 'mega',
            velocity: { x: 1, y: -1 },
          },
        ],
        authoredPlanets: [{ kind: 'ice', position: { x: 1200, y: 1400 } }],
      },
      [],
      PLAYTHROUGH_SEED,
    );

    expect(plan.planets[0]).toEqual({
      kind: 'ice',
      position: { x: 1200, y: 1400 },
      source: 'authored',
    });
    expect(plan.asteroids[0]).toEqual({
      position: { x: 1700, y: 1800 },
      source: 'authored',
      tier: 'mega',
      velocity: { x: 1, y: -1 },
    });
  });

  it('expands planet asteroid belt landmarks into authored spawn entries', () => {
    const plan = createSandboxBiomeSpawnPlan(
      {
        ...SANDBOX_WORLD_CONFIG,
        landmarks: [
          {
            asteroidCount: 4,
            asteroidTier: 'small',
            id: 'test-belt',
            orbitRadius: 600,
            planet: { kind: 'crystal', position: { x: 6000, y: 6000 } },
            type: 'planetAsteroidBelt',
          },
        ],
      },
      [],
      PLAYTHROUGH_SEED,
    );

    expect(plan.planets[0]).toEqual({
      kind: 'crystal',
      position: { x: 6000, y: 6000 },
      source: 'authored',
    });
    expect(plan.asteroids.slice(0, 4).every((asteroid) => asteroid.source === 'authored')).toBe(
      true,
    );
    expect(plan.asteroids.slice(0, 4).map((asteroid) => asteroid.position)).toEqual([
      { x: 6600, y: 6000 },
      { x: 6000, y: 6600 },
      { x: 5400, y: 6000 },
      { x: 6000, y: 5400 },
    ]);
  });

  it('keeps direct biome nebula visual overrides', () => {
    const override = {
      ...SANDBOX_WORLD_CONFIG.biomePresets.nebulaVeil.nebulaVisuals!,
      tintStrength: 0.91,
    };
    const plan = createSandboxBiomeSpawnPlan(
      {
        ...SANDBOX_WORLD_CONFIG,
        authoredBiomes: [
          {
            id: 'direct-visuals',
            nebulaVisuals: override,
            points: [
              { x: 1000, y: 1000 },
              { x: 4000, y: 1000 },
              { x: 4000, y: 4000 },
              { x: 1000, y: 4000 },
            ],
            presets: ['nebulaVeil'],
          },
        ],
      },
      [],
      PLAYTHROUGH_SEED,
    );

    expect(plan.biomes.find((biome) => biome.id === 'direct-visuals')?.profile.nebulaVisuals)
      .toEqual(override);
  });
});
