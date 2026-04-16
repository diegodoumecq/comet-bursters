import { createQueryModule } from 'joymap';

import { scaleMask } from '@/assets';
import {
  BULLET_CONFIGS,
  INVULNERABILITY_DURATION,
  PLAYER_ACCELERATION,
  PLAYER_COLORS,
  PLAYER_MAX_SPEED,
  PLAYER_SIZE,
  SHIELD_COLOR,
  SHIELD_MAX_HITS,
  SHIELD_RADIUS,
  STARTING_LIVES,
  THRUSTER_PARTICLE_SPAWN_INTERVAL,
  type Player,
} from '@/constants';
import { InputManager } from '@/input';
import { bullets, gameState, getGameHeight, getGameWidth } from '@/state';
import { createThrusterParticle } from './particle';

export function createPlayer(padId: string): Player {
  const color = PLAYER_COLORS[0];
  const width = getGameWidth();
  const height = getGameHeight();
  return {
    id: padId,
    x: Math.random() * width,
    y: Math.random() * height,
    vx: 0,
    vy: 0,
    angle: 0,
    turretAngle: 0,
    lives: STARTING_LIVES,
    score: 0,
    color,
    invulnerable: true,
    invulnerableUntil: Date.now() + INVULNERABILITY_DURATION,
    respawnTime: 0,
    waitingToRespawn: false,
    shieldHits: SHIELD_MAX_HITS,
    shieldActive: false,
    shieldHitUntil: 0,
    module: createQueryModule({
      padId: padId === 'keyboard' ? undefined : padId,
      autoConnect: padId === 'keyboard',
    }),
    mask: scaleMask(gameState.baseAlphaMask!, PLAYER_SIZE / 150),
    timeoutSmall: Date.now(),
    timeoutBlackHole: Date.now(),
    timeoutPusher: Date.now(),
    timeoutShotgun: Date.now(),
    lastThrusterSpawn: 0,
    isThrusting: false,
    thrustDirX: 0,
    thrustDirY: 0,
    getRadius: () => PLAYER_SIZE * 0.6,
  };
}

export function updatePlayer(player: Player) {
  const now = Date.now();

  if (player.waitingToRespawn) {
    return;
  }

  const input = InputManager.getInputState(player.module, player.x, player.y);

  player.shieldActive = input.shield.pressed && player.shieldHits > 0;

  if (input.move.value[0] !== 0 || input.move.value[1] !== 0) {
    player.angle = Math.atan2(input.move.value[1], input.move.value[0]) + Math.PI * 0.5;
    player.vx += input.move.value[0] * PLAYER_ACCELERATION;
    player.vy += input.move.value[1] * PLAYER_ACCELERATION;
  }

  const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  if (currentSpeed > PLAYER_MAX_SPEED) {
    const scale = PLAYER_MAX_SPEED / currentSpeed;
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

  const width = getGameWidth();
  const height = getGameHeight();
  if (player.x < 0) player.x = width;
  if (player.x > width) player.x = 0;
  if (player.y < 0) player.y = height;
  if (player.y > height) player.y = 0;

  const lSpeed = Math.sqrt(
    input.move.value[0] * input.move.value[0] + input.move.value[1] * input.move.value[1],
  );
  player.isThrusting = lSpeed > 0.1;
  if (lSpeed > 0.1) {
    player.thrustDirX = -input.move.value[0] / lSpeed;
    player.thrustDirY = -input.move.value[1] / lSpeed;
    if (now - player.lastThrusterSpawn >= THRUSTER_PARTICLE_SPAWN_INTERVAL) {
      player.lastThrusterSpawn = now;
      const thrusterX = player.x + player.thrustDirX * PLAYER_SIZE;
      const thrusterY = player.y + player.thrustDirY * PLAYER_SIZE;
      createThrusterParticle(thrusterX, thrusterY, player.thrustDirX, player.thrustDirY);
    }
  }

  if (
    !player.shieldActive &&
    input.fire.pressed &&
    now - player.timeoutSmall >= BULLET_CONFIGS.small.fireRate
  ) {
    player.timeoutSmall = now;
    createBullet(player, 'small');
    const recoil = BULLET_CONFIGS.small.recoil;
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * recoil;
    player.vy += Math.sin(recoilAngle) * recoil;
  }

  if (
    !player.shieldActive &&
    input.chaosFire.pressed &&
    now - player.timeoutShotgun >= BULLET_CONFIGS.shotgun.fireRate
  ) {
    player.timeoutShotgun = now;
    createBullet(player, 'shotgun');
    const recoil = BULLET_CONFIGS.shotgun.recoil;
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * recoil;
    player.vy += Math.sin(recoilAngle) * recoil;
    createBullet(player, 'shotgun');
  }

  if (
    !player.shieldActive &&
    input.fireSpecial.pressed &&
    now - player.timeoutPusher >= BULLET_CONFIGS.pusher.fireRate
  ) {
    player.timeoutPusher = now;
    createBullet(player, 'pusher');
    const recoil = BULLET_CONFIGS.pusher.recoil;
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * recoil;
    player.vy += Math.sin(recoilAngle) * recoil;
  }

  if (
    !player.shieldActive &&
    input.fireReallyHard.pressed &&
    now - player.timeoutBlackHole >= BULLET_CONFIGS.blackHole.fireRate
  ) {
    player.timeoutBlackHole = now;
    createBullet(player, 'blackHole');
    const recoil = BULLET_CONFIGS.blackHole.recoil;
    const recoilAngle = player.turretAngle + Math.PI * 0.5;
    player.vx += Math.cos(recoilAngle) * recoil;
    player.vy += Math.sin(recoilAngle) * recoil;
  }

  if (player.invulnerable && now >= player.invulnerableUntil) {
    player.invulnerable = false;
  }
}

function createBullet(player: Player, type: 'small' | 'blackHole' | 'pusher' | 'shotgun') {
  const config = BULLET_CONFIGS[type];
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

function drawOnePlayer(player: Player, ctx: CanvasRenderingContext2D) {
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

export function drawPlayer(player: Player, ctx: CanvasRenderingContext2D) {
  const width = getGameWidth();
  const height = getGameHeight();

  drawOnePlayer(player, ctx);

  const nearLeft = player.x < PLAYER_SIZE;
  const nearRight = player.x > width - PLAYER_SIZE;
  const nearTop = player.y < PLAYER_SIZE;
  const nearBottom = player.y > height - PLAYER_SIZE;

  if (nearLeft) {
    drawOnePlayer({ ...player, x: player.x + width }, ctx);
  }
  if (nearRight) {
    drawOnePlayer({ ...player, x: player.x - width }, ctx);
  }
  if (nearTop) {
    drawOnePlayer({ ...player, y: player.y + height }, ctx);
  }
  if (nearBottom) {
    drawOnePlayer({ ...player, y: player.y - height }, ctx);
  }
  if (nearLeft && nearTop) {
    drawOnePlayer({ ...player, x: player.x + width, y: player.y + height }, ctx);
  }
  if (nearRight && nearTop) {
    drawOnePlayer({ ...player, x: player.x - width, y: player.y + height }, ctx);
  }
  if (nearLeft && nearBottom) {
    drawOnePlayer({ ...player, x: player.x + width, y: player.y - height }, ctx);
  }
  if (nearRight && nearBottom) {
    drawOnePlayer({ ...player, x: player.x - width, y: player.y - height }, ctx);
  }
}
