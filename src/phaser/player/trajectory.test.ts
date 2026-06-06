import { describe, expect, it } from 'vitest';

import type { WorldSize } from '../core/types';
import type { PlanetEntity } from '../planets/types';
import { buildPlayerTrajectoryPreview } from './trajectory';

const world: WorldSize = { height: 1000, width: 1000 };

describe('player trajectory preview', () => {
  it('does not build a preview when gravity is below the visibility threshold', () => {
    const preview = buildPlayerTrajectoryPreview({
      minGravity: 0.001,
      planets: [],
      playerRadius: 14,
      position: { x: 100, y: 100 },
      velocity: { x: 10, y: 0 },
      world,
    });

    expect(preview).toBeNull();
  });

  it('predicts future movement from current velocity and planet gravity', () => {
    const preview = buildPlayerTrajectoryPreview({
      minGravity: 0,
      planets: [createPlanet({ x: 300, y: 100 })],
      playerRadius: 14,
      position: { x: 100, y: 100 },
      sampleEvery: 1,
      seconds: 4 / 60,
      velocity: { x: 0, y: -4 },
      world,
    });

    expect(preview).not.toBeNull();
    expect(preview?.alphaScale).toBeGreaterThan(0);
    expect(preview?.points.at(-1)?.x).toBeGreaterThan(100);
    expect(preview?.points.at(-1)?.y).toBeLessThan(100);
  });

  it('returns the same preview across repeated calls with the same planet array', () => {
    const planets = [createPlanet({ x: 300, y: 100 })];
    const input = {
      minGravity: 0,
      planets,
      playerRadius: 14,
      position: { x: 100, y: 100 },
      sampleEvery: 1,
      seconds: 4 / 60,
      velocity: { x: 0, y: -4 },
      world,
    };

    const first = buildPlayerTrajectoryPreview(input);
    const second = buildPlayerTrajectoryPreview(input);

    expect(second).toEqual(first);
  });

  it('keeps the rendered path continuous when the simulated position wraps', () => {
    const preview = buildPlayerTrajectoryPreview({
      fullAlphaGravity: 1,
      minGravity: -1,
      planets: [],
      playerRadius: 14,
      position: { x: 990, y: 100 },
      sampleEvery: 1,
      seconds: 2 / 60,
      velocity: { x: 20, y: 0 },
      world,
    });

    expect(preview).not.toBeNull();
    expect(preview?.points[0].x).toBe(1010);
    expect(preview?.points[1].x).toBe(1030);
  });
});

function createPlanet(position: PlanetEntity['position']): PlanetEntity {
  return {
    altitudeVariations: [],
    color: 0xffffff,
    colorHex: '#ffffff',
    gravityStrength: 10,
    id: 1,
    kind: 'lush',
    position,
    radius: 100,
    rotation: 0,
    rotationSpeed: 0,
  };
}
