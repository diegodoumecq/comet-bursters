import { describe, expect, it, vi } from 'vitest';

import {
  BLACK_HOLE_MATURE_AFTER_MS,
  BLACK_HOLE_MATURE_RADIUS,
  BLACK_HOLE_RADIUS,
  MAX_BLACK_HOLES,
} from '../../projectiles/definition';
import type { ProjectileEntity } from '../../projectiles/types';
import { buildArcadeBlackHoleScreenSamples } from './arcadeBlackHoles';

vi.mock('phaser', () => ({ default: {} }));

const screen = { width: 900, height: 700 };

describe('arcade black hole rendering', () => {
  it('returns one sample when the black hole influence is fully inside the screen', () => {
    const samples = buildArcadeBlackHoleScreenSamples(
      [createBlackHole({ ageMs: 0, position: { x: 450, y: 350 } })],
      screen,
    );

    expect(samples).toEqual([{ radius: BLACK_HOLE_RADIUS, x: 450, y: 350 }]);
  });

  it('duplicates across the opposite horizontal edge when the influence overlaps the left edge', () => {
    const samples = buildArcadeBlackHoleScreenSamples(
      [createBlackHole({ ageMs: 0, position: { x: 160, y: 350 } })],
      screen,
    );

    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS, x: 160, y: 350 });
    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS, x: 1060, y: 350 });
  });

  it('duplicates corner samples when the influence overlaps two edges', () => {
    const samples = buildArcadeBlackHoleScreenSamples(
      [createBlackHole({ ageMs: 0, position: { x: 160, y: 140 } })],
      screen,
    );

    expect(samples).toHaveLength(4);
    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS, x: 160, y: 140 });
    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS, x: 1060, y: 140 });
    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS, x: 160, y: 840 });
    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS, x: 1060, y: 840 });
  });

  it('uses the render target period for scaled wrapped samples', () => {
    const samples = buildArcadeBlackHoleScreenSamples(
      [createBlackHole({ ageMs: 0, position: { x: 180, y: 350 } })],
      screen,
      { width: 1800, height: 1400 },
    );

    expect(samples).toHaveLength(2);
    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS * 2, x: 360, y: 700 });
    expect(samples).toContainEqual({ radius: BLACK_HOLE_RADIUS * 2, x: 2160, y: 700 });
  });

  it('duplicates mature black holes across every edge when their distortion covers the screen', () => {
    const samples = buildArcadeBlackHoleScreenSamples(
      [createBlackHole({ position: { x: 450, y: 350 } })],
      screen,
    );

    expect(samples).toHaveLength(9);
    expect(samples).toContainEqual({ radius: BLACK_HOLE_MATURE_RADIUS, x: 450, y: 350 });
  });

  it('can produce more wrapped render samples than the gameplay black-hole limit', () => {
    const projectiles = Array.from({ length: 2 }, (_, index) =>
      createBlackHole({
        id: index + 1,
        position: { x: 450 + index * 20, y: 350 },
      }),
    );

    const samples = buildArcadeBlackHoleScreenSamples(projectiles, screen);

    expect(samples.length).toBeGreaterThan(MAX_BLACK_HOLES);
  });

  it('renders whatever black holes belong to the runtime being sampled', () => {
    const samples = buildArcadeBlackHoleScreenSamples(
      [
        createBlackHole({
          membership: { portalId: 3, space: 'rift' },
          position: { x: 450, y: 350 },
        }),
      ],
      screen,
    );

    expect(samples).toHaveLength(9);
  });
});

function createBlackHole(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  const blackHole: ProjectileEntity = {
    absorbedFuel: 0,
    ageMs: BLACK_HOLE_MATURE_AFTER_MS + 1000,
    angle: 0,
    airResistance: 0.01,
    baseSpeed: 1,
    collapseStartedAt: null,
    createdAt: 0,
    damage: 0,
    id: 1,
    impact: 0,
    kind: 'blackHole',
    lifetimeMs: 10000,
    position: { x: 450, y: 350 },
    radius: 6,
    velocity: { x: 0, y: 0 },
  };
  return { ...blackHole, ...input };
}
