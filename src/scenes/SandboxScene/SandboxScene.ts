import { getAsteroidMask, getRandomAsteroidColor } from '@/assets';
import {
  ASTEROID_CONFIGS,
  GRID_COLOR,
  GRID_SPACING,
  PLANET_CONFIG,
  PLAYER_ACCELERATION,
  PLAYER_MAX_SPEED,
  PLAYER_SIZE,
  SHIELD_COLOR,
  SHIELD_HIT_COOLDOWN,
  SHIELD_MAX_HITS,
  SHIELD_RADIUS,
  STAR_BASE_ALPHA,
  STAR_TWINKLE_AMOUNT,
  STARTING_LIVES,
  type Asteroid,
  type Bullet,
  type Particle,
  type Planet,
  type Player,
} from '@/constants';
import { InputManager } from '@/input';
import { joymap } from '@/joymap';
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
import { createPlayer } from '../GameScene/player';
import { rumbleDeath } from '../GameScene/rumble';
import { dispose, initShader, renderWithShaders, updateBlackHoles } from '../GameScene/shader';
import type { Scene } from '../scene';
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(aX: number, aY: number, bX: number, bY: number): number {
  const dx = aX - bX;
  const dy = aY - bY;
  return Math.sqrt(dx * dx + dy * dy);
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

function createBullet(player: Player, type: 'small' | 'blackHole' | 'pusher' | 'shotgun'): void {
  const config = {
    small: {
      speed: 15,
      lifetime: 500,
      damage: 2,
      impact: 0.2,
      recoil: 0.5,
      bulletCount: 1,
      spreadAngle: 0,
      speedVariance: 0,
    },
    blackHole: {
      speed: 1,
      lifetime: 10000,
      damage: 400,
      impact: 0.5,
      recoil: 4,
      bulletCount: 1,
      spreadAngle: 0,
      speedVariance: 0,
    },
    pusher: {
      speed: 8,
      lifetime: 1000,
      damage: 0.2,
      impact: 0.5,
      recoil: 0.1,
      bulletCount: 1,
      spreadAngle: 0,
      speedVariance: 0,
    },
    shotgun: {
      speed: 12,
      lifetime: 250,
      damage: 1,
      impact: 0.02,
      recoil: 2,
      bulletCount: 12,
      spreadAngle: Math.PI / 4,
      speedVariance: 0.3,
    },
  }[type];

  const bulletAngle = player.turretAngle - Math.PI * 0.5;
  const now = Date.now();

  for (let i = 0; i < config.bulletCount; i++) {
    const spreadOffset =
      config.bulletCount > 1 ? (i / (config.bulletCount - 1) - 0.5) * config.spreadAngle : 0;
    const speed =
      config.speed * (1 - config.speedVariance + Math.random() * config.speedVariance * 2);
    const angle = bulletAngle + spreadOffset;
    const lifetime =
      config.speedVariance > 0 ? config.lifetime * (0.7 + Math.random() * 0.3) : config.lifetime;

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
      damage: config.damage,
      impact: config.impact,
      recoil: config.recoil,
      type,
    });
  }
}

function updatePlayer(player: Player, camera: Camera): void {
  const screenPlayerX = player.x - camera.x;
  const screenPlayerY = player.y - camera.y;
  const input = InputManager.getInputState(player.module, screenPlayerX, screenPlayerY);
  const now = Date.now();

  if (player.waitingToRespawn) {
    return;
  }

  player.shieldActive = input.shield.pressed && player.shieldHits > 0;

  if (input.move.value[0] !== 0 || input.move.value[1] !== 0) {
    player.angle = Math.atan2(input.move.value[1], input.move.value[0]) + Math.PI * 0.5;
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

  const moveMagnitude = Math.sqrt(
    input.move.value[0] * input.move.value[0] + input.move.value[1] * input.move.value[1],
  );
  player.isThrusting = moveMagnitude > 0.1;
  if (moveMagnitude > 0.1) {
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

  if (!player.shieldActive && input.fire.pressed && now - player.timeoutSmall >= 200) {
    player.timeoutSmall = now;
    createBullet(player, 'small');
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * 0.5;
    player.vy += Math.sin(recoilAngle) * 0.5;
  }

  if (!player.shieldActive && input.chaosFire.pressed && now - player.timeoutShotgun >= 600) {
    player.timeoutShotgun = now;
    createBullet(player, 'shotgun');
    createBullet(player, 'shotgun');
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * 2;
    player.vy += Math.sin(recoilAngle) * 2;
  }

  if (!player.shieldActive && input.fireSpecial.pressed && now - player.timeoutPusher >= 40) {
    player.timeoutPusher = now;
    createBullet(player, 'pusher');
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * 0.1;
    player.vy += Math.sin(recoilAngle) * 0.1;
  }

  if (
    !player.shieldActive &&
    input.fireReallyHard.pressed &&
    now - player.timeoutBlackHole >= 2000
  ) {
    player.timeoutBlackHole = now;
    createBullet(player, 'blackHole');
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * 4;
    player.vy += Math.sin(recoilAngle) * 4;
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

  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  resize(): void {
    if (gameState.gameSize && this.canvas) {
      dispose();
      initShader(this.canvas);
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
    }
  }

  update(_deltaTime: number): void {
    const now = Date.now();
    const deltaTime = 16;
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
    updatePlayer(currentPlayer, this.camera);

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

          const nx = (currentPlayer.x - asteroid.x) / actualDist;
          const ny = (currentPlayer.y - asteroid.y) / actualDist;
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
    dispose();
  }
}
