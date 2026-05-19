import type { AsteroidBodies } from '../../asteroids/bodies';
import type { Vector, WorldSize } from '../../core/types';
import type { FuelBlobViews } from '../../fuel/blobViews';
import type { ParticleViews } from '../../particles/views';
import type { PlanetViews } from '../../planets/views';
import type { PlayerBody } from '../../player/body';
import type { PlayerState } from '../../player/state';
import type { ProjectileBodies } from '../../projectiles/bodies';
import { nearestWrappedPosition } from '../../world/geometry';
import type { GameWorldRuntime } from '../../world/runtime';
import type { Mothership } from './Mothership';
import type { SandboxPlanetEntity } from './planetFuel';

type SandboxWorldPositioningInput = {
  asteroidBodies: AsteroidBodies;
  fuelBlobViews: FuelBlobViews;
  mothership: Mothership;
  now: number;
  particleViews: ParticleViews;
  planetViews: PlanetViews;
  planets: SandboxPlanetEntity[];
  player: PlayerState;
  playerBody: PlayerBody;
  projectileBodies: ProjectileBodies;
  runtime: GameWorldRuntime;
  world: WorldSize;
};

export function rebaseWorldAroundPlayer(input: SandboxWorldPositioningInput): void {
  const shift = getWorldRebaseShift(input.player.position, input.world);
  if (shift.x === 0 && shift.y === 0) return;

  shiftPlayer(input.playerBody, input.player.position, shift);
  for (const planet of input.planets) {
    planet.position.x += shift.x;
    planet.position.y += shift.y;
    input.planetViews.sync(planet);
  }
  for (const asteroid of input.runtime.world.asteroids) {
    asteroid.position.x += shift.x;
    asteroid.position.y += shift.y;
    input.asteroidBodies.get(asteroid).setPosition(asteroid.position.x, asteroid.position.y);
  }
  for (const projectile of input.runtime.world.projectiles) {
    projectile.position.x += shift.x;
    projectile.position.y += shift.y;
    input.projectileBodies.setPosition(projectile, projectile.position);
  }
  for (const blob of input.runtime.world.fuelBlobs) {
    blob.position.x += shift.x;
    blob.position.y += shift.y;
    input.fuelBlobViews.sync(blob);
  }
  for (const particle of input.runtime.world.particles) {
    particle.position.x += shift.x;
    particle.position.y += shift.y;
    input.particleViews.sync(particle);
  }
  input.mothership.moveBy(shift);
  input.mothership.sync(input.now);
}

export function keepMovingEntitiesNearPlayer(input: SandboxWorldPositioningInput): void {
  for (const planet of input.planets) {
    planet.position = nearestWrappedPosition(input.player.position, planet.position, input.world);
    input.planetViews.sync(planet);
  }
  for (const asteroid of input.runtime.world.asteroids) {
    const position = nearestWrappedPosition(input.player.position, asteroid.position, input.world);
    asteroid.position = position;
    input.asteroidBodies.get(asteroid).setPosition(position.x, position.y);
  }
  for (const projectile of input.runtime.world.projectiles) {
    const position = nearestWrappedPosition(
      input.player.position,
      projectile.position,
      input.world,
    );
    input.projectileBodies.setPosition(projectile, position);
  }
  for (const blob of input.runtime.world.fuelBlobs) {
    blob.position = nearestWrappedPosition(input.player.position, blob.position, input.world);
    input.fuelBlobViews.sync(blob);
  }
  for (const particle of input.runtime.world.particles) {
    particle.position = nearestWrappedPosition(
      input.player.position,
      particle.position,
      input.world,
    );
    input.particleViews.sync(particle);
  }
  input.mothership.keepNear(input.player.position, input.world);
  input.mothership.sync(input.now);
}

function getWorldRebaseShift(position: Vector, world: WorldSize): Vector {
  return {
    x: position.x < 0 ? world.width : position.x > world.width ? -world.width : 0,
    y: position.y < 0 ? world.height : position.y > world.height ? -world.height : 0,
  };
}

function shiftPlayer(playerBody: PlayerBody, playerPosition: Vector, shift: Vector): void {
  playerBody.setPosition({
    x: playerPosition.x + shift.x,
    y: playerPosition.y + shift.y,
  });
  playerBody.shieldSensor.setPosition(playerPosition.x, playerPosition.y);
}
