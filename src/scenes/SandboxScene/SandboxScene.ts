import { getAsteroidSpriteMask, getAsteroidSpriteRadius, getRandomAsteroidColor } from '@/assets';
import {
  ASTEROID_CONFIGS,
  ASTEROID_FUEL_DROP_CHANCES,
  ASTEROID_FUEL_DROP_MAX_BLOBS,
  BULLET_CONFIGS,
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_ATTRACTION_ACCELERATION,
  FUEL_BLOB_ATTRACTION_RADIUS,
  FUEL_BLOB_DRAG,
  FUEL_BLOB_MAX_SPEED,
  FUEL_BLOB_RADIUS,
  FUEL_INSPECTION_BLOB_AMOUNT,
  FUEL_THRUST_PER_SECOND,
  FUELLESS_THRUST_POWER_SCALE,
  GRID_COLOR,
  GRID_SPACING,
  INSPECTION_PROBE_DURATION_MS,
  INSPECTION_PROBE_RADIUS,
  PLANET_CONFIG,
  PLAYER_ACCELERATION,
  PLAYER_MAX_SPEED,
  PLAYER_SIZE,
  SHIELD_COLLISION_FUEL_COSTS,
  SHIELD_HIT_COOLDOWN,
  SHIELD_RADIUS,
  STAR_BASE_ALPHA,
  STAR_TWINKLE_AMOUNT,
  type Asteroid,
  type Bullet,
  type FuelBlob,
  type FuelExtractor,
  type Particle,
  type Planet,
  type Player,
  type SelectableWeaponType,
} from '@/constants';
import { InputManager } from '@/input';
import { joymap } from '@/joymap';
import { circleIntersectsRotatedMask } from '@/maskCollision';
import {
  drainFuel,
  getWeaponFireMode,
  refillRespawnResources,
  type BulletMode,
  type WeaponType,
} from '@/playerFuel';
import {
  asteroids,
  backgroundOffset,
  bullets,
  gameState,
  getGameHeight,
  getGameWidth,
  particles,
  planets,
  player,
  resetState,
  screenShake,
  setPlayer,
  applySavedWeaponSlots,
  stars,
  thrusterParticles,
} from '@/state';
import { updateBackground } from '../GameScene/background';
import { getBlackHoleRenderRadius, updateBlackHoleLifecycles } from '../GameScene/blackHole';
import {
  createExplosion,
  createExplosionBurst,
  createShipDebris,
  createThrusterParticle,
  drawOneParticle,
  drawThrusterParticle,
  updateThrusterParticle,
} from '../GameScene/particle';
import { createPlayer, drawOnePlayer, incrementRespawnCount } from '../GameScene/player';
import { rumbleDeath } from '../GameScene/rumble';
import {
  dispose as disposeBlackHoleShader,
  initShader,
  renderWithShaders,
  updateBlackHoles,
} from '../GameScene/shader';
import type { Scene } from '../scene';
import {
  drawInspectionProbe,
  fireInspectionProbe,
  updateInspectionProbes,
  type InspectionProbe,
} from '../inspectionProbe';
import { getPlayerTimeDilationStep } from '../timeDilation';
import { applyTractorBeamToTargets, drawTractorBeam } from '../tractorBeam';
import { drawWeaponSelectionMenuIfOpen } from '../weaponSelection';
import {
  disposeFuelMetaballs,
  initFuelMetaballs,
  renderFuelMetaballs,
  resizeFuelMetaballs,
  type FuelMetaball,
} from './fuelMetaballs';
import { createPlanet, drawPlanet } from './planets';

const SANDBOX_WORLD_WIDTH = 12000;
const SANDBOX_WORLD_HEIGHT = 12000;
const SANDBOX_PLANET_COUNT = 8;
const MAX_PLANET_RADIUS = Math.max(...Object.values(PLANET_CONFIG).map((config) => config.radius));
const SANDBOX_PLANET_MARGIN = MAX_PLANET_RADIUS * 2;
const SANDBOX_SPAWN_MARGIN = 300;
const BULLET_RADIUS = 15;
const RESPAWN_DELAY = 2000;
const INVULNERABLE_RESPAWN = 2000;
const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 220;
const MINIMAP_PADDING = 20;
const MAX_INTERNAL_FUEL_METABALLS_PER_PLANET = 14;
const SANDBOX_INITIAL_ASTEROIDS = 36;
const SANDBOX_INITIAL_ASTEROID_SPEED_SCALE = 0.28;
const MINIMAP_FOG_COLUMNS = 44;
const MINIMAP_FOG_ROWS = 44;
const MINIMAP_SEE_RADIUS = 1250;
const TRAJECTORY_PREVIEW_SECONDS = 2;
const TRAJECTORY_PREVIEW_FRAMES = TRAJECTORY_PREVIEW_SECONDS * 60;
const TRAJECTORY_PREVIEW_SAMPLE_EVERY = 3;
const TRAJECTORY_PREVIEW_MIN_GRAVITY = 0.001;
const TRAJECTORY_PREVIEW_FULL_ALPHA_GRAVITY = 0.05;

type Camera = { x: number; y: number };
type Point = { x: number; y: number };

type DroppedFuelBlob = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobbleSeed: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function positiveModulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function wrapWorldPoint<T extends { x: number; y: number }>(point: T): void {
  point.x = positiveModulo(point.x, SANDBOX_WORLD_WIDTH);
  point.y = positiveModulo(point.y, SANDBOX_WORLD_HEIGHT);
}

function getWorldRebaseOffset(value: number, size: number): number {
  return Math.trunc(value / size) * size;
}

function shortestWrappedDeltaAxis(from: number, to: number, size: number): number {
  return positiveModulo(to - from + size / 2, size) - size / 2;
}

function wrappedDelta(fromX: number, fromY: number, toX: number, toY: number): Point {
  return {
    x: shortestWrappedDeltaAxis(fromX, toX, SANDBOX_WORLD_WIDTH),
    y: shortestWrappedDeltaAxis(fromY, toY, SANDBOX_WORLD_HEIGHT),
  };
}

function wrappedDistance(aX: number, aY: number, bX: number, bY: number): number {
  const delta = wrappedDelta(aX, aY, bX, bY);
  return Math.hypot(delta.x, delta.y);
}

function getNearestWrappedPosition(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
): Point {
  const delta = wrappedDelta(targetX, targetY, x, y);
  return { x: targetX + delta.x, y: targetY + delta.y };
}

function getWrappedDrawPositions(
  x: number,
  y: number,
  radius: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): Point[] {
  const centerX = camera.x + viewportWidth / 2;
  const centerY = camera.y + viewportHeight / 2;
  const base = getNearestWrappedPosition(x, y, centerX, centerY);
  const positions: Point[] = [];

  for (let offsetX = -SANDBOX_WORLD_WIDTH; offsetX <= SANDBOX_WORLD_WIDTH; offsetX += SANDBOX_WORLD_WIDTH) {
    for (let offsetY = -SANDBOX_WORLD_HEIGHT; offsetY <= SANDBOX_WORLD_HEIGHT; offsetY += SANDBOX_WORLD_HEIGHT) {
      const drawX = base.x + offsetX;
      const drawY = base.y + offsetY;
      if (
        drawX + radius >= camera.x &&
        drawX - radius <= camera.x + viewportWidth &&
        drawY + radius >= camera.y &&
        drawY - radius <= camera.y + viewportHeight
      ) {
        positions.push({ x: drawX, y: drawY });
      }
    }
  }

  return positions;
}

function withWrappedDrawPositions(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  draw: (position: Point) => void,
): void {
  for (const position of getWrappedDrawPositions(x, y, radius, camera, viewportWidth, viewportHeight)) {
    ctx.save();
    ctx.translate(position.x - x, position.y - y);
    draw(position);
    ctx.restore();
  }
}

function circleIntersectsWrappedRotatedMask(
  circleX: number,
  circleY: number,
  circleRadius: number,
  body: Asteroid,
): boolean {
  const nearestBodyPosition = getNearestWrappedPosition(body.x, body.y, circleX, circleY);
  return circleIntersectsRotatedMask(circleX, circleY, circleRadius, {
    ...body,
    x: nearestBodyPosition.x,
    y: nearestBodyPosition.y,
  });
}

