import {
  BULLET_CONFIGS,
  PLAYER_ACCELERATION,
  PLAYER_MAX_SPEED,
  PLAYER_SIZE,
  SHIELD_MAX_HITS,
  SHIELD_RADIUS,
  STARTING_LIVES,
  type Bullet,
  type Particle,
  type Player,
} from '@/constants';
import { InputManager } from '@/input';
import { joymap } from '@/joymap';
import {
  bullets,
  gameState,
  getGameHeight,
  getGameWidth,
  particles,
  player,
  resetState,
  setPlayer,
  stars,
  thrusterParticles,
} from '@/state';
import { updateBackground } from '../GameScene/background';
import {
  createExplosion,
  createThrusterParticle,
  drawOneParticle,
  drawThrusterParticle,
  updateThrusterParticle,
} from '../GameScene/particle';
import { createPlayer, drawPlayer } from '../GameScene/player';
import { ShipInteriorSpriteRenderer } from './interiorSprites';
import {
  loadShipInteriorLevel,
  type LoadedShipInteriorLayer,
  type LoadedShipInteriorTile,
  type Rect,
  type ShipInteriorLevel,
} from './level';
import type { Scene } from '../scene';

const BULLET_RADIUS = 8;
const BOUNDARY_WALL_THICKNESS = 45;
const PLAYER_WALL_BOUNCE = 0.9;
const PLAYER_WALL_DAMPING = 0.8;
const PLAYER_AIR_FRICTION = 0.99;
const PLAYER_VELOCITY_MULTIPLIER = 4;
const ENEMY_RADIUS = 22;
const ENEMY_SPEED = 1.6;
const ENEMY_TURN_SPEED = 0.035;
const ENEMY_FOV_RANGE = 280;
const ENEMY_FOV_HALF_ANGLE = Math.PI / 5;
const ENEMY_VISION_SWEEP = 0.3;
const ENEMY_VISION_RAY_COUNT = 48;
const ALARM_HOLD_MS = 3000;

type Camera = { x: number; y: number };

type Enemy = {
  x: number;
  y: number;
  patrolA: { x: number; y: number };
  patrolB: { x: number; y: number };
  targetA: boolean;
  facing: number;
  desiredFacing: number;
  visionRange: number;
  visionHalfAngle: number;
  alive: boolean;
};

const EMPTY_LEVEL: ShipInteriorLevel = {
  formatVersion: 1,
  name: 'empty',
  width: 1,
  height: 1,
  tilesets: [],
  layers: [],
  paths: [],
  entities: [],
  playerSpawn: null,
  patrollers: [],
};

let activeLevel: ShipInteriorLevel = EMPTY_LEVEL;

function getBoundaryWalls(): Rect[] {
  return [
    { x: 0, y: 0, width: activeLevel.width, height: BOUNDARY_WALL_THICKNESS },
    {
      x: 0,
      y: activeLevel.height - BOUNDARY_WALL_THICKNESS,
      width: activeLevel.width,
      height: BOUNDARY_WALL_THICKNESS,
    },
    { x: 0, y: 0, width: BOUNDARY_WALL_THICKNESS, height: activeLevel.height },
    {
      x: activeLevel.width - BOUNDARY_WALL_THICKNESS,
      y: 0,
      width: BOUNDARY_WALL_THICKNESS,
      height: activeLevel.height,
    },
  ];
}

function getTileWorldRect(layer: LoadedShipInteriorLayer, tile: LoadedShipInteriorTile): Rect {
  return {
    x: tile.tileX * layer.tilemap.tileWidth,
    y: tile.tileY * layer.tilemap.tileHeight,
    width: layer.tilemap.tileWidth,
    height: layer.tilemap.tileHeight,
  };
}

function getCollidableTileLayers(): LoadedShipInteriorLayer[] {
  return activeLevel.layers.filter((layer) => layer.hasCollision);
}

