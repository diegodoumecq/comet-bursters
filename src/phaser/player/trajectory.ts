import type { Vector, WorldSize } from '../core/types';
import { applyPlanetGravity } from '../planets/gravity';
import type { PlanetEntity } from '../planets/types';
import { wrappedDelta, wrapPoint } from '../world/geometry';

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
  const projection = {
    position: { ...input.position },
    velocity: { ...input.velocity },
  };
  let visualPosition = { ...input.position };
  const points: Vector[] = [];
  let strongestGravity = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const previousPosition = { ...projection.position };
    const previousVelocity = { ...projection.velocity };
    applyPlanetGravity(
      projection.velocity,
      projection.position,
      input.planets,
      input.world,
      stepSeconds,
    );
    const frameGravity = Math.hypot(
      projection.velocity.x - previousVelocity.x,
      projection.velocity.y - previousVelocity.y,
    );
    strongestGravity = Math.max(strongestGravity, frameGravity);

    const frameScale = stepSeconds * 60;
    projection.position.x += projection.velocity.x * frameScale;
    projection.position.y += projection.velocity.y * frameScale;
    wrapPoint(projection.position, input.world);

    const visualDelta = wrappedDelta(previousPosition, projection.position, input.world);
    visualPosition = {
      x: visualPosition.x + visualDelta.x,
      y: visualPosition.y + visualDelta.y,
    };

    const collidesWithPlanet = input.planets.some((planet) => {
      const planetDelta = wrappedDelta(projection.position, planet.position, input.world);
      return Math.hypot(planetDelta.x, planetDelta.y) <= input.playerRadius + planet.radius;
    });
    if (collidesWithPlanet || frame % sampleEvery === 0) {
      points.push({ ...visualPosition });
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