function resolveWrappedAsteroidCollisions(): void {
  for (let i = 0; i < asteroids.length; i += 1) {
    for (let j = i + 1; j < asteroids.length; j += 1) {
      const a = asteroids[i];
      const b = asteroids[j];
      const delta = wrappedDelta(a.x, a.y, b.x, b.y);
      const dist = Math.max(0.001, Math.hypot(delta.x, delta.y));
      const minDist = a.getRadius() + b.getRadius();
      if (dist < minDist) {
        const nx = delta.x / dist;
        const ny = delta.y / dist;
        const overlap = minDist - dist;
        const totalMass = a.mass + b.mass;
        a.x -= nx * overlap * (b.mass / totalMass);
        a.y -= ny * overlap * (b.mass / totalMass);
        b.x += nx * overlap * (a.mass / totalMass);
        b.y += ny * overlap * (a.mass / totalMass);
        wrapWorldPoint(a);
        wrapWorldPoint(b);

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velocityAlongNormal = rvx * nx + rvy * ny;
        if (velocityAlongNormal <= 0) {
          const impulse = (-(1.05) * velocityAlongNormal) / (1 / a.mass + 1 / b.mass);
          a.vx -= (impulse / a.mass) * nx;
          a.vy -= (impulse / a.mass) * ny;
          b.vx += (impulse / b.mass) * nx;
          b.vy += (impulse / b.mass) * ny;
        }
      }
    }
  }
}

function makeFuelBlob(id: string): FuelBlob {
  return {
    id,
    localOffsetX: (Math.random() - 0.5) * 54,
    localOffsetY: (Math.random() - 0.5) * 24,
    wobbleSeed: Math.random(),
  };
}

function getExtractorFrame(planet: Planet, extractor: FuelExtractor) {
  const surfaceAngle = planet.rotation + extractor.anchorAngle;
  const normalX = Math.cos(surfaceAngle);
  const normalY = Math.sin(surfaceAngle);
  const tangentX = -normalY;
  const tangentY = normalX;
  const buildingHeight = 34;
  const cloudOffset = 34;
  const buildingX = planet.x + normalX * planet.getRadius();
  const buildingY = planet.y + normalY * planet.getRadius();
  const cloudCenterX = planet.x + normalX * (planet.getRadius() + buildingHeight + cloudOffset);
  const cloudCenterY = planet.y + normalY * (planet.getRadius() + buildingHeight + cloudOffset);

  return {
    surfaceAngle,
    normalX,
    normalY,
    tangentX,
    tangentY,
    buildingHeight,
    buildingX,
    buildingY,
    cloudCenterX,
    cloudCenterY,
  };
}

function getExtractorBlobWorldPosition(
  planet: Planet,
  extractor: FuelExtractor,
  blob: FuelBlob,
  now: number,
): { x: number; y: number } {
  const frame = getExtractorFrame(planet, extractor);
  const wobble = Math.sin(now * 0.003 + blob.wobbleSeed * Math.PI * 2) * 4;
  return {
    x:
      frame.cloudCenterX +
      frame.tangentX * blob.localOffsetX +
      frame.normalX * (blob.localOffsetY + wobble),
    y:
      frame.cloudCenterY +
      frame.tangentY * blob.localOffsetX +
      frame.normalY * (blob.localOffsetY + wobble),
  };
}

function addFuel(player: Player, amount: number): void {
  player.fuel = Math.min(player.maxFuel, player.fuel + amount);
}

function applyGravity(
  entity: { x: number; y: number; vx: number; vy: number },
  planet: Planet,
  deltaScale = 1,
): number {
  const { x: dx, y: dy } = wrappedDelta(entity.x, entity.y, planet.x, planet.y);
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  const planetRadius = planet.getRadius();

  if (dist < planetRadius * 6 && dist > 0) {
    const force =
      (PLANET_CONFIG[planet.kind].gravityStrength * 0.5 * planetRadius * planetRadius) / distSq;
    entity.vx += (dx / dist) * force * deltaScale;
    entity.vy += (dy / dist) * force * deltaScale;
    return force;
  }

  return 0;
}

function drawPlayerTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  currentPlayer: Player,
  visualPlayerPosition: Point,
): void {
  if (currentPlayer.waitingToRespawn) {
    return;
  }

  const projection = {
    x: currentPlayer.x,
    y: currentPlayer.y,
    vx: currentPlayer.vx,
    vy: currentPlayer.vy,
  };
  let visualPoint = { ...visualPlayerPosition };
  const points: Array<{ x: number; y: number }> = [];
  let strongestGravity = 0;

  for (let frame = 0; frame < TRAJECTORY_PREVIEW_FRAMES; frame += 1) {
    const previousProjection = { x: projection.x, y: projection.y };
    let frameGravity = 0;
    for (const planet of planets) {
      frameGravity += applyGravity(projection, planet);
    }
    strongestGravity = Math.max(strongestGravity, frameGravity);
    projection.x += projection.vx;
    projection.y += projection.vy;
    wrapWorldPoint(projection);
    const visualDelta = wrappedDelta(
      previousProjection.x,
      previousProjection.y,
      projection.x,
      projection.y,
    );
    visualPoint = {
      x: visualPoint.x + visualDelta.x,
      y: visualPoint.y + visualDelta.y,
    };
    const collidingPlanet = planets.some(
      (planet) =>
        wrappedDistance(projection.x, projection.y, planet.x, planet.y) <=
        currentPlayer.getRadius() + planet.getRadius(),
    );
    if (collidingPlanet) {
      points.push(visualPoint);
      break;
    }
    if (frame % TRAJECTORY_PREVIEW_SAMPLE_EVERY === 0) {
      points.push(visualPoint);
    }
  }

  if (points.length < 2 || strongestGravity < TRAJECTORY_PREVIEW_MIN_GRAVITY) {
    return;
  }

  const gravityAlphaScale = Math.min(
    1,
    (strongestGravity - TRAJECTORY_PREVIEW_MIN_GRAVITY) /
      (TRAJECTORY_PREVIEW_FULL_ALPHA_GRAVITY - TRAJECTORY_PREVIEW_MIN_GRAVITY),
  );

  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let previous = { ...visualPlayerPosition };
  for (let i = 0; i < points.length; i += 1) {
    const fade = 1 - i / points.length;
    const alpha = (0.025 + 0.36 * fade * fade) * gravityAlphaScale;
    const point = points[i];
    ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    previous = point;
  }

  ctx.restore();
}

function createSandboxAsteroid(
  size: 'mega' | 'big' | 'medium' | 'small',
  fromSplit = false,
  originX = SANDBOX_WORLD_WIDTH * 0.5,
  originY = SANDBOX_WORLD_HEIGHT * 0.5,
): Asteroid {
  const config = ASTEROID_CONFIGS[size];
  let x = originX;
  let y = originY;
  let angle = Math.random() * Math.PI * 2;

  if (!fromSplit) {
    let validSpawnFound = false;

    for (let attempt = 0; attempt < 40; attempt++) {
      x = config.radius + Math.random() * (SANDBOX_WORLD_WIDTH - config.radius * 2);
      y = config.radius + Math.random() * (SANDBOX_WORLD_HEIGHT - config.radius * 2);

      const tooCloseToPlanet = planets.some(
        (planet) =>
          wrappedDistance(planet.x, planet.y, x, y) < planet.getRadius() + config.radius + 80,
      );

      if (!tooCloseToPlanet) {
        validSpawnFound = true;
        break;
      }
    }

    if (!validSpawnFound) {
      x = config.radius + Math.random() * (SANDBOX_WORLD_WIDTH - config.radius * 2);
      y = config.radius + Math.random() * (SANDBOX_WORLD_HEIGHT - config.radius * 2);
    }

    const centerX = SANDBOX_WORLD_WIDTH * 0.5;
    const centerY = SANDBOX_WORLD_HEIGHT * 0.5;
    angle = Math.atan2(centerY - y, centerX - x) + (Math.random() - 0.5) * Math.PI * 0.75;
  }

  const speed = config.speed * (0.8 + Math.random() * 0.4);
  const color = getRandomAsteroidColor(size);
  const mask = getAsteroidSpriteMask(size, color);
  const collisionRadius = getAsteroidSpriteRadius(size, color);

  const asteroid = {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.05,
    size,
    color,
    hits: config.hits,
    splitCount: config.splitCount,
    mass: config.mass,
    mask,
    getRadius: () => collisionRadius,
  };
  wrapWorldPoint(asteroid);
  return asteroid;
}