function getAllWalls(): Rect[] {
  const collisionTiles = getCollidableTileLayers().flatMap((layer) =>
    layer.tiles.map((tile) => getTileWorldRect(layer, tile)),
  );
  return [...getBoundaryWalls(), ...collisionTiles];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(aX: number, aY: number, bX: number, bY: number): number {
  const dx = aX - bX;
  const dy = aY - bY;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function rotateTowardsAngle(current: number, target: number, maxStep: number): number {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) {
    return target;
  }
  return current + Math.sign(delta) * maxStep;
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function intersectsWall(x: number, y: number, radius: number): boolean {
  for (const wall of getAllWalls()) {
    const nearestX = clamp(x, wall.x, wall.x + wall.width);
    const nearestY = clamp(y, wall.y, wall.y + wall.height);
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < radius * radius) {
      return true;
    }
  }
  return false;
}

function expandedRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: Rect,
): boolean {
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) {
    return true;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 0.000001) {
      return q >= 0;
    }

    const r = q / p;
    if (p < 0) {
      if (r > tMax) {
        return false;
      }
      if (r > tMin) {
        tMin = r;
      }
    } else {
      if (r < tMin) {
        return false;
      }
      if (r < tMax) {
        tMax = r;
      }
    }
    return true;
  };

  return (
    clip(-dx, x1 - rect.x) &&
    clip(dx, rect.x + rect.width - x1) &&
    clip(-dy, y1 - rect.y) &&
    clip(dy, rect.y + rect.height - y1) &&
    tMin <= tMax
  );
}

function hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
  return !getAllWalls().some((wall) => segmentIntersectsRect(fromX, fromY, toX, toY, wall));
}

function pathBlockedByWall(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius: number,
): boolean {
  return getAllWalls().some((wall) =>
    segmentIntersectsRect(fromX, fromY, toX, toY, expandedRect(wall, radius)),
  );
}

function raycastToWallDistance(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  maxDistance: number,
): number {
  let nearestDistance = maxDistance;

  for (const wall of getAllWalls()) {
    let tMin = 0;
    let tMax = nearestDistance;

    const clipAxis = (origin: number, dir: number, min: number, max: number): boolean => {
      if (Math.abs(dir) < 0.000001) {
        return origin >= min && origin <= max;
      }

      let t1 = (min - origin) / dir;
      let t2 = (max - origin) / dir;
      if (t1 > t2) {
        const temp = t1;
        t1 = t2;
        t2 = temp;
      }

      if (t1 > tMin) {
        tMin = t1;
      }
      if (t2 < tMax) {
        tMax = t2;
      }

      return tMin <= tMax;
    };

    if (
      clipAxis(originX, dirX, wall.x, wall.x + wall.width) &&
      clipAxis(originY, dirY, wall.y, wall.y + wall.height) &&
      tMin >= 0 &&
      tMin < nearestDistance
    ) {
      nearestDistance = tMin;
    }
  }

  return nearestDistance;
}

function createSceneBullet(
  currentPlayer: Player,
  type: 'small' | 'blackHole' | 'pusher' | 'shotgun',
): void {
  const config = BULLET_CONFIGS[type];
  const bulletAngle = currentPlayer.turretAngle - Math.PI * 0.5;
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
      x: currentPlayer.x + Math.cos(bulletAngle) * PLAYER_SIZE,
      y: currentPlayer.y + Math.sin(bulletAngle) * PLAYER_SIZE,
      prevX: currentPlayer.x + Math.cos(bulletAngle) * PLAYER_SIZE,
      prevY: currentPlayer.y + Math.sin(bulletAngle) * PLAYER_SIZE,
      vx: currentPlayer.vx + Math.cos(angle) * speed,
      vy: currentPlayer.vy + Math.sin(angle) * speed,
      angle,
      lifetime,
      spawnTime: now,
      playerId: currentPlayer.id,
      damage: config.damage,
      impact: config.impact,
      recoil: config.recoil,
      type,
    });
  }
}

