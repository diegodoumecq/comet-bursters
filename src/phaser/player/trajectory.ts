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
  gravityStrength: number;
  lastQueryId: number;
  position: Vector;
  radius: number;
  rangeSq: number;
};

type TrajectoryPlanetInfluenceIndex = {
  cellSize: number;
  columns: number;
  influences: TrajectoryPlanetInfluence[];
  maxPlanetRadius: number;
  maxRange: number;
  queryId: number;
  rows: number;
  cells: TrajectoryPlanetInfluence[][];
  worldHeight: number;
  worldWidth: number;
};

const DEFAULT_SECONDS = 4;
const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_SAMPLE_EVERY = 3;
const DEFAULT_MIN_GRAVITY = 0.001;
const DEFAULT_FULL_ALPHA_GRAVITY = 0.05;
const planetInfluenceCache = new WeakMap<readonly PlanetEntity[], TrajectoryPlanetInfluenceIndex>();

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
  const worldHalfHeight = input.world.height * 0.5;
  const worldHalfWidth = input.world.width * 0.5;
  let positionX = input.position.x;
  let positionY = input.position.y;
  let velocityX = input.velocity.x;
  let velocityY = input.velocity.y;
  let visualX = input.position.x;
  let visualY = input.position.y;
  const points: Vector[] = [];
  const planetIndex = getTrajectoryPlanetInfluenceIndex(input.planets, input.world);
  const nearbyPlanets: TrajectoryPlanetInfluence[] = [];
  let strongestGravity = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const previousX = positionX;
    const previousY = positionY;
    let gravityX = 0;
    let gravityY = 0;
    let collidesWithPlanet = false;
    getNearbyTrajectoryPlanets(
      planetIndex,
      positionX,
      positionY,
      input.playerRadius,
      nearbyPlanets,
    );
    for (const planet of nearbyPlanets) {
      let deltaX = planet.position.x - positionX;
      if (deltaX > worldHalfWidth) deltaX -= input.world.width;
      if (deltaX < -worldHalfWidth) deltaX += input.world.width;
      let deltaY = planet.position.y - positionY;
      if (deltaY > worldHalfHeight) deltaY -= input.world.height;
      if (deltaY < -worldHalfHeight) deltaY += input.world.height;
      const distanceSq = deltaX * deltaX + deltaY * deltaY;
      const collisionRadius = input.playerRadius + planet.radius;
      if (distanceSq <= collisionRadius * collisionRadius) {
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
    const frameGravitySq = gravityX * gravityX + gravityY * gravityY;
    strongestGravity = Math.max(strongestGravity, frameGravitySq);

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

  const strongestGravityMagnitude = Math.sqrt(strongestGravity);
  if (points.length < 2 || strongestGravityMagnitude < minGravity) return null;

  const alphaRange = Math.max(0.000001, fullAlphaGravity - minGravity);
  const alphaScale = Math.min(
    1,
    Math.max(0, (strongestGravityMagnitude - minGravity) / alphaRange),
  );
  return { alphaScale, points };
}

function getTrajectoryPlanetInfluenceIndex(
  planets: readonly PlanetEntity[],
  world: WorldSize,
): TrajectoryPlanetInfluenceIndex {
  const cached = planetInfluenceCache.get(planets);
  if (cached?.worldWidth === world.width && cached.worldHeight === world.height) return cached;

  if (planets.length === 0) {
    const emptyIndex = {
      cellSize: Math.max(world.width, world.height, 1),
      cells: [[] as TrajectoryPlanetInfluence[]],
      columns: 1,
      influences: [],
      maxPlanetRadius: 0,
      maxRange: 0,
      queryId: 0,
      rows: 1,
      worldHeight: world.height,
      worldWidth: world.width,
    };
    planetInfluenceCache.set(planets, emptyIndex);
    return emptyIndex;
  }

  const maxPlanetRadius = planets.reduce((radius, planet) => Math.max(radius, planet.radius), 0);
  const maxRange = planets.reduce((range, planet) => Math.max(range, planet.radius * 6), 1);
  const cellSize = Math.max(1, maxRange);
  const columns = Math.max(1, Math.ceil(world.width / cellSize));
  const rows = Math.max(1, Math.ceil(world.height / cellSize));
  const cells = Array.from({ length: columns * rows }, () => [] as TrajectoryPlanetInfluence[]);
  const influences = planets.map((planet) => {
    const range = planet.radius * 6;
    const cellCol = getWrappedCellIndex(planet.position.x, cellSize, columns);
    const cellRow = getWrappedCellIndex(planet.position.y, cellSize, rows);
    const influence = {
      gravityStrength: planet.gravityStrength * 0.5 * planet.radius * planet.radius,
      lastQueryId: 0,
      position: planet.position,
      radius: planet.radius,
      rangeSq: range * range,
    };
    cells[cellRow * columns + cellCol].push(influence);
    return influence;
  });
  const index = {
    cellSize,
    cells,
    columns,
    influences,
    maxPlanetRadius,
    maxRange,
    queryId: 0,
    rows,
    worldHeight: world.height,
    worldWidth: world.width,
  };
  planetInfluenceCache.set(planets, index);
  return index;
}

function getNearbyTrajectoryPlanets(
  index: TrajectoryPlanetInfluenceIndex,
  x: number,
  y: number,
  playerRadius: number,
  output: TrajectoryPlanetInfluence[],
): void {
  output.length = 0;
  if (index.influences.length === 0) return;

  index.queryId += 1;
  const queryRadius = Math.max(index.maxRange, index.maxPlanetRadius + playerRadius);
  const cellRadius = Math.ceil(queryRadius / index.cellSize);
  const centerCol = getWrappedCellIndex(x, index.cellSize, index.columns);
  const centerRow = getWrappedCellIndex(y, index.cellSize, index.rows);
  for (let rowOffset = -cellRadius; rowOffset <= cellRadius; rowOffset += 1) {
    const row = positiveModulo(centerRow + rowOffset, index.rows);
    for (let colOffset = -cellRadius; colOffset <= cellRadius; colOffset += 1) {
      const col = positiveModulo(centerCol + colOffset, index.columns);
      const cell = index.cells[row * index.columns + col];
      for (const planet of cell) {
        if (planet.lastQueryId !== index.queryId) {
          planet.lastQueryId = index.queryId;
          output.push(planet);
        }
      }
    }
  }
}

function getWrappedCellIndex(position: number, cellSize: number, cellCount: number): number {
  return positiveModulo(Math.floor(position / cellSize), cellCount);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function getWrappedDeltaAxis(from: number, to: number, worldSize: number): number {
  let delta = to - from;
  if (delta > worldSize * 0.5) delta -= worldSize;
  if (delta < -worldSize * 0.5) delta += worldSize;
  return delta;
}
