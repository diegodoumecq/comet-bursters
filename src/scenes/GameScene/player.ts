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
import { bullets, gameState, getGameHeight, getGameWidth, players } from '@/state';
import { createThrusterParticle } from './particle';

export function createPlayer(padId: string, colorIndex: number): Player {
  const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
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

  ctx.fillStyle = player.color;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE, 0);
  ctx.lineTo(PLAYER_SIZE * 0.3, -PLAYER_SIZE * 0.15);
  ctx.lineTo(-PLAYER_SIZE * 0.3, -PLAYER_SIZE * 0.5);
  ctx.lineTo(-PLAYER_SIZE * 0.6, -PLAYER_SIZE * 0.4);
  ctx.lineTo(-PLAYER_SIZE * 0.8, -PLAYER_SIZE * 0.15);
  ctx.lineTo(-PLAYER_SIZE * 0.5, -PLAYER_SIZE * 0.15);
  ctx.lineTo(-PLAYER_SIZE * 0.6, PLAYER_SIZE * 0.15);
  ctx.lineTo(-PLAYER_SIZE * 0.8, PLAYER_SIZE * 0.15);
  ctx.lineTo(-PLAYER_SIZE * 0.6, PLAYER_SIZE * 0.4);
  ctx.lineTo(-PLAYER_SIZE * 0.3, PLAYER_SIZE * 0.5);
  ctx.lineTo(PLAYER_SIZE * 0.3, PLAYER_SIZE * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.rotate(player.turretAngle - Math.PI / 2);

  ctx.fillStyle = '#333';
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_SIZE * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(PLAYER_SIZE * 0.1, -PLAYER_SIZE * 0.08);
  ctx.lineTo(PLAYER_SIZE * 0.6, -PLAYER_SIZE * 0.05);
  ctx.lineTo(PLAYER_SIZE * 0.65, 0);
  ctx.lineTo(PLAYER_SIZE * 0.6, PLAYER_SIZE * 0.05);
  ctx.lineTo(PLAYER_SIZE * 0.1, PLAYER_SIZE * 0.08);
  ctx.closePath();
  ctx.fillStyle = '#555';
  ctx.fill();
  ctx.stroke();

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

export function bouncePlayers() {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i];
      const p2 = players[j];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = PLAYER_SIZE * 1.5;

      if (dist < minDist && dist > 0) {
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;

        p1.x -= nx * overlap;
        p1.y -= ny * overlap;
        p2.x += nx * overlap;
        p2.y += ny * overlap;
      }
    }
  }
}