function updateScenePlayer(currentPlayer: Player, camera: Camera): void {
  if (currentPlayer.waitingToRespawn) {
    return;
  }

  const screenPlayerX = currentPlayer.x - camera.x;
  const screenPlayerY = currentPlayer.y - camera.y;
  const input = InputManager.getInputState(currentPlayer.module, screenPlayerX, screenPlayerY);
  const now = Date.now();

  currentPlayer.shieldActive = input.shield.pressed && currentPlayer.shieldHits > 0;

  if (input.move.value[0] !== 0 || input.move.value[1] !== 0) {
    currentPlayer.angle = Math.atan2(input.move.value[1], input.move.value[0]) + Math.PI * 0.5;
    currentPlayer.vx += input.move.value[0] * PLAYER_ACCELERATION * PLAYER_VELOCITY_MULTIPLIER;
    currentPlayer.vy += input.move.value[1] * PLAYER_ACCELERATION * PLAYER_VELOCITY_MULTIPLIER;
  }

  const speed = Math.sqrt(
    currentPlayer.vx * currentPlayer.vx + currentPlayer.vy * currentPlayer.vy,
  );
  const sceneMaxSpeed = PLAYER_MAX_SPEED * PLAYER_VELOCITY_MULTIPLIER;
  if (speed > sceneMaxSpeed) {
    const scale = sceneMaxSpeed / speed;
    currentPlayer.vx *= scale;
    currentPlayer.vy *= scale;
  }

  if (input.aim.pressed) {
    const aimX = input.aim.value[0];
    const aimY = input.aim.value[1];
    const aimMagnitude = Math.sqrt(aimX * aimX + aimY * aimY);
    if (aimMagnitude > 0) {
      currentPlayer.turretAngle = Math.atan2(aimY, aimX) + Math.PI * 0.5;
    }
  }

  currentPlayer.x += currentPlayer.vx;
  currentPlayer.y += currentPlayer.vy;

  const moveMagnitude = Math.sqrt(
    input.move.value[0] * input.move.value[0] + input.move.value[1] * input.move.value[1],
  );
  currentPlayer.isThrusting = moveMagnitude > 0.1;
  if (moveMagnitude > 0.1) {
    currentPlayer.thrustDirX = -input.move.value[0] / moveMagnitude;
    currentPlayer.thrustDirY = -input.move.value[1] / moveMagnitude;
    if (now - currentPlayer.lastThrusterSpawn >= 10) {
      currentPlayer.lastThrusterSpawn = now;
      createThrusterParticle(
        currentPlayer.x + currentPlayer.thrustDirX * PLAYER_SIZE,
        currentPlayer.y + currentPlayer.thrustDirY * PLAYER_SIZE,
        currentPlayer.thrustDirX,
        currentPlayer.thrustDirY,
      );
    }
  }

  if (
    !currentPlayer.shieldActive &&
    input.fire.pressed &&
    now - currentPlayer.timeoutSmall >= BULLET_CONFIGS.small.fireRate
  ) {
    currentPlayer.timeoutSmall = now;
    createSceneBullet(currentPlayer, 'small');
    const recoilAngle = currentPlayer.turretAngle + Math.PI * 0.5;
    currentPlayer.vx += Math.cos(recoilAngle) * BULLET_CONFIGS.small.recoil;
    currentPlayer.vy += Math.sin(recoilAngle) * BULLET_CONFIGS.small.recoil;
  }

  if (
    !currentPlayer.shieldActive &&
    input.chaosFire.pressed &&
    now - currentPlayer.timeoutShotgun >= BULLET_CONFIGS.shotgun.fireRate
  ) {
    currentPlayer.timeoutShotgun = now;
    createSceneBullet(currentPlayer, 'shotgun');
    createSceneBullet(currentPlayer, 'shotgun');
    const recoilAngle = currentPlayer.turretAngle + Math.PI * 0.5;
    currentPlayer.vx += Math.cos(recoilAngle) * BULLET_CONFIGS.shotgun.recoil;
    currentPlayer.vy += Math.sin(recoilAngle) * BULLET_CONFIGS.shotgun.recoil;
  }

  if (
    !currentPlayer.shieldActive &&
    input.fireSpecial.pressed &&
    now - currentPlayer.timeoutPusher >= BULLET_CONFIGS.pusher.fireRate
  ) {
    currentPlayer.timeoutPusher = now;
    createSceneBullet(currentPlayer, 'pusher');
    const recoilAngle = currentPlayer.turretAngle + Math.PI * 0.5;
    currentPlayer.vx += Math.cos(recoilAngle) * BULLET_CONFIGS.pusher.recoil;
    currentPlayer.vy += Math.sin(recoilAngle) * BULLET_CONFIGS.pusher.recoil;
  }

  if (
    !currentPlayer.shieldActive &&
    input.fireReallyHard.pressed &&
    now - currentPlayer.timeoutBlackHole >= BULLET_CONFIGS.blackHole.fireRate
  ) {
    currentPlayer.timeoutBlackHole = now;
    createSceneBullet(currentPlayer, 'blackHole');
    const recoilAngle = currentPlayer.turretAngle + Math.PI * 0.5;
    currentPlayer.vx += Math.cos(recoilAngle) * BULLET_CONFIGS.blackHole.recoil;
    currentPlayer.vy += Math.sin(recoilAngle) * BULLET_CONFIGS.blackHole.recoil;
  }

  if (currentPlayer.invulnerable && now >= currentPlayer.invulnerableUntil) {
    currentPlayer.invulnerable = false;
  }

  currentPlayer.vx *= PLAYER_AIR_FRICTION;
  currentPlayer.vy *= PLAYER_AIR_FRICTION;
}

