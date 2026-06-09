import type { Vector, WorldSize } from '../core/types';
import type { PlanetEntity } from '../planets/types';
import { applyGravityToTarget, buildWorldGravitySources } from '../world/gravity';
import { wrappedDelta } from '../world/geometry';

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
  const frameScale = stepSeconds * 60;
  const position = { ...input.position };
  const velocity = { ...input.velocity };
  let visualX = input.position.x;
  let visualY = input.position.y;
  const points: Vector[] = [];
  const sources = buildWorldGravitySources({ planets: input.planets });
  let strongestGravity = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const previousX = position.x;
    const previousY = position.y;
    const velocityBeforeGravity = { x: velocity.x, y: velocity.y };
    const collidesWithPlanet = collidesWithAnyPlanet(
      position,
      input.planets,
      input.playerRadius,
      input.world,
    );

    applyGravityToTarget({
      getDelta: (fromX, fromY, toX, toY) =>
        wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, input.world),
      sources,
      target: { position, velocity },
      timeScale: frameScale,
    });

    const gravityX = velocity.x - velocityBeforeGravity.x;
    const gravityY = velocity.y - velocityBeforeGravity.y;
    strongestGravity = Math.max(strongestGravity, gravityX * gravityX + gravityY * gravityY);

    position.x += velocity.x * frameScale;
    position.y += velocity.y * frameScale;
    if (position.x < 0) position.x += input.world.width;
    if (position.x > input.world.width) position.x -= input.world.width;
    if (position.y < 0) position.y += input.world.height;
    if (position.y > input.world.height) position.y -= input.world.height;

    visualX += getWrappedDeltaAxis(previousX, position.x, input.world.width);
    visualY += getWrappedDeltaAxis(previousY, position.y, input.world.height);

    if (collidesWithPlanet || frame % sampleEvery === 0) {
      points.push({ x: visualX, y: visualY });
    }
    if (collidesWithPlanet) {
      break;
    }
  }

  const strongestGravityMagnitude = Math.sqrt(strongestGravity);
  if (points.length < 2 || strongestGravityMagnitude < minGravity) return null;

  const alphaRange = Math.max(0.000001, fullAlphaGravity - minGravity);
  const alphaScale = Math.min(
    1,
    Math.max(0, (strongestGravityMagnitude - minGravity) / alphaRange),
  );
  return { alphaScale, points };
}

function getWrappedDeltaAxis(from: number, to: number, worldSize: number): number {
  let delta = to - from;
  if (delta > worldSize * 0.5) delta -= worldSize;
  if (delta < -worldSize * 0.5) delta += worldSize;
  return delta;
}

function collidesWithAnyPlanet(
  position: Vector,
  planets: PlanetEntity[],
  playerRadius: number,
  world: WorldSize,
): boolean {
  for (const planet of planets) {
    const delta = wrappedDelta(position, planet.position, world);
    const collisionRadius = playerRadius + planet.radius;
    if (delta.x * delta.x + delta.y * delta.y <= collisionRadius * collisionRadius) return true;
  }
  return false;
}
