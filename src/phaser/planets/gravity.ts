import type { Vector, WorldSize } from '../core/types';
import type { ParticleEntity } from '../particles/types';
import { applyGravityToTarget, buildWorldGravitySources } from '../world/gravity';
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
  applyGravityToTarget({
    getDelta: (fromX, fromY, toX, toY) =>
      wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, world),
    sources: buildWorldGravitySources({ planets }),
    target: { position, velocity },
    timeScale: deltaSeconds * 60,
  });
}

export function getParticlesCollidingWithPlanets(
  particles: ParticleEntity[],
  planets: PlanetEntity[],
  world: WorldSize,
): ParticleEntity[] {
  const collided: ParticleEntity[] = [];
  for (const particle of particles) {
    if (collidesWithAnyPlanet(particle.position, planets, world)) collided.push(particle);
  }
  return collided;
}

function collidesWithAnyPlanet(
  position: Vector,
  planets: PlanetEntity[],
  world: WorldSize,
): boolean {
  const worldHalfHeight = world.height * 0.5;
  const worldHalfWidth = world.width * 0.5;
  for (const planet of planets) {
    let deltaX = planet.position.x - position.x;
    if (deltaX > worldHalfWidth) deltaX -= world.width;
    if (deltaX < -worldHalfWidth) deltaX += world.width;
    let deltaY = planet.position.y - position.y;
    if (deltaY > worldHalfHeight) deltaY -= world.height;
    if (deltaY < -worldHalfHeight) deltaY += world.height;
    if (deltaX * deltaX + deltaY * deltaY <= planet.radius * planet.radius) return true;
  }
  return false;
}