function updateBullet(bullet: Bullet): void {
  bullet.prevX = bullet.x;
  bullet.prevY = bullet.y;
  bullet.x += bullet.vx;
  bullet.y += bullet.vy;
}

function drawBullet(bullet: Bullet, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);

  switch (bullet.type) {
    case 'small': {
      ctx.rotate(bullet.angle);
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(8, 0);
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
      const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
      const normalized = Math.max(0, Math.min(1, (speed - 2) / 13));
      const length = 10 + normalized * 40;
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI);
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

function drawPlayerVisionCone(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  alarmActive: boolean,
  now: number,
): void {
  const pulse = 0.5 + Math.sin(now * 0.008 + enemy.x * 0.0005) * ENEMY_VISION_SWEEP;
  const opacity = alarmActive ? 0.16 + pulse * 0.08 : 0.08 + pulse * 0.04;
  const coneColor = alarmActive
    ? `rgba(255, 60, 80, ${opacity})`
    : `rgba(255, 225, 110, ${opacity})`;
  const strokeColor = alarmActive ? 'rgba(255, 100, 120, 0.45)' : 'rgba(255, 220, 120, 0.35)';

  ctx.beginPath();
  ctx.moveTo(enemy.x, enemy.y);
  for (let i = 0; i <= ENEMY_VISION_RAY_COUNT; i++) {
    const t = i / ENEMY_VISION_RAY_COUNT;
    const angle = enemy.facing - enemy.visionHalfAngle + t * enemy.visionHalfAngle * 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const distance = raycastToWallDistance(enemy.x, enemy.y, dirX, dirY, enemy.visionRange);
    ctx.lineTo(enemy.x + dirX * distance, enemy.y + dirY * distance);
  }
  ctx.closePath();
  ctx.fillStyle = coneColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, alarmActive: boolean): void {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.facing + Math.PI * 0.5);

  const hullGradient = ctx.createLinearGradient(-ENEMY_RADIUS, 0, ENEMY_RADIUS, 0);
  if (alarmActive) {
    hullGradient.addColorStop(0, '#2a0d14');
    hullGradient.addColorStop(0.5, '#ef4444');
    hullGradient.addColorStop(1, '#fecaca');
  } else {
    hullGradient.addColorStop(0, '#0f172a');
    hullGradient.addColorStop(0.5, '#475569');
    hullGradient.addColorStop(1, '#cbd5e1');
  }

  ctx.fillStyle = hullGradient;
  ctx.strokeStyle = '#0b1020';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ENEMY_RADIUS, 0);
  ctx.lineTo(ENEMY_RADIUS * 0.4, -ENEMY_RADIUS * 0.5);
  ctx.lineTo(-ENEMY_RADIUS * 0.8, -ENEMY_RADIUS * 0.35);
  ctx.lineTo(-ENEMY_RADIUS * 0.8, ENEMY_RADIUS * 0.35);
  ctx.lineTo(ENEMY_RADIUS * 0.4, ENEMY_RADIUS * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = alarmActive ? '#fee2e2' : '#dbeafe';
  ctx.beginPath();
  ctx.arc(ENEMY_RADIUS * 0.45, 0, ENEMY_RADIUS * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawInteriorBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, viewportWidth, viewportHeight);
  gradient.addColorStop(0, '#080d18');
  gradient.addColorStop(0.5, '#0f172a');
  gradient.addColorStop(1, '#101d2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  for (const star of stars) {
    let x = star.x - camera.x * star.parallaxLayer * 0.35;
    let y = star.y - camera.y * star.parallaxLayer * 0.35;

    x = (((x % (viewportWidth + 220)) + (viewportWidth + 220)) % (viewportWidth + 220)) - 110;
    y = (((y % (viewportHeight + 220)) + (viewportHeight + 220)) % (viewportHeight + 220)) - 110;

    if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) {
      continue;
    }

    const alpha = 0.2 + Math.sin(star.twinklePhase) * 0.18;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, star.size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const panelSize = 110;
  const panelOffsetX = ((-camera.x % panelSize) + panelSize) % panelSize;
  const panelOffsetY = ((-camera.y % panelSize) + panelSize) % panelSize;
  ctx.strokeStyle = 'rgba(120, 145, 180, 0.08)';
  ctx.lineWidth = 1;
  for (let x = panelOffsetX; x < viewportWidth; x += panelSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewportHeight);
    ctx.stroke();
  }
  for (let y = panelOffsetY; y < viewportHeight; y += panelSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewportWidth, y);
    ctx.stroke();
  }
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Rect): void {
  const gradient = ctx.createLinearGradient(
    wall.x,
    wall.y,
    wall.x + wall.width,
    wall.y + wall.height,
  );
  gradient.addColorStop(0, '#28364a');
  gradient.addColorStop(1, '#162031');

  ctx.fillStyle = gradient;
  ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  ctx.strokeStyle = 'rgba(180, 200, 230, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
}

