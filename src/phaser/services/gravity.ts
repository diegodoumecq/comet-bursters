import type { PlanetEntity, Vector, WorldSize } from '../model';
import { wrappedDelta } from './world';

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

export function applyPlanetGravity(
  velocity: Vector,
  position: Vector,
  planets: PlanetEntity[],
  world: WorldSize,
  deltaSeconds: number,
): void {
  for (const planet of planets) {
    const delta = wrappedDelta(position, planet.body, world);
    const distanceSq = delta.x * delta.x + delta.y * delta.y;
    const distance = Math.sqrt(distanceSq);
    const range = planet.radius * 6;
    if (distance > 0 && distance < range) {
      const force = (planet.gravityStrength * 0.5 * planet.radius * planet.radius) / distanceSq;
      velocity.x += (delta.x / distance) * force * deltaSeconds * 60;
      velocity.y += (delta.y / distance) * force * deltaSeconds * 60;
    }
  }
}
