import type { AsteroidEntity } from '../../asteroids/types';
import type { Vector, WorldSize } from '../../core/types';
import type { FuelBlobEntity } from '../../fuel/types';
import type { ParticleEntity } from '../../particles/types';
import type { FuelExtractionPlanetEntity } from '../../planets/fuelExtraction';
import type { ProjectileEntity } from '../../projectiles/types';
import { nearestWrappedPosition } from '../../world/geometry';
import type { GameWorld } from '../../world/state';

type AsteroidPositioningBodies = {
  setPosition(asteroid: AsteroidEntity, position: Vector): void;
};

type PositionableBody = {
  setPosition(x: number, y: number): void;
};

type FuelPositioningBodies = {
  setPosition(blob: FuelBlobEntity, position: Vector): void;
  sync(blob: FuelBlobEntity): void;
};

type MothershipPositioning = {
  sync(now: number): void;
};

type MothershipRebasePositioning = MothershipPositioning & {
  moveBy(shift: Vector): void;
};

type MothershipWrappedWorldPositioning = MothershipPositioning & {
  keepNear(playerPosition: Vector, world: WorldSize): void;
};

type ParticlePositioningViews = {
  sync(particle: ParticleEntity): void;
};

type PlanetPositioningViews = {
  sync(planet: FuelExtractionPlanetEntity): void;
};

type PlayerPositioningBody = {
  setPosition(position: Vector): void;
  shieldSensor: PositionableBody;
};

type PlayerPositioningState = {
  position: Vector;
};

type ProjectilePositioningBodies = {
  setPosition(projectile: ProjectileEntity, position: Vector): void;
};

type SandboxPositioningRuntime = {
  world: Pick<GameWorld, 'asteroids' | 'fuelBlobs' | 'particles' | 'projectiles'>;
};

type SandboxWorldPositioningBaseInput = {
  asteroidBodies: AsteroidPositioningBodies;
  fuelBodies: FuelPositioningBodies;
  now: number;
  particleViews: ParticlePositioningViews;
  planetViews: PlanetPositioningViews;
  planets: FuelExtractionPlanetEntity[];
  player: PlayerPositioningState;
  projectileBodies: ProjectilePositioningBodies;
  runtime: SandboxPositioningRuntime;
  world: WorldSize;
};

export type SandboxWorldRebaseInput = SandboxWorldPositioningBaseInput & {
  mothership: MothershipRebasePositioning;
  playerBody: PlayerPositioningBody;
};

export type SandboxWrappedWorldPositioningInput = SandboxWorldPositioningBaseInput & {
  mothership: MothershipWrappedWorldPositioning;
};

export type SandboxWorldPositioningInput = SandboxWorldPositioningBaseInput & {
  mothership: MothershipRebasePositioning & MothershipWrappedWorldPositioning;
  playerBody: PlayerPositioningBody;
};

export function rebaseSandboxWorldAtBounds(input: SandboxWorldRebaseInput): void {
  const shift = getWorldRebaseShift(input.player.position, input.world);
  if (shift.x === 0 && shift.y === 0) return;

  rebasePlayer(input, shift);
  rebasePlanets(input, shift);
  rebaseAsteroids(input, shift);
  rebaseProjectiles(input, shift);
  rebaseFuelBlobs(input, shift);
  rebaseParticles(input, shift);
  rebaseMothership(input, shift);
}

export function positionSandboxWrappedWorldNearPlayer(
  input: SandboxWrappedWorldPositioningInput,
): void {
  positionPlanetsNearPlayer(input);
  positionAsteroidsNearPlayer(input);
  positionProjectilesNearPlayer(input);
  positionFuelBlobsNearPlayer(input);
  positionParticlesNearPlayer(input);
  positionMothershipNearPlayer(input);
}

function rebasePlayer(input: SandboxWorldRebaseInput, shift: Vector): void {
  input.playerBody.setPosition({
    x: input.player.position.x + shift.x,
    y: input.player.position.y + shift.y,
  });
  input.playerBody.shieldSensor.setPosition(input.player.position.x, input.player.position.y);
}