export class ShipInteriorScene implements Scene {
  private camera: Camera = { x: 0, y: 0 };
  private enemies: Enemy[] = [];
  private alarmActive = false;
  private alarmLastSeenAt = 0;
  private audioContext: AudioContext | null = null;
  private nextAlarmBeepAt = 0;
  private readonly spriteRenderer = new ShipInteriorSpriteRenderer();
  private levelStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private levelLoadError: string | null = null;

  private updateCamera(): void {
    const currentPlayer = player;
    if (!currentPlayer) {
      return;
    }

    const viewportWidth = getGameWidth();
    const viewportHeight = getGameHeight();
    this.camera.x = clamp(
      currentPlayer.x - viewportWidth / 2,
      0,
      Math.max(0, activeLevel.width - viewportWidth),
    );
    this.camera.y = clamp(
      currentPlayer.y - viewportHeight / 2,
      0,
      Math.max(0, activeLevel.height - viewportHeight),
    );
  }

  private spawnPlayer(currentPlayer: Player): void {
    const spawn = activeLevel.playerSpawn ?? { x: 210, y: 210 };
    currentPlayer.x = spawn.x;
    currentPlayer.y = spawn.y;
    currentPlayer.vx = 0;
    currentPlayer.vy = 0;
    currentPlayer.angle = 0;
    currentPlayer.turretAngle = 0;
  }

