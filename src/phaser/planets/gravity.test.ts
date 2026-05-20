import { describe, expect, it } from 'vitest';

import type { MatterImage } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { PlanetEntity } from './types';
import { applyPlanetGravityToBody, applyPlanetGravityToFuelBlobs } from './gravity';

const world = { width: 1000, height: 1000 };

const planet: PlanetEntity = {
  altitudeVariations: [],
  color: 0xffffff,
  colorHex: '#ffffff',
  gravityStrength: 10,
  id: 1,
  kind: 'lush',
  position: { x: 200, y: 100 },
  radius: 100,
  rotation: 0,
  rotationSpeed: 0,
};

function createBody() {
  const body = {
    body: {
      velocity: { x: 0, y: 0 },
    },
    x: 100,
    y: 100,
    setVelocity(x: number, y: number) {
      this.body.velocity = { x, y };
    },
  };

  return body as unknown as MatterImage;
}

describe('planet gravity', () => {
  it('applies gravity to player bodies', () => {
    const body = createBody();

    applyPlanetGravityToBody(body, [planet], world, 1 / 60);

    expect(body.body.velocity.x).toBeGreaterThan(0);
    expect(body.body.velocity.y).toBe(0);
  });

  it('applies gravity to fuel blobs', () => {
    const blob: FuelBlobEntity = {
      id: 1,
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    applyPlanetGravityToFuelBlobs([blob], [planet], world, 1 / 60);

    expect(blob.velocity.x).toBeGreaterThan(0);
    expect(blob.velocity.y).toBe(0);
  });
});
