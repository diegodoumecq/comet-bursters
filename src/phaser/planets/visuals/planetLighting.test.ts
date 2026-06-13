import { describe, expect, it } from 'vitest';

import { samplePlanetKindSphereLighting, sampleQuantizedSphereLighting } from './planetLighting';

describe('planet sphere lighting', () => {
  it('keeps the lit side transparent and shadows the lower-right side', () => {
    const lit = sampleQuantizedSphereLighting(normalize({ x: -0.56, y: -0.52, z: 0.65 }));
    const shadowed = sampleQuantizedSphereLighting(normalize({ x: 0.7, y: 0.65, z: 0.2 }));

    expect(lit.red).toBe(3);
    expect(lit.alpha).toBeGreaterThan(0);
    expect(lit.alpha).toBeLessThan(0.04);
    expect(shadowed.red).toBe(3);
    expect(shadowed.alpha).toBeGreaterThan(lit.alpha);
  });

  it('keeps nearby sphere normals in visually close shadow bands', () => {
    const first = sampleQuantizedSphereLighting(normalize({ x: 0.1, y: 0, z: 0.995 }));
    const second = sampleQuantizedSphereLighting(normalize({ x: 0.12, y: 0, z: 0.993 }));

    expect(second.red).toBe(first.red);
    expect(second.green).toBe(first.green);
    expect(second.blue).toBe(first.blue);
    expect(Math.abs(second.alpha - first.alpha)).toBeLessThan(0.001);
  });

  it('keeps emissive material planet shadows visible', () => {
    const shadowed = normalize({ x: 0.7, y: 0.65, z: 0.2 });
    const terminator = normalize({ x: 0.5, y: 0.5, z: 0.7 });
    const lit = normalize({ x: -0.56, y: -0.52, z: 0.65 });

    for (const kind of ['crystal', 'lava', 'toxic'] as const) {
      const litSample = samplePlanetKindSphereLighting(kind, lit);
      const shadowedSample = samplePlanetKindSphereLighting(kind, shadowed);

      expect(shadowedSample.alpha).toBeGreaterThan(litSample.alpha + 0.2);
      expect(shadowedSample.red + shadowedSample.green + shadowedSample.blue).toBeLessThan(180);
    }

    for (const kind of ['lava', 'toxic'] as const) {
      const terminatorSample = samplePlanetKindSphereLighting(kind, terminator);

      expect(terminatorSample.alpha).toBeGreaterThan(0.18);
      expect(terminatorSample.red + terminatorSample.green + terminatorSample.blue).toBeLessThan(24);
    }

    for (const kind of ['gas', 'lush'] as const) {
      const terminatorSample = samplePlanetKindSphereLighting(kind, terminator);
      const shadowedSample = samplePlanetKindSphereLighting(kind, shadowed);

      expect(terminatorSample.alpha).toBeGreaterThan(0.12);
      expect(shadowedSample.alpha).toBeGreaterThan(0.48);
    }
  });
});

function normalize(vector: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}
