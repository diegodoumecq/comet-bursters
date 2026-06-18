import { describe, expect, it } from 'vitest';

import { PLAYER_SHIP_HEIGHTMAP_CONFIG } from './shipHeightmapConfig';
import { PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS } from './shipHeightmapControls';

function readConfigPath(path: readonly string[]): unknown {
  let current: unknown = PLAYER_SHIP_HEIGHTMAP_CONFIG;
  for (const key of path) {
    expect(current).toEqual(expect.any(Object));
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

describe('ship heightmap editor controls', () => {
  it('points every control at a numeric heightmap config value', () => {
    const labels = new Set<string>();

    for (const section of PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS) {
      expect(section.controls.length).toBeGreaterThan(0);
      for (const control of section.controls) {
        expect(labels.has(control.label)).toBe(false);
        labels.add(control.label);
        expect(readConfigPath(control.path)).toEqual(expect.any(Number));
      }
    }
  });

  it('defines usable slider ranges for every control', () => {
    for (const section of PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS) {
      for (const control of section.controls) {
        expect(control.min).toBeLessThan(control.max);
        expect(control.step).toBeGreaterThan(0);
      }
    }
  });
});