  private spawnEnemies(): void {
    this.enemies = activeLevel.patrollers
      .filter((patroller) => patroller.patrol.length > 0)
      .map((patroller) => {
        const patrolA = patroller.patrol[0];
        const patrolB = patroller.patrol[1] ?? patroller.patrol[0];
        return {
          x: patroller.x,
          y: patroller.y,
          patrolA,
          patrolB,
          targetA: false,
          facing: Math.atan2(patrolB.y - patroller.y, patrolB.x - patroller.x),
          desiredFacing: Math.atan2(patrolB.y - patroller.y, patrolB.x - patroller.x),
          visionRange: ENEMY_FOV_RANGE,
          visionHalfAngle: ENEMY_FOV_HALF_ANGLE,
          alive: true,
        };
      });
  }

  private pushCircleOutOfWall(
    entity: { x: number; y: number; vx: number; vy: number },
    radius: number,
    wall: Rect,
    bounceFactor: number,
  ): boolean {
    const nearestX = clamp(entity.x, wall.x, wall.x + wall.width);
    const nearestY = clamp(entity.y, wall.y, wall.y + wall.height);
    let dx = entity.x - nearestX;
    let dy = entity.y - nearestY;
    const distSq = dx * dx + dy * dy;

    if (distSq >= radius * radius) {
      return false;
    }

    let nx = 0;
    let ny = 0;
    let penetration = radius;

    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      nx = dx / dist;
      ny = dy / dist;
      penetration = radius - dist;
    } else {
      const left = Math.abs(entity.x - wall.x);
      const right = Math.abs(wall.x + wall.width - entity.x);
      const top = Math.abs(entity.y - wall.y);
      const bottom = Math.abs(wall.y + wall.height - entity.y);
      const minOverlap = Math.min(left, right, top, bottom);

      if (minOverlap === left) nx = -1;
      else if (minOverlap === right) nx = 1;
      else if (minOverlap === top) ny = -1;
      else ny = 1;
    }

    entity.x += nx * penetration;
    entity.y += ny * penetration;

    const alongNormal = entity.vx * nx + entity.vy * ny;
    if (alongNormal < 0) {
      entity.vx -= (1 + bounceFactor) * alongNormal * nx;
      entity.vy -= (1 + bounceFactor) * alongNormal * ny;
    }