function drawAsteroid(asteroid: Asteroid, ctx: CanvasRenderingContext2D): void {
  const config = ASTEROID_CONFIGS[asteroid.size];
  const sprite = gameState.asteroidSprites[asteroid.size][asteroid.color];
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);
  ctx.drawImage(sprite, -config.radius, -config.radius, config.radius * 2, config.radius * 2);
  ctx.restore();
}

function updateAsteroid(asteroid: Asteroid, deltaScale = 1): void {
  asteroid.x += asteroid.vx * deltaScale;
  asteroid.y += asteroid.vy * deltaScale;
  wrapWorldPoint(asteroid);
  asteroid.rotation += asteroid.rotationSpeed * deltaScale;
}

function splitAsteroid(asteroid: Asteroid): Asteroid[] {
  const childSize = ASTEROID_CONFIGS[asteroid.size].childSize;
  if (!childSize) {
    return [];
  }

  const children: Asteroid[] = [];
  const childConfig = ASTEROID_CONFIGS[childSize];

  for (let i = 0; i < asteroid.splitCount; i++) {
    const child = createSandboxAsteroid(
      childSize,
      true,
      asteroid.x + (Math.random() - 0.5) * 20,
      asteroid.y + (Math.random() - 0.5) * 20,
    );

    const angle = Math.random() * Math.PI * 2;
    const speed = childConfig.speed * (0.8 + Math.random() * 0.4);
    child.vx = asteroid.vx + Math.cos(angle) * speed;
    child.vy = asteroid.vy + Math.sin(angle) * speed;
    children.push(child);
  }

  return children;
}

function updateBullet(bullet: Bullet, deltaScale = 1): void {
  bullet.prevX = bullet.x;
  bullet.prevY = bullet.y;
  bullet.x += bullet.vx * deltaScale;
  bullet.y += bullet.vy * deltaScale;
  wrapWorldPoint(bullet);
}

