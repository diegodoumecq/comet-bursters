import { describe, expect, it } from 'vitest';

import { getProjectileVisualScale } from './visuals';

describe('projectile rendering', () => {
  it('stretches projectile length proportionally to speed', () => {
    const baseSpeed = 20;
    const base = getProjectileVisualScale('small', baseSpeed, baseSpeed);
    const faster = getProjectileVisualScale('small', baseSpeed * 1.5, baseSpeed);

    expect(faster.x).toBeCloseTo(base.x * 1.5);
    expect(faster.y).toBe(base.y);
  });

  it('keeps slow projectiles visible', () => {
    const scale = getProjectileVisualScale('small', 0, 20);

    expect(scale.x).toBeCloseTo(2.1 * 0.35);
    expect(scale.y).toBe(0.7);
  });
});
