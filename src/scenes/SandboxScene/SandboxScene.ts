import { getAsteroidMask, getRandomAsteroidColor } from '@/assets';
import {
  ASTEROID_CONFIGS,
  ASTEROID_FUEL_BLOB_LIFETIME_MS,
  ASTEROID_FUEL_DROP_CHANCES,
  ASTEROID_FUEL_DROP_MAX_BLOBS,
  BULLET_CONFIGS,
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_RADIUS,
  FUEL_INSPECTION_BLOB_AMOUNT,
  FUEL_THRUST_PER_SECOND,
  GRID_COLOR,
  GRID_SPACING,
  INSPECTION_PROBE_DURATION_MS,
  INSPECTION_PROBE_LIFETIME_MS,
  INSPECTION_PROBE_RADIUS,
  INSPECTION_PROBE_SPEED,
  PLANET_CONFIG,
  PLAYER_ACCELERATION,
  PLAYER_MAX_SPEED,
  PLAYER_SIZE,
  SHIELD_COLLISION_FUEL_COSTS,
  SHIELD_COLOR,
  SHIELD_HIT_COOLDOWN,
  SHIELD_MAX_HITS,
  SHIELD_RADIUS,
  STAR_BASE_ALPHA,
  STAR_TWINKLE_AMOUNT,
  STARTING_LIVES,
  type Asteroid,
  type Bullet,
  type FuelBlob,
  type FuelExtractor,
  type Particle,
  type Planet,
  type Player,
} from '@/constants';
import { InputManager } from '@/input';
import { joymap } from '@/joymap';
import {
  drainFuel,
  getWeaponFireMode,
  refillRespawnResources,
  type BulletMode,
  type WeaponType,
} from '@/playerFuel';
import { sceneManager } from '@/sceneManager';
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
  stars,
  thrusterParticles,
} from '@/state';
import { updateBackground } from '../GameScene/background';
import {
  createExplosion,
  createExplosionBurst,
  createShipDebris,
  createThrusterParticle,
  drawOneParticle,
  drawThrusterParticle,
  updateThrusterParticle,
} from '../GameScene/particle';
import { createPlayer, drawFuelContour } from '../GameScene/player';
import { rumbleDeath } from '../GameScene/rumble';
import {
  dispose as disposeBlackHoleShader,
  initShader,
  renderWithShaders,
  updateBlackHoles,
} from '../GameScene/shader';
import type { Scene } from '../scene';
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
const SANDBOX_PLANET_MARGIN = PLANET_CONFIG.radius * 2;
const SANDBOX_SPAWN_MARGIN = 300;
const BULLET_RADIUS = 15;
const RESPAWN_DELAY = 2000;
const INVULNERABLE_RESPAWN = 2000;
const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 220;
const MINIMAP_PADDING = 20;

type Camera = { x: number; y: number };

type DroppedFuelBlob = {
  id: string;
  x: number;
  y: number;
  wobbleSeed: number;
  expiresAt: number;
};

