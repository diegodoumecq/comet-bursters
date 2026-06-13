import { describe, expect, it } from 'vitest';

import type { PlanetEntity } from '../../planets/types';
import { SandboxDiscovery } from './discovery';

const WORLD = { height: 4400, width: 4400 };

describe('sandbox discovery minimap dirtiness', () => {
  it('tracks dirty fog cells and separate fog versions', () => {
    const discovery = new SandboxDiscovery();

    discovery.update({ x: 0, y: 0 }, [], WORLD);

    expect(discovery.dirtyCellIndices.length).toBeGreaterThan(0);
    expect(discovery.exploredVersion).toBe(1);
    expect(discovery.visibleVersion).toBe(1);
    expect(discovery.planetDiscoveryVersion).toBe(0);
    expect(discovery.version).toBe(1);
  });

  it('does not dirty fog cells for planet-only discovery changes', () => {
    const discovery = new SandboxDiscovery();
    const planet = makePlanet(1, { x: 0, y: 0 });

    discovery.update({ x: 0, y: 0 }, [], WORLD);
    discovery.update({ x: 0, y: 0 }, [planet], WORLD);

    expect(discovery.dirtyCellIndices).toEqual([]);
    expect(discovery.planetDiscoveryVersion).toBe(1);
    expect(discovery.exploredVersion).toBe(1);
    expect(discovery.visibleVersion).toBe(1);
  });
});

function makePlanet(id: number, position: { x: number; y: number }): PlanetEntity {
  return {
    altitudeVariations: [],
    color: 0xffffff,
    colorHex: '#ffffff',
    gravityStrength: 0,
    id,
    kind: 'lush',
    position,
    radius: 100,
    rotation: 0,
    rotationSpeed: 0,
  };
}