function drawBullet(
  bullet: Bullet,
  ctx: CanvasRenderingContext2D,
  now = Date.now(),
  cameraX = 0,
  cameraY = 0,
  previousCameraX = 0,
  previousCameraY = 0,
): void {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);

  switch (bullet.type) {
    case 'small': {
      const length = 15;
      ctx.rotate(bullet.angle);
      ctx.beginPath();
      ctx.moveTo(-length / 2, 0);
      ctx.lineTo(length / 2, 0);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'blackHole': {
      const radius = getBlackHoleRenderRadius(bullet, now);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'pusher': {
      const bulletDelta = wrappedDelta(bullet.prevX, bullet.prevY, bullet.x, bullet.y);
      const screenDx = bulletDelta.x - (cameraX - previousCameraX);
      const screenDy = bulletDelta.y - (cameraY - previousCameraY);
      const speed = Math.sqrt(screenDx * screenDx + screenDy * screenDy);
      const normalized = Math.max(0, Math.min(1, (speed - 2) / 13));
      const length = 10 + normalized * 40;
      if (speed > 0.1) {
        ctx.rotate(Math.atan2(screenDy, screenDx) + Math.PI);
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(-length / 2, -2.5, length, 5);
      break;
    }
    case 'shotgun': {
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawFuelExtractorBuilding(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  extractor: FuelExtractor,
): void {
  const frame = getExtractorFrame(planet, extractor);
  ctx.save();
  ctx.translate(frame.buildingX, frame.buildingY);
  ctx.rotate(frame.surfaceAngle + Math.PI / 2);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-12, -frame.buildingHeight, 24, frame.buildingHeight);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(-16, -frame.buildingHeight);
  ctx.lineTo(16, -frame.buildingHeight);
  ctx.lineTo(10, -frame.buildingHeight - 10);
  ctx.lineTo(-10, -frame.buildingHeight - 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
  ctx.beginPath();
  ctx.moveTo(0, -frame.buildingHeight - 8);
  ctx.lineTo(0, -frame.buildingHeight - 24);
  ctx.stroke();

  ctx.restore();
}

function drawInspectedPlanetOverlay(ctx: CanvasRenderingContext2D, planet: Planet): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(planet.x, planet.y, planet.getRadius() * 0.96, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function updateParticleNoWrap(particle: Particle, deltaTime: number, deltaScale = 1): void {
  particle.x += particle.vx * 0.6 * deltaScale;
  particle.y += particle.vy * 0.6 * deltaScale;
  wrapWorldPoint(particle);
  particle.vx *= 1 - 0.02 * deltaScale;
  particle.vy *= 1 - 0.02 * deltaScale;
  particle.rotation += particle.rotationSpeed * deltaScale;
  particle.lifetime -= deltaTime;
  particle.alpha = Math.max(0, particle.lifetime / particle.maxLifetime);
}

function drawParticleNoWrap(particle: Particle, ctx: CanvasRenderingContext2D): void {
  drawOneParticle(particle, ctx);
}

function createBullet(
  player: Player,
  type: WeaponType,
  mode: BulletMode = 'normal',
  now = Date.now(),
): void {
  const config = BULLET_CONFIGS[type];
  const isDegradedSmall = mode === 'degraded' && type === 'small';
  const bulletAngle = player.turretAngle - Math.PI * 0.5;
  for (let i = 0; i < config.bulletCount; i++) {
    const spreadOffset =
      config.bulletCount > 1 ? (i / (config.bulletCount - 1) - 0.5) * config.spreadAngle : 0;
    const speed =
      config.speed * (1 - config.speedVariance + Math.random() * config.speedVariance * 2);
    const angle = bulletAngle + spreadOffset;
    const baseLifetime =
      config.speedVariance > 0 ? config.lifetime * (0.7 + Math.random() * 0.3) : config.lifetime;
    const lifetime = isDegradedSmall ? baseLifetime * 0.5 : baseLifetime;

    bullets.push({
      x: player.x + Math.cos(bulletAngle) * PLAYER_SIZE,
      y: player.y + Math.sin(bulletAngle) * PLAYER_SIZE,
      prevX: player.x + Math.cos(bulletAngle) * PLAYER_SIZE,
      prevY: player.y + Math.sin(bulletAngle) * PLAYER_SIZE,
      vx: player.vx + Math.cos(angle) * speed,
      vy: player.vy + Math.sin(angle) * speed,
      angle,
      lifetime,
      spawnTime: now,
      playerId: player.id,
      damage: isDegradedSmall ? config.damage * 0.5 : config.damage,
      impact: isDegradedSmall ? config.impact * 0.5 : config.impact,
      recoil: config.recoil,
      type,
    });
  }
}

function isProjectileWeapon(type: SelectableWeaponType): type is WeaponType {
  return type !== 'inspectionProbe';
}

function getWeaponTimeout(player: Player, type: WeaponType): number {
  if (type === 'small') return player.timeoutSmall;
  if (type === 'pusher') return player.timeoutPusher;
  if (type === 'shotgun') return player.timeoutShotgun;
  return player.timeoutBlackHole;
}

function setWeaponTimeout(player: Player, type: WeaponType, now: number): void {
  if (type === 'small') {
    player.timeoutSmall = now;
  } else if (type === 'pusher') {
    player.timeoutPusher = now;
  } else if (type === 'shotgun') {
    player.timeoutShotgun = now;
  } else {
    player.timeoutBlackHole = now;
  }
}

function fireProjectileWeapon(player: Player, type: WeaponType, now: number, deltaScale = 1): void {
  if (type === 'tractor' || player.shieldActive) {
    return;
  }

  if (now - getWeaponTimeout(player, type) < BULLET_CONFIGS[type].fireRate) {
    return;
  }

  const mode = getWeaponFireMode(player, type);
  if (mode) {
    setWeaponTimeout(player, type, now);
    createBullet(player, type, mode, now);
    if (type === 'shotgun') {
      createBullet(player, type, mode, now);
    }
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * BULLET_CONFIGS[type].recoil * deltaScale;
    player.vy += Math.sin(recoilAngle) * BULLET_CONFIGS[type].recoil * deltaScale;
  }
}

function updatePlayer(
  player: Player,
  camera: Camera,
  visualPlayerPosition: Point,
  deltaTime: number,
  onProbeFire: () => boolean,
  suppressAssignedSlots = false,
  now = Date.now(),
  deltaScale = 1,
): void {
  const screenPlayerX = visualPlayerPosition.x - camera.x;
  const screenPlayerY = visualPlayerPosition.y - camera.y;
  const input = InputManager.getInputState(player.module, screenPlayerX, screenPlayerY);
  if (player.waitingToRespawn) {
    return;
  }

  player.shieldActive = input.shield.pressed && player.fuel > 0;

  const moveMagnitude = Math.sqrt(
    input.move.value[0] * input.move.value[0] + input.move.value[1] * input.move.value[1],
  );
  const accelerationApplied = moveMagnitude > 0.1;
  const thrustPower = player.fuel > 0 ? 1 : FUELLESS_THRUST_POWER_SCALE;

  if (moveMagnitude > 0.1) {
    player.angle = Math.atan2(input.move.value[1], input.move.value[0]) + Math.PI * 0.5;
  }

  if (accelerationApplied) {
    if (player.fuel > 0) {
      drainFuel(player, FUEL_THRUST_PER_SECOND * (deltaTime / 1000));
    }
    player.vx += input.move.value[0] * PLAYER_ACCELERATION * thrustPower * deltaScale;
    player.vy += input.move.value[1] * PLAYER_ACCELERATION * thrustPower * deltaScale;
  }

  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  if (speed > PLAYER_MAX_SPEED) {
    const scale = PLAYER_MAX_SPEED / speed;
    player.vx *= scale;
    player.vy *= scale;
  }

  if (input.aim.pressed) {
    const aimX = input.aim.value[0];
    const aimY = input.aim.value[1];
    const aimMag = Math.sqrt(aimX * aimX + aimY * aimY);
    if (aimMag > 0) {
      player.turretAngle = Math.atan2(aimY, aimX) + Math.PI * 0.5;
    }
  }

  player.x += player.vx * deltaScale;
  player.y += player.vy * deltaScale;

  player.isThrusting = accelerationApplied;
  if (accelerationApplied) {
    player.thrustDirX = -input.move.value[0] / moveMagnitude;
    player.thrustDirY = -input.move.value[1] / moveMagnitude;
    const thrusterInterval = player.fuel > 0 ? 10 : 30;
    if (now - player.lastThrusterSpawn >= thrusterInterval) {
      player.lastThrusterSpawn = now;
      createThrusterParticle(
        player.x + player.thrustDirX * PLAYER_SIZE,
        player.y + player.thrustDirY * PLAYER_SIZE,
        player.thrustDirX,
        player.thrustDirY,
        thrustPower,
      );
    }
  }

  if (!suppressAssignedSlots && input.fire.pressed) {
    if (player.primaryWeapon === 'inspectionProbe') {
      onProbeFire();
    } else if (isProjectileWeapon(player.primaryWeapon)) {
      fireProjectileWeapon(player, player.primaryWeapon, now, deltaScale);
    }
  }

  if (!suppressAssignedSlots && input.fireSpecial.pressed) {
    if (player.secondaryWeapon === 'inspectionProbe') {
      onProbeFire();
    } else if (isProjectileWeapon(player.secondaryWeapon)) {
      fireProjectileWeapon(player, player.secondaryWeapon, now, deltaScale);
    }
  }

  if (player.invulnerable && now >= player.invulnerableUntil) {
    player.invulnerable = false;
  }
}

function drawSandboxBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): void {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  const offsetX = (((-camera.x + backgroundOffset.x) % GRID_SPACING) + GRID_SPACING) % GRID_SPACING;
  const offsetY = (((-camera.y + backgroundOffset.y) % GRID_SPACING) + GRID_SPACING) % GRID_SPACING;

  for (let x = offsetX; x < viewportWidth; x += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewportHeight);
    ctx.stroke();
  }

  for (let y = offsetY; y < viewportHeight; y += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewportWidth, y);
    ctx.stroke();
  }

  for (const star of stars) {
    const width = viewportWidth + GRID_SPACING * 2;
    const height = viewportHeight + GRID_SPACING * 2;
    let x = star.x - (camera.x + backgroundOffset.x) * star.parallaxLayer;
    let y = star.y - (camera.y + backgroundOffset.y) * star.parallaxLayer;

    x = (((x % width) + width) % width) - GRID_SPACING;
    y = (((y % height) + height) % height) - GRID_SPACING;

    if (x >= 0 && x <= viewportWidth && y >= 0 && y <= viewportHeight) {
      ctx.globalAlpha = STAR_BASE_ALPHA + Math.sin(star.twinklePhase) * STAR_TWINKLE_AMOUNT;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  seenCells: Uint8Array,
  seeingCells: Uint8Array,
): void {
  const minimapX = viewportWidth - MINIMAP_WIDTH - MINIMAP_PADDING;
  const minimapY = MINIMAP_PADDING;
  const scaleX = MINIMAP_WIDTH / SANDBOX_WORLD_WIDTH;
  const scaleY = MINIMAP_HEIGHT / SANDBOX_WORLD_HEIGHT;

  ctx.save();

  ctx.fillStyle = '#000';
  ctx.fillRect(minimapX, minimapY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(minimapX, minimapY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.beginPath();
  ctx.rect(minimapX, minimapY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.clip();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const x = minimapX + (MINIMAP_WIDTH / 4) * i;
    const y = minimapY + (MINIMAP_HEIGHT / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, minimapY);
    ctx.lineTo(x, minimapY + MINIMAP_HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(minimapX, y);
    ctx.lineTo(minimapX + MINIMAP_WIDTH, y);
    ctx.stroke();
  }

  const cellWidth = MINIMAP_WIDTH / MINIMAP_FOG_COLUMNS;
  const cellHeight = MINIMAP_HEIGHT / MINIMAP_FOG_ROWS;
  for (let row = 0; row < MINIMAP_FOG_ROWS; row += 1) {
    for (let col = 0; col < MINIMAP_FOG_COLUMNS; col += 1) {
      const index = row * MINIMAP_FOG_COLUMNS + col;
      if (seenCells[index]) {
        ctx.fillStyle = seeingCells[index] ? 'rgba(8, 20, 36, 0.88)' : 'rgba(8, 14, 25, 0.58)';
        ctx.fillRect(
          minimapX + col * cellWidth,
          minimapY + row * cellHeight,
          cellWidth + 0.5,
          cellHeight + 0.5,
        );
      }
    }
  }

  function isCellVisibleForMinimap(x: number, y: number, requireSeeing: boolean): boolean {
    const col = clamp(
      Math.floor((x / SANDBOX_WORLD_WIDTH) * MINIMAP_FOG_COLUMNS),
      0,
      MINIMAP_FOG_COLUMNS - 1,
    );
    const row = clamp(
      Math.floor((y / SANDBOX_WORLD_HEIGHT) * MINIMAP_FOG_ROWS),
      0,
      MINIMAP_FOG_ROWS - 1,
    );
    const index = row * MINIMAP_FOG_COLUMNS + col;
    return requireSeeing ? seeingCells[index] === 1 : seenCells[index] === 1;
  }

  for (const planet of planets) {
    if (isCellVisibleForMinimap(planet.x, planet.y, false)) {
      const x = minimapX + planet.x * scaleX;
      const y = minimapY + planet.y * scaleY;
      const radius = Math.max(3, planet.getRadius() * scaleX);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = planet.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  for (const asteroid of asteroids) {
    if (isCellVisibleForMinimap(asteroid.x, asteroid.y, true)) {
      const x = minimapX + asteroid.x * scaleX;
      const y = minimapY + asteroid.y * scaleY;
      const radius = Math.max(1.5, Math.min(4.5, asteroid.getRadius() * scaleX * 0.6));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = asteroid.color;
      ctx.fill();
    }
  }

  const viewportBoxX = positiveModulo(camera.x, SANDBOX_WORLD_WIDTH) * scaleX;
  const viewportBoxY = positiveModulo(camera.y, SANDBOX_WORLD_HEIGHT) * scaleY;
  const viewportBoxWidth = Math.min(MINIMAP_WIDTH, viewportWidth * scaleX);
  const viewportBoxHeight = Math.min(MINIMAP_HEIGHT, viewportHeight * scaleY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  for (const offsetX of [0, -MINIMAP_WIDTH]) {
    for (const offsetY of [0, -MINIMAP_HEIGHT]) {
      const x = minimapX + viewportBoxX + offsetX;
      const y = minimapY + viewportBoxY + offsetY;
      const visible =
        x < minimapX + MINIMAP_WIDTH &&
        x + viewportBoxWidth > minimapX &&
        y < minimapY + MINIMAP_HEIGHT &&
        y + viewportBoxHeight > minimapY;
      if (visible) {
        ctx.strokeRect(x, y, viewportBoxWidth, viewportBoxHeight);
      }
    }
  }

  if (player) {
    const playerX = minimapX + player.x * scaleX;
    const playerY = minimapY + player.y * scaleY;
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    const angle = speed > 0.05 ? Math.atan2(player.vy, player.vx) : player.angle - Math.PI * 0.5;
    const size = 6;

    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.6);
    ctx.lineTo(-size * 0.7, size * 0.6);
    ctx.closePath();
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export class SandboxScene implements Scene {
  private canvas: HTMLCanvasElement | null = null;
  private camera: Camera = { x: 0, y: 0 };
  private previousCamera: Camera = { x: 0, y: 0 };
  private visualPlayerPosition: Point = { x: 0, y: 0 };
  private simulationTime = Date.now();
  private droppedFuelBlobs: DroppedFuelBlob[] = [];
  private inspectionProbes: InspectionProbe[] = [];
  private readonly seenMinimapCells = new Uint8Array(MINIMAP_FOG_COLUMNS * MINIMAP_FOG_ROWS);
  private readonly seeingMinimapCells = new Uint8Array(MINIMAP_FOG_COLUMNS * MINIMAP_FOG_ROWS);

  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  resize(): void {
    if (gameState.gameSize && this.canvas) {
      disposeBlackHoleShader();
      initShader(this.canvas);
      resizeFuelMetaballs(gameState.gameSize.width, gameState.gameSize.height);
    }
  }

  private updateCamera(): void {
    const currentPlayer = player;
    const viewportWidth = getGameWidth();
    const viewportHeight = getGameHeight();

    if (!currentPlayer) {
      return;
    }

    this.previousCamera.x = this.camera.x;
    this.previousCamera.y = this.camera.y;

    this.camera.x = this.visualPlayerPosition.x - viewportWidth / 2;
    this.camera.y = this.visualPlayerPosition.y - viewportHeight / 2;
  }

  private rebaseVisualCoordinates(): void {
    const offsetX = getWorldRebaseOffset(this.visualPlayerPosition.x, SANDBOX_WORLD_WIDTH);
    const offsetY = getWorldRebaseOffset(this.visualPlayerPosition.y, SANDBOX_WORLD_HEIGHT);
    if (offsetX !== 0 || offsetY !== 0) {
      this.visualPlayerPosition.x -= offsetX;
      this.visualPlayerPosition.y -= offsetY;
      this.camera.x -= offsetX;
      this.camera.y -= offsetY;
      this.previousCamera.x -= offsetX;
      this.previousCamera.y -= offsetY;
    }
  }

  private populateWorld(): void {
    planets.length = 0;
    asteroids.length = 0;

    for (let i = 0; i < SANDBOX_PLANET_COUNT; i++) {
      let x =
        SANDBOX_PLANET_MARGIN + Math.random() * (SANDBOX_WORLD_WIDTH - SANDBOX_PLANET_MARGIN * 2);
      let y =
        SANDBOX_PLANET_MARGIN + Math.random() * (SANDBOX_WORLD_HEIGHT - SANDBOX_PLANET_MARGIN * 2);

      for (let attempt = 0; attempt < 30; attempt++) {
        const tooClose = planets.some(
          (planet) => wrappedDistance(planet.x, planet.y, x, y) < planet.getRadius() * 4,
        );
        if (!tooClose) {
          break;
        }
        x =
          SANDBOX_PLANET_MARGIN + Math.random() * (SANDBOX_WORLD_WIDTH - SANDBOX_PLANET_MARGIN * 2);
        y =
          SANDBOX_PLANET_MARGIN +
          Math.random() * (SANDBOX_WORLD_HEIGHT - SANDBOX_PLANET_MARGIN * 2);
      }

      planets.push(createPlanet(x, y));
    }

    this.populateInitialAsteroids();
  }

  private placePlayerSafely(currentPlayer: Player): void {
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = SANDBOX_WORLD_WIDTH / 2 + (Math.random() - 0.5) * SANDBOX_SPAWN_MARGIN;
      const y = SANDBOX_WORLD_HEIGHT / 2 + (Math.random() - 0.5) * SANDBOX_SPAWN_MARGIN;
      const tooClose = planets.some(
        (planet) => wrappedDistance(planet.x, planet.y, x, y) < planet.getRadius() * 3,
      );

      if (!tooClose) {
        currentPlayer.x = clamp(x, PLAYER_SIZE, SANDBOX_WORLD_WIDTH - PLAYER_SIZE);
        currentPlayer.y = clamp(y, PLAYER_SIZE, SANDBOX_WORLD_HEIGHT - PLAYER_SIZE);
        return;
      }
    }

    currentPlayer.x = SANDBOX_WORLD_WIDTH / 2;
    currentPlayer.y = SANDBOX_WORLD_HEIGHT / 2;
  }

  private chooseSandboxSpawnSize(): Asteroid['size'] {
    const roll = Math.random();
    if (roll < 0.22) return 'mega';
    if (roll < 0.62) return 'big';
    if (roll < 0.88) return 'medium';
    return 'small';
  }

  private populateInitialAsteroids(): void {
    for (let i = 0; i < SANDBOX_INITIAL_ASTEROIDS; i += 1) {
      const asteroid = createSandboxAsteroid(this.chooseSandboxSpawnSize());
      asteroid.vx *= SANDBOX_INITIAL_ASTEROID_SPEED_SCALE;
      asteroid.vy *= SANDBOX_INITIAL_ASTEROID_SPEED_SCALE;
      asteroid.rotationSpeed *= SANDBOX_INITIAL_ASTEROID_SPEED_SCALE;
      asteroids.push(asteroid);
    }
  }

  private updateMinimapFog(currentPlayer: Player): void {
    this.seeingMinimapCells.fill(0);
    for (let row = 0; row < MINIMAP_FOG_ROWS; row += 1) {
      for (let col = 0; col < MINIMAP_FOG_COLUMNS; col += 1) {
        const worldX = ((col + 0.5) / MINIMAP_FOG_COLUMNS) * SANDBOX_WORLD_WIDTH;
        const worldY = ((row + 0.5) / MINIMAP_FOG_ROWS) * SANDBOX_WORLD_HEIGHT;
        if (
          wrappedDistance(currentPlayer.x, currentPlayer.y, worldX, worldY) <= MINIMAP_SEE_RADIUS
        ) {
          const index = row * MINIMAP_FOG_COLUMNS + col;
          this.seeingMinimapCells[index] = 1;
          this.seenMinimapCells[index] = 1;
        }
      }
    }
  }

  private spawnAsteroidFuelDrops(asteroid: Asteroid, now: number): void {
    if (asteroid.size !== 'big' && asteroid.size !== 'mega') {
      return;
    }

    if (Math.random() > ASTEROID_FUEL_DROP_CHANCES[asteroid.size]) {
      return;
    }

    const maxBlobs = ASTEROID_FUEL_DROP_MAX_BLOBS[asteroid.size];
    const count = 1 + Math.floor(Math.random() * maxBlobs);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const scatter = 12 + Math.random() * 38;
      this.droppedFuelBlobs.push({
        id: `drop-${now}-${asteroid.x}-${asteroid.y}-${i}`,
        x: asteroid.x + Math.cos(angle) * scatter,
        y: asteroid.y + Math.sin(angle) * scatter,
        vx: Math.cos(angle) * 0.35 + asteroid.vx * 0.12,
        vy: Math.sin(angle) * 0.35 + asteroid.vy * 0.12,
        wobbleSeed: Math.random(),
      });
    }
  }

  private spawnFuelBurst(
    x: number,
    y: number,
    count: number,
    now: number,
    baseVx = 0,
    baseVy = 0,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const scatter = 8 + Math.random() * 28;
      const speed = 0.35 + Math.random() * 0.75;
      this.droppedFuelBlobs.push({
        id: `black-hole-fuel-${now}-${Math.round(x)}-${Math.round(y)}-${i}`,
        x: x + Math.cos(angle) * scatter,
        y: y + Math.sin(angle) * scatter,
        vx: baseVx * 0.08 + Math.cos(angle) * speed,
        vy: baseVy * 0.08 + Math.sin(angle) * speed,
        wobbleSeed: Math.random(),
      });
    }
  }

  private updatePlanetFuel(deltaTime: number, now: number, currentPlayer: Player): void {
    for (const planet of planets) {
      planet.rotation += planet.rotationSpeed * deltaTime;

      for (const extractor of planet.fuelExtractors) {
        if (now >= extractor.nextExtractAt) {
          extractor.nextExtractAt = now + extractor.extractIntervalMs;
          if (
            planet.fuelReserve >= FUEL_BLOB_AMOUNT &&
            extractor.blobs.length < extractor.maxBlobs
          ) {
            planet.fuelReserve -= FUEL_BLOB_AMOUNT;
            extractor.blobs.push(makeFuelBlob(`${extractor.id}-blob-${now}`));
          }
        }

        if (currentPlayer.fuel < currentPlayer.maxFuel) {
          for (let i = extractor.blobs.length - 1; i >= 0; i--) {
            const position = getExtractorBlobWorldPosition(
              planet,
              extractor,
              extractor.blobs[i],
              now,
            );
            if (
              wrappedDistance(currentPlayer.x, currentPlayer.y, position.x, position.y) <=
              currentPlayer.getRadius() + FUEL_BLOB_RADIUS
            ) {
              addFuel(currentPlayer, FUEL_BLOB_AMOUNT);
              extractor.blobs.splice(i, 1);
            }
          }
        }
      }
    }
  }

  private updateDroppedFuelBlobs(currentPlayer: Player): void {
    const remainingBlobs: DroppedFuelBlob[] = [];

    for (const blob of this.droppedFuelBlobs) {
      this.pullDroppedFuelTowardPlayer(blob, currentPlayer);
      this.moveDroppedFuelBlob(blob);

      const resolution = this.resolveDroppedFuelBlob(blob, currentPlayer);
      if (resolution === 'keep') {
        remainingBlobs.push(blob);
      }
    }

    this.droppedFuelBlobs = remainingBlobs;
  }

  private pullDroppedFuelTowardPlayer(blob: DroppedFuelBlob, currentPlayer: Player): void {
    if (currentPlayer.waitingToRespawn || currentPlayer.fuel >= currentPlayer.maxFuel) {
      return;
    }

    const { x: dx, y: dy } = wrappedDelta(blob.x, blob.y, currentPlayer.x, currentPlayer.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 0 || dist >= FUEL_BLOB_ATTRACTION_RADIUS) {
      return;
    }

    const pull = 1 - dist / FUEL_BLOB_ATTRACTION_RADIUS;
    blob.vx += (dx / dist) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull);
    blob.vy += (dy / dist) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull);
  }

  private moveDroppedFuelBlob(blob: DroppedFuelBlob): void {
    blob.vx *= FUEL_BLOB_DRAG;
    blob.vy *= FUEL_BLOB_DRAG;

    const speed = Math.sqrt(blob.vx * blob.vx + blob.vy * blob.vy);
    if (speed > FUEL_BLOB_MAX_SPEED) {
      const speedScale = FUEL_BLOB_MAX_SPEED / speed;
      blob.vx *= speedScale;
      blob.vy *= speedScale;
    }

    blob.x += blob.vx;
    blob.y += blob.vy;
    wrapWorldPoint(blob);
  }

  private resolveDroppedFuelBlob(blob: DroppedFuelBlob, currentPlayer: Player): 'keep' | 'remove' {
    const absorbingPlanet = planets.find(
      (planet) =>
        wrappedDistance(blob.x, blob.y, planet.x, planet.y) <=
        planet.getRadius() + FUEL_BLOB_RADIUS,
    );
    if (absorbingPlanet) {
      absorbingPlanet.fuelReserve += FUEL_BLOB_AMOUNT;
      return 'remove';
    }

    if (this.collectDroppedFuelBlob(blob, currentPlayer)) {
      return 'remove';
    }

    return 'keep';
  }

  private collectDroppedFuelBlob(blob: DroppedFuelBlob, currentPlayer: Player): boolean {
    if (currentPlayer.fuel >= currentPlayer.maxFuel) {
      return false;
    }

    const collectionDistance = currentPlayer.getRadius() + FUEL_BLOB_RADIUS;
    if (wrappedDistance(currentPlayer.x, currentPlayer.y, blob.x, blob.y) > collectionDistance) {
      return false;
    }

    addFuel(currentPlayer, FUEL_BLOB_AMOUNT);
    return true;
  }

  private updateInspectionProbes(now: number, deltaScale = 1): void {
    updateInspectionProbes(this.inspectionProbes, now, {
      deltaScale,
      wrapProbe: wrapWorldPoint,
      handleProbe: (probe) => {
        const hitPlanet = planets.find(
          (planet) =>
            wrappedDistance(probe.x, probe.y, planet.x, planet.y) <=
            planet.getRadius() + INSPECTION_PROBE_RADIUS,
        );
        if (hitPlanet) {
          hitPlanet.inspectedUntil = now + INSPECTION_PROBE_DURATION_MS;
          return true;
        }

        return false;
      },
    });
  }

  private collectFuelMetaballs(now: number): FuelMetaball[] {
    const metaballs: FuelMetaball[] = [];
    const viewportWidth = getGameWidth();
    const viewportHeight = getGameHeight();
    const isScreenMetaballVisible = (x: number, y: number, radius: number): boolean =>
      x + radius >= 0 &&
      x - radius <= viewportWidth &&
      y + radius >= 0 &&
      y - radius <= viewportHeight;
    const pushWrappedMetaball = (x: number, y: number, radius: number, seed: number): void => {
      for (const position of getWrappedDrawPositions(
        x,
        y,
        radius * 3,
        this.camera,
        viewportWidth,
        viewportHeight,
      )) {
        const screenX = position.x - this.camera.x;
        const screenY = position.y - this.camera.y;
        if (isScreenMetaballVisible(screenX, screenY, radius * 3)) {
          metaballs.push({
            x: screenX,
            y: screenY,
            radius,
            seed,
          });
        }
      }
    };

    for (const planet of planets) {
      for (const extractor of planet.fuelExtractors) {
        for (const blob of extractor.blobs) {
          const position = getExtractorBlobWorldPosition(planet, extractor, blob, now);
          pushWrappedMetaball(position.x, position.y, FUEL_BLOB_RADIUS, blob.wobbleSeed);
        }
      }

      if (
        now < planet.inspectedUntil &&
        getWrappedDrawPositions(
          planet.x,
          planet.y,
          planet.getRadius(),
          this.camera,
          viewportWidth,
          viewportHeight,
        ).length > 0
      ) {
        const reserveBlobCount = Math.ceil(planet.fuelReserve / FUEL_INSPECTION_BLOB_AMOUNT);
        const internalBlobCount = Math.min(
          MAX_INTERNAL_FUEL_METABALLS_PER_PLANET,
          reserveBlobCount,
        );
        const reserveScale = Math.min(1, reserveBlobCount / MAX_INTERNAL_FUEL_METABALLS_PER_PLANET);
        for (let i = 0; i < internalBlobCount; i++) {
          const seed = (i + 1) * 12.9898 + planet.x * 0.001 + planet.y * 0.002;
          const orbit = now * 0.00035 * Math.max(0.25, reserveScale * 3.5) + seed;
          const metaballRadius = 10 + reserveScale * 12;
          const maxCenterDistance = Math.max(0, planet.getRadius() - metaballRadius * 2.2);
          const targetDistance = planet.getRadius() * (0.12 + ((i * 37) % 58) / 100);
          const centerDistance = Math.min(targetDistance, maxCenterDistance);
          const driftX = Math.cos(orbit) * centerDistance;
          const driftY = Math.sin(orbit * 1.17) * centerDistance;
          const driftLength = Math.hypot(driftX, driftY);
          const driftScale = driftLength > maxCenterDistance ? maxCenterDistance / driftLength : 1;
          pushWrappedMetaball(
            planet.x + driftX * driftScale,
            planet.y + driftY * driftScale,
            metaballRadius,
            seed,
          );
        }
      }
    }

    for (const blob of this.droppedFuelBlobs) {
      const wobble = Math.sin(now * 0.004 + blob.wobbleSeed * Math.PI * 2) * 3;
      pushWrappedMetaball(blob.x, blob.y + wobble, FUEL_BLOB_RADIUS, blob.wobbleSeed);
    }

    return metaballs;
  }

  private killPlayer(currentPlayer: Player, now: number, explosionIntensity: number): void {
    if (currentPlayer.waitingToRespawn) {
      return;
    }

    currentPlayer.waitingToRespawn = true;
    currentPlayer.respawnTime = now + RESPAWN_DELAY;
    const debrisVx = currentPlayer.vx;
    const debrisVy = currentPlayer.vy;
    currentPlayer.vx = 0;
    currentPlayer.vy = 0;
    currentPlayer.isThrusting = false;
    rumbleDeath(currentPlayer.module);
    createShipDebris(
      currentPlayer.x,
      currentPlayer.y,
      explosionIntensity,
      debrisVx,
      debrisVy,
      currentPlayer.color,
    );
    createExplosionBurst(
      currentPlayer.x,
      currentPlayer.y,
      explosionIntensity,
      currentPlayer.vx,
      currentPlayer.vy,
    );
  }

  enter(): void {
    resetState();
    gameState.restartScene = 'sandbox';
    this.droppedFuelBlobs = [];
    this.inspectionProbes = [];
    this.seenMinimapCells.fill(0);
    this.seeingMinimapCells.fill(0);
    this.populateWorld();

    if (!player) {
      const padId = joymap.getUnusedPadIds()[0] ?? 'keyboard';
      const createdPlayer = createPlayer(padId);
      setPlayer(createdPlayer);
      joymap.addModule(createdPlayer.module);
    }

    const currentPlayer = player;
    if (!currentPlayer) {
      return;
    }

    currentPlayer.shieldHits = 1;
    currentPlayer.shieldActive = false;
    applySavedWeaponSlots(currentPlayer);
    refillRespawnResources(currentPlayer);
    currentPlayer.waitingToRespawn = false;
    currentPlayer.angle = 0;
    currentPlayer.turretAngle = 0;
    currentPlayer.vx = 0;
    currentPlayer.vy = 0;
    currentPlayer.invulnerable = true;
    this.simulationTime = Date.now();
    currentPlayer.invulnerableUntil = this.simulationTime + 3000;
    currentPlayer.respawnTime = 0;
    this.placePlayerSafely(currentPlayer);
    this.visualPlayerPosition = { x: currentPlayer.x, y: currentPlayer.y };
    this.updateCamera();
    this.previousCamera.x = this.camera.x;
    this.previousCamera.y = this.camera.y;
    this.rebaseVisualCoordinates();
    this.updateMinimapFog(currentPlayer);

    if (this.canvas) {
      initShader(this.canvas);
      initFuelMetaballs();
    }
  }

  update(deltaTime: number): void {
    const currentPlayer = player;
    if (!gameState.baseAlphaMask || !currentPlayer) {
      return;
    }

    this.updateCamera();
    const screenPlayerX = this.visualPlayerPosition.x - this.camera.x;
    const screenPlayerY = this.visualPlayerPosition.y - this.camera.y;
    const timeStep = getPlayerTimeDilationStep(
      currentPlayer,
      screenPlayerX,
      screenPlayerY,
      deltaTime,
      this.simulationTime,
    );
    this.simulationTime = timeStep.now;
    const now = timeStep.now;
    const realNow = Date.now();
    const scaledDeltaTime = timeStep.scaledDeltaTime;
    const deltaScale = timeStep.deltaScale;

    updateBackground(scaledDeltaTime, now, deltaScale);

    if (screenShake.intensity > 0) {
      const elapsed = realNow - screenShake.startTime;
      if (elapsed >= screenShake.duration) {
        screenShake.intensity = 0;
      }
    }

    this.updatePlanetFuel(scaledDeltaTime, now, currentPlayer);
    this.updateDroppedFuelBlobs(currentPlayer);
    this.updateInspectionProbes(now, deltaScale);
    this.updateMinimapFog(currentPlayer);

    for (const planet of planets) {
      if (!currentPlayer.waitingToRespawn) {
        applyGravity(currentPlayer, planet, deltaScale);
      }
      for (const asteroid of asteroids) {
        applyGravity(asteroid, planet, deltaScale);
      }
      for (const bullet of bullets) {
        if (bullet.type !== 'blackHole') {
          applyGravity(bullet, planet, deltaScale);
        }
      }
      for (const blob of this.droppedFuelBlobs) {
        applyGravity(blob, planet, deltaScale);
      }
    }

    processPlanetPlayer: for (const planet of planets) {
      if (currentPlayer.invulnerable || currentPlayer.waitingToRespawn) {
        break;
      }
      if (
        wrappedDistance(currentPlayer.x, currentPlayer.y, planet.x, planet.y) <
        currentPlayer.getRadius() + planet.getRadius()
      ) {
        this.killPlayer(currentPlayer, now, 1);
        break processPlanetPlayer;
      }
    }

    const destroyedAsteroids = new Set<number>();
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      for (const planet of planets) {
        if (
          wrappedDistance(asteroid.x, asteroid.y, planet.x, planet.y) <
          asteroid.getRadius() + planet.getRadius()
        ) {
          destroyedAsteroids.add(i);
          break;
        }
      }
    }
    for (let i = asteroids.length - 1; i >= 0; i--) {
      if (destroyedAsteroids.has(i)) {
        const asteroid = asteroids[i];
        const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
        createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
        this.spawnAsteroidFuelDrops(asteroid, now);
        asteroids.splice(i, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (
        bullet.type !== 'blackHole' &&
        planets.some(
          (planet) =>
            wrappedDistance(bullet.x, bullet.y, planet.x, planet.y) <
            planet.getRadius() + BULLET_RADIUS,
        )
      ) {
        bullets.splice(i, 1);
      }
    }

    const handledBullets = new Set<number>();
    const destroyedAsteroidsFromBullets = new Set<Asteroid>();
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const asteroid = asteroids[j];
        if (
          bullet.type !== 'blackHole' &&
          !destroyedAsteroidsFromBullets.has(asteroid) &&
          circleIntersectsWrappedRotatedMask(bullet.x, bullet.y, BULLET_RADIUS, asteroid)
        ) {
          handledBullets.add(i);
          const massMultiplier =
            asteroid.size === 'big' ? 0.3 : asteroid.size === 'medium' ? 0.6 : 1.0;
          const impulse = bullet.impact * 2 * massMultiplier;
          asteroid.vx += bullet.vx * 0.1 * impulse;
          asteroid.vy += bullet.vy * 0.1 * impulse;
          asteroid.hits -= bullet.damage;

          if (asteroid.hits <= 0) {
            const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
            createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
            this.spawnAsteroidFuelDrops(asteroid, now);
            asteroids.push(...splitAsteroid(asteroid));
            destroyedAsteroidsFromBullets.add(asteroid);
            const asteroidIndex = asteroids.indexOf(asteroid);
            if (asteroidIndex !== -1) {
              asteroids.splice(asteroidIndex, 1);
            }
          }
          break;
        }
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (handledBullets.has(i)) {
        bullets.splice(i, 1);
      }
    }

    const previousPlayerPosition = { x: currentPlayer.x, y: currentPlayer.y };
    updatePlayer(
      currentPlayer,
      this.camera,
      this.visualPlayerPosition,
      scaledDeltaTime,
      () => fireInspectionProbe(currentPlayer, this.inspectionProbes, now),
      timeStep.input.timeDilation.pressed,
      now,
      deltaScale,
    );
    wrapWorldPoint(currentPlayer);
    const playerMoveDelta = wrappedDelta(
      previousPlayerPosition.x,
      previousPlayerPosition.y,
      currentPlayer.x,
      currentPlayer.y,
    );
    this.visualPlayerPosition.x += playerMoveDelta.x;
    this.visualPlayerPosition.y += playerMoveDelta.y;

    updateBlackHoleLifecycles({
      now,
      deltaScale,
      planets,
      getDelta: wrappedDelta,
      distance: wrappedDistance,
      onAsteroidAbsorbed: (asteroid) => {
        const intensity = asteroid.size === 'big' ? 1.2 : asteroid.size === 'medium' ? 0.8 : 0.45;
        createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
      },
      onFuelBurst: (x, y, count, burstNow, baseVx, baseVy) =>
        this.spawnFuelBurst(x, y, count, burstNow, baseVx, baseVy),
      createExplosionBurst,
    });
    for (const asteroid of asteroids) {
      updateAsteroid(asteroid, deltaScale);
    }
    applyTractorBeamToTargets(currentPlayer, timeStep.input, asteroids, deltaScale);
    resolveWrappedAsteroidCollisions();

    if (!currentPlayer.invulnerable && !currentPlayer.waitingToRespawn) {
      for (const asteroid of asteroids) {
        const asteroidRadius = asteroid.getRadius();
        const shieldCollisionDist = SHIELD_RADIUS + asteroidRadius;
        const actualDist = wrappedDistance(
          currentPlayer.x,
          currentPlayer.y,
          asteroid.x,
          asteroid.y,
        );
        const bodyHit = circleIntersectsWrappedRotatedMask(
          currentPlayer.x,
          currentPlayer.y,
          currentPlayer.getRadius(),
          asteroid,
        );

        const shieldCanAbsorb =
          currentPlayer.shieldActive &&
          currentPlayer.fuel > 0 &&
          actualDist < shieldCollisionDist &&
            now >= currentPlayer.shieldHitUntil;

        if (shieldCanAbsorb) {
          currentPlayer.shieldHitUntil = now + SHIELD_HIT_COOLDOWN;
          drainFuel(currentPlayer, SHIELD_COLLISION_FUEL_COSTS[asteroid.size]);

          const safeDist = actualDist || 1;
          const bounceDelta = wrappedDelta(asteroid.x, asteroid.y, currentPlayer.x, currentPlayer.y);
          const nx = bounceDelta.x / safeDist;
          const ny = bounceDelta.y / safeDist;
          const bounceForce = 8;
          const shipInfluence = asteroid.mass / (1 + asteroid.mass);
          asteroid.vx -= nx * bounceForce * (1 - shipInfluence);
          asteroid.vy -= ny * bounceForce * (1 - shipInfluence);
          currentPlayer.vx += nx * bounceForce * shipInfluence;
          currentPlayer.vy += ny * bounceForce * shipInfluence;
          asteroid.x -= nx * (shieldCollisionDist - actualDist);
          asteroid.y -= ny * (shieldCollisionDist - actualDist);
          wrapWorldPoint(asteroid);
          if (currentPlayer.fuel <= 0) {
            currentPlayer.shieldActive = false;
          }
        } else if (!currentPlayer.shieldActive && bodyHit) {
          const massMultiplier =
            asteroid.size === 'mega'
              ? 0.1
              : asteroid.size === 'big'
                ? 0.2
                : asteroid.size === 'medium'
                  ? 0.5
                  : 1;
          asteroid.vx += currentPlayer.vx * massMultiplier;
          asteroid.vy += currentPlayer.vy * massMultiplier;
          asteroid.hits -= 10;
          this.killPlayer(currentPlayer, now, 2);
          break;
        }
      }
    }

    if (currentPlayer.waitingToRespawn && now >= currentPlayer.respawnTime) {
      currentPlayer.invulnerable = true;
      currentPlayer.invulnerableUntil = now + INVULNERABLE_RESPAWN;
      currentPlayer.vx = 0;
      currentPlayer.vy = 0;
      currentPlayer.shieldHits = 1;
      refillRespawnResources(currentPlayer);
      incrementRespawnCount(currentPlayer);
      currentPlayer.waitingToRespawn = false;
      this.placePlayerSafely(currentPlayer);
      this.visualPlayerPosition = { x: currentPlayer.x, y: currentPlayer.y };
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      if (asteroid.hits <= 0) {
        createExplosion(
          asteroid.x,
          asteroid.y,
          asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5,
          asteroid.vx,
          asteroid.vy,
        );
        this.spawnAsteroidFuelDrops(asteroid, now);
        asteroids.push(...splitAsteroid(asteroid));
        asteroids.splice(i, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      updateBullet(bullets[i], deltaScale);
      if (bullets[i].type !== 'blackHole' && now - bullets[i].spawnTime >= bullets[i].lifetime) {
        bullets.splice(i, 1);
      }
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      updateThrusterParticle(thrusterParticles[i], scaledDeltaTime, deltaScale);
      wrapWorldPoint(thrusterParticles[i]);
      if (thrusterParticles[i].lifetime <= 0) {
        thrusterParticles.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      updateParticleNoWrap(particles[i], scaledDeltaTime, deltaScale);
      if (particles[i].lifetime <= 0) {
        particles.splice(i, 1);
      }
    }

    this.updateCamera();
    this.rebaseVisualCoordinates();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const realNow = Date.now();
    const now = this.simulationTime;
    const viewportWidth = getGameWidth();
    const viewportHeight = getGameHeight();

    let shakeX = 0;
    let shakeY = 0;
    if (screenShake.intensity > 0) {
      const elapsed = realNow - screenShake.startTime;
      if (elapsed < screenShake.duration) {
        const decay = 1 - elapsed / screenShake.duration;
        shakeX = (Math.random() - 0.5) * screenShake.intensity * decay;
        shakeY = (Math.random() - 0.5) * screenShake.intensity * decay;
      }
    }

    drawSandboxBackground(ctx, this.camera, viewportWidth, viewportHeight);

    ctx.save();
    ctx.translate(shakeX - this.camera.x, shakeY - this.camera.y);

    for (const planet of planets) {
      withWrappedDrawPositions(
        ctx,
        planet.x,
        planet.y,
        planet.getRadius() * 1.35,
        this.camera,
        viewportWidth,
        viewportHeight,
        () => {
          drawPlanet(planet, ctx);
          if (now < planet.inspectedUntil) {
            drawInspectedPlanetOverlay(ctx, planet);
          }
          for (const extractor of planet.fuelExtractors) {
            drawFuelExtractorBuilding(ctx, planet, extractor);
          }
        },
      );
    }

    for (const bullet of bullets) {
      withWrappedDrawPositions(
        ctx,
        bullet.x,
        bullet.y,
        BULLET_RADIUS,
        this.camera,
        viewportWidth,
        viewportHeight,
        () => {
          drawBullet(
            bullet,
            ctx,
            now,
            this.camera.x,
            this.camera.y,
            this.previousCamera.x,
            this.previousCamera.y,
          );
        },
      );
    }

    for (const probe of this.inspectionProbes) {
      withWrappedDrawPositions(
        ctx,
        probe.x,
        probe.y,
        INSPECTION_PROBE_RADIUS,
        this.camera,
        viewportWidth,
        viewportHeight,
        () => {
          drawInspectionProbe(probe, ctx);
        },
      );
    }

    for (const asteroid of asteroids) {
      withWrappedDrawPositions(
        ctx,
        asteroid.x,
        asteroid.y,
        asteroid.getRadius(),
        this.camera,
        viewportWidth,
        viewportHeight,
        () => {
          drawAsteroid(asteroid, ctx);
        },
      );
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      withWrappedDrawPositions(
        ctx,
        thrusterParticles[i].x,
        thrusterParticles[i].y,
        12,
        this.camera,
        viewportWidth,
        viewportHeight,
        () => {
          drawThrusterParticle(thrusterParticles[i], ctx);
        },
      );
    }

    if (player && !player.waitingToRespawn) {
      drawPlayerTrajectoryPreview(ctx, player, this.visualPlayerPosition);
      const visualPlayer = {
        ...player,
        x: this.visualPlayerPosition.x,
        y: this.visualPlayerPosition.y,
      };
      const input = InputManager.getInputState(
        player.module,
        this.visualPlayerPosition.x - this.camera.x,
        this.visualPlayerPosition.y - this.camera.y,
      );
      drawTractorBeam(ctx, visualPlayer, input);
      drawOnePlayer(
        visualPlayer,
        ctx,
      );
      drawWeaponSelectionMenuIfOpen(ctx, player, input, this.visualPlayerPosition);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      withWrappedDrawPositions(
        ctx,
        particles[i].x,
        particles[i].y,
        16,
        this.camera,
        viewportWidth,
        viewportHeight,
        () => {
          drawParticleNoWrap(particles[i], ctx);
        },
      );
    }

    ctx.restore();

    renderFuelMetaballs(ctx, this.collectFuelMetaballs(now), now);

    drawMinimap(
      ctx,
      this.camera,
      viewportWidth,
      viewportHeight,
      this.seenMinimapCells,
      this.seeingMinimapCells,
    );

    if (this.canvas) {
      updateBlackHoles(
        bullets
          .filter((bullet) => bullet.type === 'blackHole')
          .flatMap((bullet) =>
            getWrappedDrawPositions(
              bullet.x,
              bullet.y,
              getBlackHoleRenderRadius(bullet, now),
              this.camera,
              viewportWidth,
              viewportHeight,
            ).map((position) => ({
              x: position.x - this.camera.x,
              y: position.y - this.camera.y,
              radius: getBlackHoleRenderRadius(bullet, now),
            })),
          ),
      );
      renderWithShaders(this.canvas);
    }
  }

  exit(): void {
    disposeFuelMetaballs();
    disposeBlackHoleShader();
  }
}
