import type { Vector } from '../model';

export function gravityAcceleration(from: Vector, toward: Vector, strength: number, minDistance = 18): Vector {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const distanceSq = Math.max(minDistance * minDistance, dx * dx + dy * dy);
  const distance = Math.sqrt(distanceSq);
  return {
    x: (dx / distance) * (strength / distanceSq),
    y: (dy / distance) * (strength / distanceSq),
  };
}
