import { describe, expect, it } from 'vitest';

import { sampleQuantizedSphereLighting } from './planetLighting';

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
});

function normalize(vector: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}
