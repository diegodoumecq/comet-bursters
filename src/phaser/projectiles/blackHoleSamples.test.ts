import { describe, expect, it } from 'vitest';

import { BLACK_HOLE_RADIUS } from './definition';
import { buildBlackHoleScreenSamples } from './blackHoleSamples';
import type { ProjectileEntity } from './types';

describe('black hole screen samples', () => {
  it('projects with lens influence while preserving the core render radius', () => {
    const projectedRadii: number[] = [];
    const samples = buildBlackHoleScreenSamples({
      project: (_position, radius) => {
        projectedRadii.push(radius);
        return [{ x: 320, y: 180 }];
      },
      projectiles: [createBlackHole()],
    });

    expect(projectedRadii).toEqual([200]);
    expect(samples).toEqual([{ radius: BLACK_HOLE_RADIUS, x: 320, y: 180 }]);
  });
});

function createBlackHole(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  const blackHole: ProjectileEntity = {
    absorbedFuel: 0,
    ageMs: 0,
    angle: 0,
    airResistance: 0,
    baseSpeed: 1,
    collapseStartedAt: null,
    createdAt: 0,
    damage: 0,
    id: 1,
    impact: 0,
    kind: 'blackHole',
    lifetimeMs: 10000,
    position: { x: 100, y: 100 },
    radius: BLACK_HOLE_RADIUS,
    velocity: { x: 0, y: 0 },
  };
  return { ...blackHole, ...input };
}
