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

type TrajectoryPlanetInfluence = {
  collisionRadiusSq: number;
  gravityStrength: number;
  position: Vector;
  rangeSq: number;
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
  const planets: TrajectoryPlanetInfluence[] = input.planets.map((planet) => {
    const collisionRadius = input.playerRadius + planet.radius;
    const gravityStrength = planet.gravityStrength * 0.5 * planet.radius * planet.radius;
    const range = planet.radius * 6;
    return {
      collisionRadiusSq: collisionRadius * collisionRadius,
      gravityStrength,
      position: planet.position,
      rangeSq: range * range,
    };
  });
  let strongestGravity = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const previousX = positionX;
    const previousY = positionY;
    let gravityX = 0;
    let gravityY = 0;
    let collidesWithPlanet = false;
    for (const planet of planets) {
      const deltaX = getWrappedDeltaAxis(positionX, planet.position.x, input.world.width);
      const deltaY = getWrappedDeltaAxis(positionY, planet.position.y, input.world.height);
      const distanceSq = deltaX * deltaX + deltaY * deltaY;
      if (distanceSq <= planet.collisionRadiusSq) {
        collidesWithPlanet = true;
      }
      if (distanceSq > 0 && distanceSq < planet.rangeSq) {
        const distance = Math.sqrt(distanceSq);
        const force = planet.gravityStrength / distanceSq;
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

function getWrappedDeltaAxis(from: number, to: number, worldSize: number): number {
  let delta = to - from;
  if (delta > worldSize * 0.5) delta -= worldSize;
  if (delta < -worldSize * 0.5) delta += worldSize;
  return delta;
}