function rebasePlanets(input: SandboxWorldPositioningBaseInput, shift: Vector): void {
  for (const planet of input.planets) {
    planet.position.x += shift.x;
    planet.position.y += shift.y;
    input.planetViews.sync(planet);
  }
}

function rebaseAsteroids(input: SandboxWorldPositioningBaseInput, shift: Vector): void {
  for (const asteroid of input.runtime.world.asteroids) {
    input.asteroidBodies.setPosition(asteroid, {
      x: asteroid.position.x + shift.x,
      y: asteroid.position.y + shift.y,
    });
  }
}

function rebaseProjectiles(input: SandboxWorldPositioningBaseInput, shift: Vector): void {
  for (const projectile of input.runtime.world.projectiles) {
    projectile.position.x += shift.x;
    projectile.position.y += shift.y;
    input.projectileBodies.setPosition(projectile, projectile.position);
  }
}

function rebaseFuelBlobs(input: SandboxWorldPositioningBaseInput, shift: Vector): void {
  for (const blob of input.runtime.world.fuelBlobs) {
    input.fuelBodies.sync(blob);
    blob.position.x += shift.x;
    blob.position.y += shift.y;
    input.fuelBodies.setPosition(blob, blob.position);
  }
}

function rebaseParticles(input: SandboxWorldPositioningBaseInput, shift: Vector): void {
  for (const particle of input.runtime.world.particles) {
    particle.position.x += shift.x;
    particle.position.y += shift.y;
    input.particleViews.sync(particle);
  }
}

function rebaseMothership(input: SandboxWorldRebaseInput, shift: Vector): void {
  input.mothership.moveBy(shift);
  input.mothership.sync(input.now);
}

function positionPlanetsNearPlayer(input: SandboxWorldPositioningBaseInput): void {
  for (const planet of input.planets) {
    planet.position = nearestWrappedPosition(input.player.position, planet.position, input.world);
    input.planetViews.sync(planet);
  }
}

function positionAsteroidsNearPlayer(input: SandboxWorldPositioningBaseInput): void {
  for (const asteroid of input.runtime.world.asteroids) {
    const position = nearestWrappedPosition(input.player.position, asteroid.position, input.world);
    input.asteroidBodies.setPosition(asteroid, position);
  }
}

function positionProjectilesNearPlayer(input: SandboxWorldPositioningBaseInput): void {
  for (const projectile of input.runtime.world.projectiles) {
    const position = nearestWrappedPosition(
      input.player.position,
      projectile.position,
      input.world,
    );
    input.projectileBodies.setPosition(projectile, position);
  }
}

function positionFuelBlobsNearPlayer(input: SandboxWorldPositioningBaseInput): void {
  for (const blob of input.runtime.world.fuelBlobs) {
    input.fuelBodies.sync(blob);
    blob.position = nearestWrappedPosition(input.player.position, blob.position, input.world);
    input.fuelBodies.setPosition(blob, blob.position);
  }
}

function positionParticlesNearPlayer(input: SandboxWorldPositioningBaseInput): void {
  for (const particle of input.runtime.world.particles) {
    particle.position = nearestWrappedPosition(
      input.player.position,
      particle.position,
      input.world,
    );
    input.particleViews.sync(particle);
  }
}

function positionMothershipNearPlayer(input: SandboxWrappedWorldPositioningInput): void {
  input.mothership.keepNear(input.player.position, input.world);
  input.mothership.sync(input.now);
}

function getWorldRebaseShift(position: Vector, world: WorldSize): Vector {
  return {
    x: getAxisRebaseShift(position.x, world.width),
    y: getAxisRebaseShift(position.y, world.height),
  };
}

function getAxisRebaseShift(position: number, worldSize: number): number {
  if (position < 0) return worldSize;
  if (position > worldSize) return -worldSize;
  return 0;
}
