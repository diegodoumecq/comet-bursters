import { describe, expect, it } from 'vitest';

import { PROJECTILES } from './config';
import { getProjectileVisualScale } from './rendering';

describe('projectile rendering', () => {
  it('stretches projectile length proportionally to speed', () => {
    const base = getProjectileVisualScale('small', PROJECTILES.small.speed);
    const faster = getProjectileVisualScale('small', PROJECTILES.small.speed * 1.5);

    expect(faster.x).toBeCloseTo(base.x * 1.5);
    expect(faster.y).toBe(base.y);
  });

  it('keeps slow projectiles visible', () => {
    const scale = getProjectileVisualScale('small', 0);

    expect(scale.x).toBeCloseTo(2.1 * 0.35);
    expect(scale.y).toBe(0.7);
  });
});
