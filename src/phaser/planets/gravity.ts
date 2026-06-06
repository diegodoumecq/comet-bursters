import type { MatterImage, Vector, WorldSize } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
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
  const worldHalfHeight = world.height * 0.5;
  const worldHalfWidth = world.width * 0.5;
  const timeScale = deltaSeconds * 60;
  for (const planet of planets) {
    let deltaX = planet.position.x - position.x;
    if (deltaX > worldHalfWidth) deltaX -= world.width;
    if (deltaX < -worldHalfWidth) deltaX += world.width;
    let deltaY = planet.position.y - position.y;
    if (deltaY > worldHalfHeight) deltaY -= world.height;
    if (deltaY < -worldHalfHeight) deltaY += world.height;
    const distanceSq = deltaX * deltaX + deltaY * deltaY;
    const range = planet.radius * 6;
    if (distanceSq > 0 && distanceSq < range * range) {
      const distance = Math.sqrt(distanceSq);
      const force = (planet.gravityStrength * 0.5 * planet.radius * planet.radius) / distanceSq;
      velocity.x += (deltaX / distance) * force * timeScale;
      velocity.y += (deltaY / distance) * force * timeScale;
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
