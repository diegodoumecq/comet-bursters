import type { MatterImage, Vector, WorldSize } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import { wrappedDelta } from '../world/geometry';
import type { PlanetEntity } from './types';

export function gravityAcceleration(
  from: Vector,
  toward: Vector,
  strength: number,
  minDistance = 18,
): Vector {
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
    const delta = wrappedDelta(position, planet.position, world);
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

export function applyPlanetGravityToBody(
  body: MatterImage,
  planets: PlanetEntity[],
  world: WorldSize,
  deltaSeconds: number,
): void {
  const velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
  applyPlanetGravity(velocity, body, planets, world, deltaSeconds);
  body.setVelocity(velocity.x, velocity.y);
}

export function applyPlanetGravityToFuelBlobs(
  blobs: FuelBlobEntity[],
  planets: PlanetEntity[],
  world: WorldSize,
  deltaSeconds: number,
): void {
  for (const blob of blobs) {
    if (blob.affectedByPlanetGravity) {
      applyPlanetGravity(blob.velocity, blob.position, planets, world, deltaSeconds);
    }
  }
}
