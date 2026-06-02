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
});