type InspectionProbe = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spawnTime: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(aX: number, aY: number, bX: number, bY: number): number {
  const dx = aX - bX;
  const dy = aY - bY;
  return Math.sqrt(dx * dx + dy * dy);
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

function isOutOfWorld(x: number, y: number, radius = 0): boolean {
  return (
    x < -radius ||
    x > SANDBOX_WORLD_WIDTH + radius ||
    y < -radius ||
    y > SANDBOX_WORLD_HEIGHT + radius
  );
}

function isVisible(
  x: number,
  y: number,
  radius: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  return !(
    x + radius < camera.x ||
    x - radius > camera.x + viewportWidth ||
    y + radius < camera.y ||
    y - radius > camera.y + viewportHeight
  );
}

function applyGravity(
  entity: { x: number; y: number; vx: number; vy: number },
  planet: Planet,
): void {
  const dx = planet.x - entity.x;
  const dy = planet.y - entity.y;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  if (dist < PLANET_CONFIG.radius * 3 && dist > 0) {
    const force =
      (PLANET_CONFIG.gravityStrength * PLANET_CONFIG.radius * PLANET_CONFIG.radius) / distSq;
    entity.vx += (dx / dist) * force;
    entity.vy += (dy / dist) * force;
  }
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
        (planet) => distance(planet.x, planet.y, x, y) < planet.getRadius() + config.radius + 80,
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

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.05,
    size,
    color: getRandomAsteroidColor(size),
    hits: config.hits,
    splitCount: config.splitCount,
    mass: config.mass,
    mask: getAsteroidMask(size),
    getRadius: () => config.radius,
  };
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

function updateAsteroid(asteroid: Asteroid): void {
  asteroid.x += asteroid.vx;
  asteroid.y += asteroid.vy;
  asteroid.rotation += asteroid.rotationSpeed;
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

function updateBullet(bullet: Bullet): void {
  bullet.prevX = bullet.x;
  bullet.prevY = bullet.y;
  bullet.x += bullet.vx;
  bullet.y += bullet.vy;
}

function drawBullet(
  bullet: Bullet,
  ctx: CanvasRenderingContext2D,
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
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'pusher': {
      const currentScreenX = bullet.x - cameraX;
      const currentScreenY = bullet.y - cameraY;
      const previousScreenX = bullet.prevX - previousCameraX;
      const previousScreenY = bullet.prevY - previousCameraY;
      const screenDx = currentScreenX - previousScreenX;
      const screenDy = currentScreenY - previousScreenY;
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

function drawInspectionProbe(probe: InspectionProbe, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(probe.x, probe.y);
  ctx.rotate(probe.angle);
  ctx.fillStyle = '#67e8f9';
  ctx.strokeStyle = '#ecfeff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -4);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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

function updateParticleNoWrap(particle: Particle, deltaTime: number): void {
  particle.x += particle.vx * 0.6;
  particle.y += particle.vy * 0.6;
  particle.vx *= 0.98;
  particle.vy *= 0.98;
  particle.rotation += particle.rotationSpeed;
  particle.lifetime -= deltaTime;
  particle.alpha = Math.max(0, particle.lifetime / particle.maxLifetime);
}

function drawParticleNoWrap(particle: Particle, ctx: CanvasRenderingContext2D): void {
  drawOneParticle(particle, ctx);
}

function drawPlayer(player: Player, ctx: CanvasRenderingContext2D): void {
  const now = Date.now();
  if (player.invulnerable && Math.floor(now / 100) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.isThrusting) {
    ctx.save();
    ctx.rotate(Math.atan2(player.thrustDirY, player.thrustDirX));
    ctx.beginPath();
    ctx.moveTo(PLAYER_SIZE * 0.5, -PLAYER_SIZE * 0.25);
    ctx.lineTo(PLAYER_SIZE * 1.2 + Math.random() * PLAYER_SIZE * 0.3, 0);
    ctx.lineTo(PLAYER_SIZE * 0.5, PLAYER_SIZE * 0.25);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(PLAYER_SIZE * 0.7, 0, PLAYER_SIZE * 1.5, 0);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.2, '#ffff00');
    gradient.addColorStop(0.5, '#ff8800');
    gradient.addColorStop(1, 'rgba(255, 68, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(player.angle - Math.PI / 2);

  const hullGradient = ctx.createLinearGradient(-PLAYER_SIZE * 0.85, 0, PLAYER_SIZE, 0);
  hullGradient.addColorStop(0, '#1a202c');
  hullGradient.addColorStop(0.22, player.color);
  hullGradient.addColorStop(0.68, '#f2f6ff');
  hullGradient.addColorStop(1, '#ffffff');

  ctx.fillStyle = hullGradient;
  ctx.strokeStyle = '#121826';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE, 0);
  ctx.lineTo(PLAYER_SIZE * 0.46, -PLAYER_SIZE * 0.14);
  ctx.lineTo(PLAYER_SIZE * 0.18, -PLAYER_SIZE * 0.2);
  ctx.lineTo(-PLAYER_SIZE * 0.08, -PLAYER_SIZE * 0.54);
  ctx.lineTo(-PLAYER_SIZE * 0.36, -PLAYER_SIZE * 0.46);
  ctx.lineTo(-PLAYER_SIZE * 0.84, -PLAYER_SIZE * 0.22);
  ctx.lineTo(-PLAYER_SIZE * 0.58, -PLAYER_SIZE * 0.08);
  ctx.lineTo(-PLAYER_SIZE * 0.72, 0);
  ctx.lineTo(-PLAYER_SIZE * 0.58, PLAYER_SIZE * 0.08);
  ctx.lineTo(-PLAYER_SIZE * 0.84, PLAYER_SIZE * 0.22);
  ctx.lineTo(-PLAYER_SIZE * 0.36, PLAYER_SIZE * 0.46);
  ctx.lineTo(-PLAYER_SIZE * 0.08, PLAYER_SIZE * 0.54);
  ctx.lineTo(PLAYER_SIZE * 0.18, PLAYER_SIZE * 0.2);
  ctx.lineTo(PLAYER_SIZE * 0.46, PLAYER_SIZE * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawFuelContour(ctx, player, now);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE * 0.72, -PLAYER_SIZE * 0.02);
  ctx.lineTo(PLAYER_SIZE * 0.08, -PLAYER_SIZE * 0.09);
  ctx.lineTo(-PLAYER_SIZE * 0.22, -PLAYER_SIZE * 0.06);
  ctx.lineTo(PLAYER_SIZE * 0.18, -PLAYER_SIZE * 0.01);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#202a3a';
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE * 0.2, -PLAYER_SIZE * 0.08);
  ctx.lineTo(-PLAYER_SIZE * 0.18, -PLAYER_SIZE * 0.22);
  ctx.lineTo(-PLAYER_SIZE * 0.48, -PLAYER_SIZE * 0.09);
  ctx.lineTo(-PLAYER_SIZE * 0.12, -PLAYER_SIZE * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE * 0.2, PLAYER_SIZE * 0.08);
  ctx.lineTo(-PLAYER_SIZE * 0.18, PLAYER_SIZE * 0.22);
  ctx.lineTo(-PLAYER_SIZE * 0.48, PLAYER_SIZE * 0.09);
  ctx.lineTo(-PLAYER_SIZE * 0.12, PLAYER_SIZE * 0.03);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-PLAYER_SIZE * 0.52, 0);
  ctx.lineTo(PLAYER_SIZE * 0.78, 0);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-PLAYER_SIZE * 0.62, -PLAYER_SIZE * 0.16);
  ctx.lineTo(-PLAYER_SIZE * 0.42, -PLAYER_SIZE * 0.12);
  ctx.lineTo(-PLAYER_SIZE * 0.42, PLAYER_SIZE * 0.12);
  ctx.lineTo(-PLAYER_SIZE * 0.62, PLAYER_SIZE * 0.16);
  ctx.closePath();
  ctx.fill();

  const canopyGradient = ctx.createLinearGradient(0, -PLAYER_SIZE * 0.28, 0, PLAYER_SIZE * 0.28);
  canopyGradient.addColorStop(0, '#dff7ff');
  canopyGradient.addColorStop(0.45, '#7dd3fc');
  canopyGradient.addColorStop(1, '#082f49');
  ctx.fillStyle = canopyGradient;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE * 0.34, 0);
  ctx.quadraticCurveTo(PLAYER_SIZE * 0.04, -PLAYER_SIZE * 0.26, -PLAYER_SIZE * 0.18, 0);
  ctx.quadraticCurveTo(PLAYER_SIZE * 0.04, PLAYER_SIZE * 0.26, PLAYER_SIZE * 0.34, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(PLAYER_SIZE * 0.72, 0, PLAYER_SIZE * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.arc(-PLAYER_SIZE * 0.56, -PLAYER_SIZE * 0.14, PLAYER_SIZE * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-PLAYER_SIZE * 0.56, PLAYER_SIZE * 0.14, PLAYER_SIZE * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.rotate(player.turretAngle - Math.PI / 2);

  const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, PLAYER_SIZE * 0.28);
  coreGradient.addColorStop(0, '#e2e8f0');
  coreGradient.addColorStop(0.55, '#475569');
  coreGradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = coreGradient;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_SIZE * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE * 0.08, -PLAYER_SIZE * 0.11);
  ctx.lineTo(PLAYER_SIZE * 0.26, -PLAYER_SIZE * 0.11);
  ctx.lineTo(PLAYER_SIZE * 0.34, -PLAYER_SIZE * 0.07);
  ctx.lineTo(PLAYER_SIZE * 0.68, -PLAYER_SIZE * 0.05);
  ctx.lineTo(PLAYER_SIZE * 0.65, 0);
  ctx.lineTo(PLAYER_SIZE * 0.68, PLAYER_SIZE * 0.05);
  ctx.lineTo(PLAYER_SIZE * 0.34, PLAYER_SIZE * 0.07);
  ctx.lineTo(PLAYER_SIZE * 0.26, PLAYER_SIZE * 0.11);
  ctx.lineTo(PLAYER_SIZE * 0.08, PLAYER_SIZE * 0.11);
  ctx.closePath();
  const barrelGradient = ctx.createLinearGradient(PLAYER_SIZE * 0.08, 0, PLAYER_SIZE * 0.7, 0);
  barrelGradient.addColorStop(0, '#94a3b8');
  barrelGradient.addColorStop(0.45, '#e2e8f0');
  barrelGradient.addColorStop(1, '#475569');
  ctx.fillStyle = barrelGradient;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(PLAYER_SIZE * 0.18, 0, PLAYER_SIZE * 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (player.shieldActive) {
    ctx.beginPath();
    ctx.arc(0, 0, SHIELD_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = SHIELD_COLOR;
    ctx.lineWidth = 3;
    ctx.globalAlpha = player.shieldHits / SHIELD_MAX_HITS;
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function createBullet(player: Player, type: WeaponType, mode: BulletMode = 'normal'): void {
  const config = BULLET_CONFIGS[type];
  const isDegradedSmall = mode === 'degraded' && type === 'small';
  const bulletAngle = player.turretAngle - Math.PI * 0.5;
  const now = Date.now();

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

function updatePlayer(
  player: Player,
  camera: Camera,
  deltaTime: number,
  onProbeFire: () => boolean,
): void {
  const screenPlayerX = player.x - camera.x;
  const screenPlayerY = player.y - camera.y;
  const input = InputManager.getInputState(player.module, screenPlayerX, screenPlayerY);
  const now = Date.now();

  if (player.waitingToRespawn) {
    return;
  }

  player.shieldActive = input.shield.pressed && player.shieldHits > 0;

  const moveMagnitude = Math.sqrt(
    input.move.value[0] * input.move.value[0] + input.move.value[1] * input.move.value[1],
  );
  const accelerationApplied = moveMagnitude > 0.1 && player.fuel > 0;

  if (moveMagnitude > 0.1) {
    player.angle = Math.atan2(input.move.value[1], input.move.value[0]) + Math.PI * 0.5;
  }

  if (accelerationApplied) {
    drainFuel(player, FUEL_THRUST_PER_SECOND * (deltaTime / 1000));
    player.vx += input.move.value[0] * PLAYER_ACCELERATION;
    player.vy += input.move.value[1] * PLAYER_ACCELERATION;
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

  player.x += player.vx;
  player.y += player.vy;

  player.isThrusting = accelerationApplied;
  if (accelerationApplied) {
    player.thrustDirX = -input.move.value[0] / moveMagnitude;
    player.thrustDirY = -input.move.value[1] / moveMagnitude;
    if (now - player.lastThrusterSpawn >= 10) {
      player.lastThrusterSpawn = now;
      createThrusterParticle(
        player.x + player.thrustDirX * PLAYER_SIZE,
        player.y + player.thrustDirY * PLAYER_SIZE,
        player.thrustDirX,
        player.thrustDirY,
      );
    }
  }

  if (
    !player.shieldActive &&
    input.fire.pressed &&
    now - player.timeoutSmall >= BULLET_CONFIGS.small.fireRate
  ) {
    const mode = getWeaponFireMode(player, 'small');
    if (mode) {
      player.timeoutSmall = now;
      createBullet(player, 'small', mode);
      const recoilAngle = player.turretAngle + Math.PI * 0.5;
      player.vx += Math.cos(recoilAngle) * BULLET_CONFIGS.small.recoil;
      player.vy += Math.sin(recoilAngle) * BULLET_CONFIGS.small.recoil;
    }
  }

  if (
    !player.shieldActive &&
    input.chaosFire.pressed &&
    now - player.timeoutShotgun >= BULLET_CONFIGS.shotgun.fireRate
  ) {
    const mode = getWeaponFireMode(player, 'shotgun');
    if (mode) {
      player.timeoutShotgun = now;
      createBullet(player, 'shotgun', mode);
      createBullet(player, 'shotgun', mode);
      const recoilAngle = player.turretAngle + Math.PI * 0.5;
      player.vx += Math.cos(recoilAngle) * BULLET_CONFIGS.shotgun.recoil;
      player.vy += Math.sin(recoilAngle) * BULLET_CONFIGS.shotgun.recoil;
    }
  }

  if (
    !player.shieldActive &&
    input.fireSpecial.pressed &&
    now - player.timeoutPusher >= BULLET_CONFIGS.pusher.fireRate
  ) {
    const mode = getWeaponFireMode(player, 'pusher');
    if (mode) {
      player.timeoutPusher = now;
      createBullet(player, 'pusher', mode);
      const recoilAngle = player.turretAngle + Math.PI * 0.5;
      player.vx += Math.cos(recoilAngle) * BULLET_CONFIGS.pusher.recoil;
      player.vy += Math.sin(recoilAngle) * BULLET_CONFIGS.pusher.recoil;
    }
  }

  if (
    !player.shieldActive &&
    input.fireReallyHard.pressed &&
    now - player.timeoutBlackHole >= BULLET_CONFIGS.blackHole.fireRate
  ) {
    if (onProbeFire()) {
      player.timeoutBlackHole = now;
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

    if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) {
      continue;
    }

    ctx.globalAlpha = STAR_BASE_ALPHA + Math.sin(star.twinklePhase) * STAR_TWINKLE_AMOUNT;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const minimapX = viewportWidth - MINIMAP_WIDTH - MINIMAP_PADDING;
  const minimapY = MINIMAP_PADDING;
  const scaleX = MINIMAP_WIDTH / SANDBOX_WORLD_WIDTH;
  const scaleY = MINIMAP_HEIGHT / SANDBOX_WORLD_HEIGHT;

  ctx.save();

  ctx.fillStyle = 'rgba(6, 10, 20, 0.41)';
  ctx.fillRect(minimapX, minimapY, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(minimapX, minimapY, MINIMAP_WIDTH, MINIMAP_HEIGHT);

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

  for (const planet of planets) {
    const x = minimapX + planet.x * scaleX;
    const y = minimapY + planet.y * scaleY;
    const radius = Math.max(3, planet.getRadius() * scaleX);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = planet.color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  for (const asteroid of asteroids) {
    const x = minimapX + asteroid.x * scaleX;
    const y = minimapY + asteroid.y * scaleY;
    const radius = Math.max(1.5, Math.min(4.5, asteroid.getRadius() * scaleX * 0.6));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = asteroid.color;
    ctx.fill();
  }

  const viewportBoxX = minimapX + camera.x * scaleX;
  const viewportBoxY = minimapY + camera.y * scaleY;
  const viewportBoxWidth = viewportWidth * scaleX;
  const viewportBoxHeight = viewportHeight * scaleY;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(viewportBoxX, viewportBoxY, viewportBoxWidth, viewportBoxHeight);

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
  private droppedFuelBlobs: DroppedFuelBlob[] = [];
  private inspectionProbes: InspectionProbe[] = [];

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

    this.camera.x = clamp(
      currentPlayer.x - viewportWidth / 2,
      0,
      SANDBOX_WORLD_WIDTH - viewportWidth,
    );
    this.camera.y = clamp(
      currentPlayer.y - viewportHeight / 2,
      0,
      SANDBOX_WORLD_HEIGHT - viewportHeight,
    );
  }

  private populateWorld(): void {
    planets.length = 0;

    for (let i = 0; i < SANDBOX_PLANET_COUNT; i++) {
      let x =
        SANDBOX_PLANET_MARGIN + Math.random() * (SANDBOX_WORLD_WIDTH - SANDBOX_PLANET_MARGIN * 2);
      let y =
        SANDBOX_PLANET_MARGIN + Math.random() * (SANDBOX_WORLD_HEIGHT - SANDBOX_PLANET_MARGIN * 2);

      for (let attempt = 0; attempt < 30; attempt++) {
        const tooClose = planets.some(
          (planet) => distance(planet.x, planet.y, x, y) < PLANET_CONFIG.radius * 4,
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
  }

  private placePlayerSafely(currentPlayer: Player): void {
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = SANDBOX_WORLD_WIDTH / 2 + (Math.random() - 0.5) * SANDBOX_SPAWN_MARGIN;
      const y = SANDBOX_WORLD_HEIGHT / 2 + (Math.random() - 0.5) * SANDBOX_SPAWN_MARGIN;
      const tooClose = planets.some(
        (planet) => distance(planet.x, planet.y, x, y) < PLANET_CONFIG.radius * 3,
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

  private spawnWave(wave: number): void {
    const count = 2 + wave;
    const megaChance = Math.min(0.15, wave * 0.02);
    const bigChance = Math.min(0.4, wave * 0.05);

    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let size: 'mega' | 'big' | 'medium' | 'small';
      if (wave >= 10 && rand < megaChance) {
        size = 'mega';
      } else if (wave >= 5 && rand < megaChance + bigChance) {
        size = 'big';
      } else if (wave >= 3 && rand < megaChance + bigChance + 0.3) {
        size = 'medium';
      } else {
        size = 'small';
      }
      asteroids.push(createSandboxAsteroid(size));
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
        wobbleSeed: Math.random(),
        expiresAt: now + ASTEROID_FUEL_BLOB_LIFETIME_MS,
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

        for (let i = extractor.blobs.length - 1; i >= 0; i--) {
          if (currentPlayer.fuel >= currentPlayer.maxFuel) {
            continue;
          }

          const position = getExtractorBlobWorldPosition(
            planet,
            extractor,
            extractor.blobs[i],
            now,
          );
          if (
            distance(currentPlayer.x, currentPlayer.y, position.x, position.y) <=
            currentPlayer.getRadius() + FUEL_BLOB_RADIUS
          ) {
            addFuel(currentPlayer, FUEL_BLOB_AMOUNT);
            extractor.blobs.splice(i, 1);
          }
        }
      }
    }

    for (let i = this.droppedFuelBlobs.length - 1; i >= 0; i--) {
      const blob = this.droppedFuelBlobs[i];
      if (now >= blob.expiresAt || isOutOfWorld(blob.x, blob.y, FUEL_BLOB_RADIUS)) {
        this.droppedFuelBlobs.splice(i, 1);
        continue;
      }

      if (
        currentPlayer.fuel < currentPlayer.maxFuel &&
        distance(currentPlayer.x, currentPlayer.y, blob.x, blob.y) <=
          currentPlayer.getRadius() + FUEL_BLOB_RADIUS
      ) {
        addFuel(currentPlayer, FUEL_BLOB_AMOUNT);
        this.droppedFuelBlobs.splice(i, 1);
      }
    }
  }

  private fireInspectionProbe(currentPlayer: Player): boolean {
    if (currentPlayer.inspectionProbes <= 0) {
      return false;
    }

    currentPlayer.inspectionProbes--;
    const angle = currentPlayer.turretAngle - Math.PI * 0.5;
    this.inspectionProbes.push({
      x: currentPlayer.x + Math.cos(angle) * PLAYER_SIZE,
      y: currentPlayer.y + Math.sin(angle) * PLAYER_SIZE,
      vx: currentPlayer.vx + Math.cos(angle) * INSPECTION_PROBE_SPEED,
      vy: currentPlayer.vy + Math.sin(angle) * INSPECTION_PROBE_SPEED,
      angle,
      spawnTime: Date.now(),
    });
    return true;
  }

  private updateInspectionProbes(now: number): void {
    for (let i = this.inspectionProbes.length - 1; i >= 0; i--) {
      const probe = this.inspectionProbes[i];
      probe.x += probe.vx;
      probe.y += probe.vy;

      if (
        now - probe.spawnTime >= INSPECTION_PROBE_LIFETIME_MS ||
        isOutOfWorld(probe.x, probe.y, INSPECTION_PROBE_RADIUS)
      ) {
        this.inspectionProbes.splice(i, 1);
        continue;
      }

      const hitPlanet = planets.find(
        (planet) =>
          distance(probe.x, probe.y, planet.x, planet.y) <=
          planet.getRadius() + INSPECTION_PROBE_RADIUS,
      );
      if (hitPlanet) {
        hitPlanet.inspectedUntil = now + INSPECTION_PROBE_DURATION_MS;
        this.inspectionProbes.splice(i, 1);
      }
    }
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

    for (const planet of planets) {
      for (const extractor of planet.fuelExtractors) {
        for (const blob of extractor.blobs) {
          const position = getExtractorBlobWorldPosition(planet, extractor, blob, now);
          const screenX = position.x - this.camera.x;
          const screenY = position.y - this.camera.y;
          if (!isScreenMetaballVisible(screenX, screenY, FUEL_BLOB_RADIUS * 3)) {
            continue;
          }

          metaballs.push({
            x: screenX,
            y: screenY,
            radius: FUEL_BLOB_RADIUS,
            seed: blob.wobbleSeed,
          });
        }
      }

      if (now < planet.inspectedUntil) {
        if (
          !isVisible(
            planet.x,
            planet.y,
            planet.getRadius(),
            this.camera,
            viewportWidth,
            viewportHeight,
          )
        ) {
          continue;
        }

        const internalBlobCount = Math.ceil(planet.fuelReserve / FUEL_INSPECTION_BLOB_AMOUNT);
        for (let i = 0; i < internalBlobCount; i++) {
          const seed = (i + 1) * 12.9898 + planet.x * 0.001 + planet.y * 0.002;
          const orbit = now * 0.00035 * Math.max(0.25, internalBlobCount / 4) + seed;
          const radius = planet.getRadius() * (0.12 + ((i * 37) % 58) / 100);
          const metaballRadius = 12 + Math.min(10, internalBlobCount * 0.6);
          const screenX = planet.x - this.camera.x + Math.cos(orbit) * radius;
          const screenY = planet.y - this.camera.y + Math.sin(orbit * 1.17) * radius;
          if (!isScreenMetaballVisible(screenX, screenY, metaballRadius * 3)) {
            continue;
          }

          metaballs.push({
            x: screenX,
            y: screenY,
            radius: metaballRadius,
            seed,
          });
        }
      }
    }

    for (const blob of this.droppedFuelBlobs) {
      const wobble = Math.sin(now * 0.004 + blob.wobbleSeed * Math.PI * 2) * 3;
      const screenX = blob.x - this.camera.x;
      const screenY = blob.y - this.camera.y + wobble;
      if (!isScreenMetaballVisible(screenX, screenY, FUEL_BLOB_RADIUS * 3)) {
        continue;
      }

      metaballs.push({
        x: screenX,
        y: screenY,
        radius: FUEL_BLOB_RADIUS,
        seed: blob.wobbleSeed,
      });
    }

    return metaballs;
  }

  private killPlayer(currentPlayer: Player, now: number, explosionIntensity: number): void {
    if (currentPlayer.waitingToRespawn) {
      return;
    }

    currentPlayer.lives--;
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

    currentPlayer.lives = STARTING_LIVES;
    currentPlayer.score = 0;
    currentPlayer.shieldHits = SHIELD_MAX_HITS;
    currentPlayer.shieldActive = false;
    refillRespawnResources(currentPlayer);
    currentPlayer.waitingToRespawn = false;
    currentPlayer.angle = 0;
    currentPlayer.turretAngle = 0;
    currentPlayer.vx = 0;
    currentPlayer.vy = 0;
    currentPlayer.invulnerable = true;
    currentPlayer.invulnerableUntil = Date.now() + 3000;
    currentPlayer.respawnTime = 0;
    this.placePlayerSafely(currentPlayer);
    this.updateCamera();
    this.previousCamera.x = this.camera.x;
    this.previousCamera.y = this.camera.y;
    this.spawnWave(1);

    if (this.canvas) {
      initShader(this.canvas);
      initFuelMetaballs();
    }
  }

  update(deltaTime: number): void {
    const now = Date.now();
    updateBackground(deltaTime);

    if (screenShake.intensity > 0) {
      const elapsed = now - screenShake.startTime;
      if (elapsed >= screenShake.duration) {
        screenShake.intensity = 0;
      }
    }

    const currentPlayer = player;
    if (!gameState.baseAlphaMask || !currentPlayer) {
      return;
    }

    this.updatePlanetFuel(deltaTime, now, currentPlayer);
    this.updateInspectionProbes(now);

    for (const planet of planets) {
      if (currentPlayer.lives > 0 && !currentPlayer.waitingToRespawn) {
        applyGravity(currentPlayer, planet);
      }
      for (const asteroid of asteroids) {
        applyGravity(asteroid, planet);
      }
      for (const bullet of bullets) {
        applyGravity(bullet, planet);
      }
    }

    processPlanetPlayer: for (const planet of planets) {
      if (
        currentPlayer.invulnerable ||
        currentPlayer.lives <= 0 ||
        currentPlayer.waitingToRespawn
      ) {
        break;
      }
      if (
        distance(currentPlayer.x, currentPlayer.y, planet.x, planet.y) <
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
          distance(asteroid.x, asteroid.y, planet.x, planet.y) <
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
        planets.some(
          (planet) =>
            distance(bullet.x, bullet.y, planet.x, planet.y) < planet.getRadius() + BULLET_RADIUS,
        )
      ) {
        bullets.splice(i, 1);
      }
    }

    if (asteroids.length === 0 && !gameState.waveCleared) {
      gameState.waveCleared = true;
      gameState.waveClearTime = now;
    }

    if (gameState.waveCleared && now - gameState.waveClearTime > 2000) {
      gameState.currentWave++;
      this.spawnWave(gameState.currentWave);
      gameState.waveCleared = false;
      currentPlayer.shieldHits = SHIELD_MAX_HITS;
    }

    const handledBullets = new Set<number>();
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const asteroid = asteroids[j];
        if (
          distance(bullet.x, bullet.y, asteroid.x, asteroid.y) >=
          BULLET_RADIUS + asteroid.getRadius()
        ) {
          continue;
        }

        handledBullets.add(i);
        const massMultiplier =
          asteroid.size === 'big' ? 0.3 : asteroid.size === 'medium' ? 0.6 : 1.0;
        const impulse = bullet.impact * 2 * massMultiplier;
        asteroid.vx += bullet.vx * 0.1 * impulse;
        asteroid.vy += bullet.vy * 0.1 * impulse;
        asteroid.hits -= bullet.damage;

        if (asteroid.hits <= 0) {
          if (currentPlayer.id === bullet.playerId) {
            currentPlayer.score += ASTEROID_CONFIGS[asteroid.size].points * currentPlayer.lives;
          }

          const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
          createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
          this.spawnAsteroidFuelDrops(asteroid, now);
          asteroids.push(...splitAsteroid(asteroid));
          asteroids.splice(j, 1);
        }
        break;
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (handledBullets.has(i)) {
        bullets.splice(i, 1);
      }
    }

    this.updateCamera();
    updatePlayer(currentPlayer, this.camera, deltaTime, () =>
      this.fireInspectionProbe(currentPlayer),
    );

    for (const asteroid of asteroids) {
      updateAsteroid(asteroid);
    }

    if (!currentPlayer.invulnerable && !currentPlayer.waitingToRespawn) {
      for (const asteroid of asteroids) {
        const asteroidRadius = asteroid.getRadius();
        const shieldCollisionDist = SHIELD_RADIUS + asteroidRadius;
        const shipCollisionDist = currentPlayer.getRadius() + asteroidRadius;
        const actualDist = distance(currentPlayer.x, currentPlayer.y, asteroid.x, asteroid.y);

        if (currentPlayer.shieldActive && actualDist < shieldCollisionDist) {
          const hitNow = Date.now();
          if (hitNow < currentPlayer.shieldHitUntil) {
            continue;
          }
          currentPlayer.shieldHitUntil = hitNow + SHIELD_HIT_COOLDOWN;
          drainFuel(currentPlayer, SHIELD_COLLISION_FUEL_COSTS[asteroid.size]);

          const safeDist = actualDist || 1;
          const nx = (currentPlayer.x - asteroid.x) / safeDist;
          const ny = (currentPlayer.y - asteroid.y) / safeDist;
          const bounceForce = 8;
          const shipInfluence = asteroid.mass / (1 + asteroid.mass);
          asteroid.vx -= nx * bounceForce * (1 - shipInfluence);
          asteroid.vy -= ny * bounceForce * (1 - shipInfluence);
          currentPlayer.vx += nx * bounceForce * shipInfluence;
          currentPlayer.vy += ny * bounceForce * shipInfluence;
          asteroid.x -= nx * (shieldCollisionDist - actualDist);
          asteroid.y -= ny * (shieldCollisionDist - actualDist);
          currentPlayer.shieldHits--;
          if (currentPlayer.shieldHits <= 0) {
            currentPlayer.shieldActive = false;
          }
        } else if (!currentPlayer.shieldActive && actualDist < shipCollisionDist) {
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

    if (!currentPlayer.waitingToRespawn && isOutOfWorld(currentPlayer.x, currentPlayer.y)) {
      this.killPlayer(currentPlayer, now, 2);
    }

    if (currentPlayer.lives <= 0 && now >= currentPlayer.respawnTime) {
      sceneManager.transitionTo('gameover');
      gameState.gameOverTime = now;
    } else if (currentPlayer.waitingToRespawn && now >= currentPlayer.respawnTime) {
      currentPlayer.invulnerable = true;
      currentPlayer.invulnerableUntil = now + INVULNERABLE_RESPAWN;
      currentPlayer.vx = 0;
      currentPlayer.vy = 0;
      currentPlayer.shieldHits = SHIELD_MAX_HITS;
      refillRespawnResources(currentPlayer);
      currentPlayer.waitingToRespawn = false;
      this.placePlayerSafely(currentPlayer);
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      if (asteroid.hits <= 0 || isOutOfWorld(asteroid.x, asteroid.y, asteroid.getRadius())) {
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
        }
        asteroids.splice(i, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      updateBullet(bullets[i]);
      if (
        Date.now() - bullets[i].spawnTime >= bullets[i].lifetime ||
        isOutOfWorld(bullets[i].x, bullets[i].y, BULLET_RADIUS)
      ) {
        bullets.splice(i, 1);
      }
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      updateThrusterParticle(thrusterParticles[i], deltaTime);
      if (
        thrusterParticles[i].lifetime <= 0 ||
        isOutOfWorld(thrusterParticles[i].x, thrusterParticles[i].y, 8)
      ) {
        thrusterParticles.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      updateParticleNoWrap(particles[i], deltaTime);
      if (particles[i].lifetime <= 0 || isOutOfWorld(particles[i].x, particles[i].y, 16)) {
        particles.splice(i, 1);
      }
    }

    this.updateCamera();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const now = Date.now();
    const viewportWidth = getGameWidth();
    const viewportHeight = getGameHeight();

    let shakeX = 0;
    let shakeY = 0;
    if (screenShake.intensity > 0) {
      const elapsed = now - screenShake.startTime;
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
      if (
        isVisible(
          planet.x,
          planet.y,
          planet.getRadius(),
          this.camera,
          viewportWidth,
          viewportHeight,
        )
      ) {
        drawPlanet(planet, ctx);
        if (now < planet.inspectedUntil) {
          drawInspectedPlanetOverlay(ctx, planet);
        }
        for (const extractor of planet.fuelExtractors) {
          drawFuelExtractorBuilding(ctx, planet, extractor);
        }
      }
    }

    for (const bullet of bullets) {
      if (
        isVisible(bullet.x, bullet.y, BULLET_RADIUS, this.camera, viewportWidth, viewportHeight)
      ) {
        drawBullet(
          bullet,
          ctx,
          this.camera.x,
          this.camera.y,
          this.previousCamera.x,
          this.previousCamera.y,
        );
      }
    }

    for (const probe of this.inspectionProbes) {
      if (
        isVisible(
          probe.x,
          probe.y,
          INSPECTION_PROBE_RADIUS,
          this.camera,
          viewportWidth,
          viewportHeight,
        )
      ) {
        drawInspectionProbe(probe, ctx);
      }
    }

    for (const asteroid of asteroids) {
      if (
        isVisible(
          asteroid.x,
          asteroid.y,
          asteroid.getRadius(),
          this.camera,
          viewportWidth,
          viewportHeight,
        )
      ) {
        drawAsteroid(asteroid, ctx);
      }
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      if (
        isVisible(
          thrusterParticles[i].x,
          thrusterParticles[i].y,
          12,
          this.camera,
          viewportWidth,
          viewportHeight,
        )
      ) {
        drawThrusterParticle(thrusterParticles[i], ctx);
      }
    }

    if (player && !player.waitingToRespawn) {
      drawPlayer(player, ctx);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      if (
        isVisible(particles[i].x, particles[i].y, 16, this.camera, viewportWidth, viewportHeight)
      ) {
        drawParticleNoWrap(particles[i], ctx);
      }
    }

    ctx.restore();

    renderFuelMetaballs(ctx, this.collectFuelMetaballs(now), now);

    if (player) {
      ctx.font = '20px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = player.color;
      ctx.fillText('Sandbox', 20, 20);
      const remainingTime = Math.max(0, Math.ceil((player.respawnTime - now) / 1000));
      if (player.lives <= 0) {
        ctx.fillStyle = '#888';
        ctx.fillText(`Waiting... ${remainingTime}s`, 110, 20);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillText(`x${player.lives} ${'♥'.repeat(player.lives)}`, 110, 20);
      }
      ctx.fillText(`Score: ${player.score}`, 110, 45);
      ctx.fillText(`Wave ${gameState.currentWave}`, 110, 70);
      ctx.fillText(`Probes: ${player.inspectionProbes}`, 110, 95);
      ctx.fillStyle = '#888';
      ctx.fillText(
        `${Math.round(player.x)}, ${Math.round(player.y)} / ${SANDBOX_WORLD_WIDTH} x ${SANDBOX_WORLD_HEIGHT}`,
        20,
        viewportHeight - 30,
      );
    }

    drawMinimap(ctx, this.camera, viewportWidth, viewportHeight);

    if (this.canvas) {
      updateBlackHoles(
        bullets
          .filter((bullet) => bullet.type === 'blackHole')
          .map((bullet) => ({ x: bullet.x - this.camera.x, y: bullet.y - this.camera.y })),
      );
      renderWithShaders(this.canvas);
    }
  }

  exit(): void {
    disposeFuelMetaballs();
    disposeBlackHoleShader();
  }
}
