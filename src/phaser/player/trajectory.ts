import type { Vector, WorldSize } from '../core/types';
import type { PlanetEntity } from '../planets/types';

export type PlayerTrajectoryPreview = {
  alphaScale: number;
  points: Vector[];
};

type PlayerTrajectoryPreviewInput = {
  fullAlphaGravity?: number;
  minGravity?: number;
  planets: PlanetEntity[];
  playerRadius: number;
  position: Vector;
  sampleEvery?: number;
  seconds?: number;
  stepSeconds?: number;
  velocity: Vector;
  world: WorldSize;
};

const DEFAULT_SECONDS = 4;
const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_SAMPLE_EVERY = 3;
const DEFAULT_MIN_GRAVITY = 0.001;
const DEFAULT_FULL_ALPHA_GRAVITY = 0.05;

export function buildPlayerTrajectoryPreview(
  input: PlayerTrajectoryPreviewInput,
): PlayerTrajectoryPreview | null {
  const seconds = input.seconds ?? DEFAULT_SECONDS;
  const stepSeconds = Math.max(0.000001, input.stepSeconds ?? DEFAULT_STEP_SECONDS);
  const sampleEvery = Math.max(1, Math.floor(input.sampleEvery ?? DEFAULT_SAMPLE_EVERY));
  const minGravity = input.minGravity ?? DEFAULT_MIN_GRAVITY;
  const fullAlphaGravity = input.fullAlphaGravity ?? DEFAULT_FULL_ALPHA_GRAVITY;
  const frameCount = Math.max(0, Math.floor(seconds / stepSeconds));
  let positionX = input.position.x;
  let positionY = input.position.y;
  let velocityX = input.velocity.x;
  let velocityY = input.velocity.y;
  let visualX = input.position.x;
  let visualY = input.position.y;
  const points: Vector[] = [];
  let strongestGravity = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const previousX = positionX;
    const previousY = positionY;
    let gravityX = 0;
    let gravityY = 0;
    for (const planet of input.planets) {
      const deltaX = getWrappedDeltaAxis(positionX, planet.position.x, input.world.width);
      const deltaY = getWrappedDeltaAxis(positionY, planet.position.y, input.world.height);
      const distanceSq = deltaX * deltaX + deltaY * deltaY;
      const distance = Math.sqrt(distanceSq);
      const range = planet.radius * 6;
      if (distance > 0 && distance < range) {
        const force = (planet.gravityStrength * 0.5 * planet.radius * planet.radius) / distanceSq;
        gravityX += (deltaX / distance) * force * stepSeconds * 60;
        gravityY += (deltaY / distance) * force * stepSeconds * 60;
      }
    }
    velocityX += gravityX;
    velocityY += gravityY;
    const frameGravity = Math.hypot(gravityX, gravityY);
    strongestGravity = Math.max(strongestGravity, frameGravity);

    const frameScale = stepSeconds * 60;
    positionX += velocityX * frameScale;
    positionY += velocityY * frameScale;
    if (positionX < 0) positionX += input.world.width;
    if (positionX > input.world.width) positionX -= input.world.width;
    if (positionY < 0) positionY += input.world.height;
    if (positionY > input.world.height) positionY -= input.world.height;

    visualX += getWrappedDeltaAxis(previousX, positionX, input.world.width);
    visualY += getWrappedDeltaAxis(previousY, positionY, input.world.height);

    const collidesWithPlanet = collidesWithAnyPlanet(
      positionX,
      positionY,
      input.playerRadius,
      input.planets,
      input.world,
    );
    if (collidesWithPlanet || frame % sampleEvery === 0) {
      points.push({ x: visualX, y: visualY });
    }
    if (collidesWithPlanet) {
      break;
    }
  }

  if (points.length < 2 || strongestGravity < minGravity) return null;

  const alphaRange = Math.max(0.000001, fullAlphaGravity - minGravity);
  const alphaScale = Math.min(1, Math.max(0, (strongestGravity - minGravity) / alphaRange));
  return { alphaScale, points };
}

function collidesWithAnyPlanet(
  positionX: number,
  positionY: number,
  playerRadius: number,
  planets: PlanetEntity[],
  world: WorldSize,
): boolean {
  let collides = false;
  for (const planet of planets) {
    if (!collides) {
      const deltaX = getWrappedDeltaAxis(positionX, planet.position.x, world.width);
      const deltaY = getWrappedDeltaAxis(positionY, planet.position.y, world.height);
      const collisionRadius = playerRadius + planet.radius;
      collides = deltaX * deltaX + deltaY * deltaY <= collisionRadius * collisionRadius;
    }
  }
  return collides;
}

function getWrappedDeltaAxis(from: number, to: number, worldSize: number): number {
  let delta = to - from;
  if (delta > worldSize * 0.5) delta -= worldSize;
  if (delta < -worldSize * 0.5) delta += worldSize;
  return delta;
}