    return true;
  }

  private resolvePlayerWallCollision(currentPlayer: Player): void {
    const radius = currentPlayer.shieldActive ? SHIELD_RADIUS : currentPlayer.getRadius();
    let collided = false;
    for (const wall of getAllWalls()) {
      if (this.pushCircleOutOfWall(currentPlayer, radius, wall, PLAYER_WALL_BOUNCE)) {
        collided = true;
      }
    }
    if (collided) {
      currentPlayer.vx *= PLAYER_WALL_DAMPING;
      currentPlayer.vy *= PLAYER_WALL_DAMPING;
    }
  }

  private updateEnemies(currentPlayer: Player, now: number): void {
    let playerSeen = false;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const target = enemy.targetA ? enemy.patrolA : enemy.patrolB;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 6) {
        enemy.targetA = !enemy.targetA;
      } else {
        enemy.desiredFacing = Math.atan2(dy, dx);
        enemy.facing = rotateTowardsAngle(enemy.facing, enemy.desiredFacing, ENEMY_TURN_SPEED);

        const turnDelta = Math.abs(normalizeAngle(enemy.desiredFacing - enemy.facing));
        const moveScale = Math.max(0, Math.cos(turnDelta));
        const moveX = Math.cos(enemy.facing) * ENEMY_SPEED * moveScale;
        const moveY = Math.sin(enemy.facing) * ENEMY_SPEED * moveScale;
        const nextX = enemy.x + moveX;
        const nextY = enemy.y + moveY;

        if (
          !pathBlockedByWall(enemy.x, enemy.y, nextX, nextY, ENEMY_RADIUS) &&
          !intersectsWall(nextX, nextY, ENEMY_RADIUS)
        ) {
          enemy.x = nextX;
          enemy.y = nextY;
        } else {
          enemy.targetA = !enemy.targetA;
          const nextTarget = enemy.targetA ? enemy.patrolA : enemy.patrolB;
          enemy.desiredFacing = Math.atan2(nextTarget.y - enemy.y, nextTarget.x - enemy.x);
        }
      }

      if (currentPlayer.waitingToRespawn || currentPlayer.invulnerable) {
        continue;
      }

      const toPlayerX = currentPlayer.x - enemy.x;
      const toPlayerY = currentPlayer.y - enemy.y;
      const playerDistance = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
      if (playerDistance > enemy.visionRange) {
        continue;
      }

      const playerAngle = Math.atan2(toPlayerY, toPlayerX);
      const delta = normalizeAngle(playerAngle - enemy.facing);
      if (Math.abs(delta) > enemy.visionHalfAngle) {
        continue;
      }

      if (!hasLineOfSight(enemy.x, enemy.y, currentPlayer.x, currentPlayer.y)) {
        continue;
      }

      playerSeen = true;
    }

    if (playerSeen) {
      this.alarmActive = true;
      this.alarmLastSeenAt = now;
    } else if (this.alarmActive && now - this.alarmLastSeenAt > ALARM_HOLD_MS) {
      this.alarmActive = false;
    }
  }

  private playAlarmBeep(now: number): void {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextCtor();
    }

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;

    const start = this.audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start(start);
    osc.stop(start + 0.14);

    this.nextAlarmBeepAt = now + 360;
  }

  private processBulletCollisions(currentPlayer: Player): void {
    for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
      const bullet = bullets[bulletIndex];
      const expired = Date.now() - bullet.spawnTime >= bullet.lifetime;
      if (expired || intersectsWall(bullet.x, bullet.y, BULLET_RADIUS)) {
        bullets.splice(bulletIndex, 1);
        continue;
      }

      let enemyHit = false;
      for (const enemy of this.enemies) {
        if (!enemy.alive) {
          continue;
        }

        if (distance(bullet.x, bullet.y, enemy.x, enemy.y) > BULLET_RADIUS + ENEMY_RADIUS) {
          continue;
        }

        enemy.alive = false;
        enemyHit = true;
        currentPlayer.score += 150;
        createExplosion(enemy.x, enemy.y, 0.9, bullet.vx * 0.1, bullet.vy * 0.1);
        break;
      }

      if (enemyHit) {
        bullets.splice(bulletIndex, 1);
      }
    }
  }

  private async loadLevel(): Promise<void> {
    this.levelStatus = 'loading';
    this.levelLoadError = null;

    try {
      activeLevel = await loadShipInteriorLevel();
      this.spawnEnemies();

      const currentPlayer = player;
      if (currentPlayer) {
        this.spawnPlayer(currentPlayer);
        this.updateCamera();
      }

      this.levelStatus = 'ready';
    } catch (error) {
      activeLevel = EMPTY_LEVEL;
      this.enemies = [];
      this.levelStatus = 'error';
      this.levelLoadError = error instanceof Error ? error.message : 'Unknown level load error.';
    }
  }

  enter(): void {
    resetState();
    gameState.restartScene = 'shipinterior';
    this.alarmActive = false;
    this.alarmLastSeenAt = 0;
    this.nextAlarmBeepAt = 0;
    this.levelStatus = 'idle';
    this.levelLoadError = null;
    this.enemies = [];
    activeLevel = EMPTY_LEVEL;

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
    currentPlayer.invulnerable = true;
    currentPlayer.invulnerableUntil = Date.now() + 2500;
    currentPlayer.respawnTime = 0;
    void this.loadLevel();
  }

  update(_deltaTime: number): void {
    const now = Date.now();
    const deltaTime = 16;
    const currentPlayer = player;
    if (!gameState.baseAlphaMask || !currentPlayer) {
      return;
    }

    if (this.levelStatus !== 'ready') {
      return;
    }

    updateBackground(deltaTime);
    this.updateCamera();
    updateScenePlayer(currentPlayer, this.camera);
    this.resolvePlayerWallCollision(currentPlayer);
    this.updateEnemies(currentPlayer, now);
    if (this.alarmActive && now >= this.nextAlarmBeepAt) {
      this.playAlarmBeep(now);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      updateBullet(bullets[i]);
      if (
        bullets[i].x < -200 ||
        bullets[i].x > activeLevel.width + 200 ||
        bullets[i].y < -200 ||
        bullets[i].y > activeLevel.height + 200
      ) {
        bullets.splice(i, 1);
      }
    }

    this.processBulletCollisions(currentPlayer);

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      updateThrusterParticle(thrusterParticles[i], deltaTime);
      if (thrusterParticles[i].lifetime <= 0) {
        thrusterParticles.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      updateParticleNoWrap(particles[i], deltaTime);
      if (particles[i].lifetime <= 0) {
        particles.splice(i, 1);
      }
    }

    this.updateCamera();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const width = getGameWidth();
    const height = getGameHeight();
    const now = Date.now();

    drawInteriorBackground(ctx, this.camera, width, height);

    if (this.levelStatus === 'loading' || this.levelStatus === 'idle') {
      ctx.fillStyle = 'rgba(8, 13, 24, 0.8)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#dbeafe';
      ctx.font = '28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading ship interior level...', width / 2, height / 2);
      return;
    }

    if (this.levelStatus === 'error') {
      ctx.fillStyle = 'rgba(40, 10, 16, 0.88)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fecaca';
      ctx.font = '26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Failed to load ship interior level', width / 2, height / 2 - 22);
      ctx.font = '16px monospace';
      ctx.fillText(this.levelLoadError ?? 'Unknown error', width / 2, height / 2 + 14);
      return;
    }

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    for (const enemy of this.enemies) {
      if (enemy.alive) {
        drawPlayerVisionCone(ctx, enemy, this.alarmActive, now);
      }
    }

    const drewLayers = this.spriteRenderer.drawLayers(ctx, activeLevel.layers);
    if (!drewLayers) {
      for (const wall of getAllWalls()) {
        drawWall(ctx, wall);
      }
    }

    for (const bullet of bullets) {
      drawBullet(bullet, ctx);
    }

    for (const enemy of this.enemies) {
      if (enemy.alive) {
        drawEnemy(ctx, enemy, this.alarmActive);
      }
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      drawThrusterParticle(thrusterParticles[i], ctx);
    }

    if (player && !player.waitingToRespawn) {
      drawPlayer(player, ctx);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      drawOneParticle(particles[i], ctx);
    }

    ctx.restore();

    if (this.alarmActive) {
      const pulse = 0.6 + Math.sin(now * 0.02) * 0.4;
      ctx.fillStyle = `rgba(255, 50, 60, ${0.1 + pulse * 0.08})`;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ff6472';
      ctx.font = 'bold 38px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('ALARM: INTRUDER DETECTED', width / 2, 18);
    }

    const currentPlayer = player;
    if (currentPlayer) {
      const remainingEnemies = this.enemies.filter((enemy) => enemy.alive).length;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '20px monospace';
      ctx.fillStyle = currentPlayer.color;
      ctx.fillText('Ship Interior', 20, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(`x${currentPlayer.lives} ${'♥'.repeat(currentPlayer.lives)}`, 170, 20);
      ctx.fillText(`Score: ${currentPlayer.score}`, 170, 45);
      ctx.fillText(`Guards: ${remainingEnemies}`, 170, 70);
      ctx.fillStyle = '#8aa0be';
      ctx.fillText(
        `${Math.round(currentPlayer.x)}, ${Math.round(currentPlayer.y)} / ${activeLevel.width} x ${activeLevel.height}`,
        20,
        height - 30,
      );
    }
  }

  exit(): void {}
}
