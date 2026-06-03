import { describe, expect, it } from 'vitest';

import { createSandboxBiomeSpawnPlan, pointInPolygon } from './biomeGeneration';
import { SANDBOX_WORLD_CONFIG } from './sandboxWorldConfig';

describe('sandbox biome generation', () => {
  it('keeps authored biomes and generated filler biomes as polygon regions', () => {
    const plan = createSandboxBiomeSpawnPlan(SANDBOX_WORLD_CONFIG, []);

    expect(plan.biomes.filter((biome) => biome.source === 'authored')).toHaveLength(
      SANDBOX_WORLD_CONFIG.authoredBiomes.length,
    );
    expect(plan.biomes.some((biome) => biome.source === 'generated')).toBe(true);
    expect(plan.biomes.every((biome) => biome.points.length >= 3)).toBe(true);
  });

  it('does not place generated biome vertices inside authored biome polygons', () => {
    const plan = createSandboxBiomeSpawnPlan(SANDBOX_WORLD_CONFIG, []);
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
    );

    expect(plan.biomes.find((biome) => biome.id === 'direct-visuals')?.profile.nebulaVisuals)
      .toEqual(override);
  });
});
