import {
  ASTEROID_CONFIGS,
  ASTEROID_FUEL_DROP_CHANCES,
  ASTEROID_FUEL_DROP_MAX_BLOBS,
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_ATTRACTION_ACCELERATION,
  FUEL_BLOB_ATTRACTION_RADIUS,
  FUEL_BLOB_DRAG,
  FUEL_BLOB_MAX_SPEED,
  FUEL_BLOB_RADIUS,
  STARTING_LIVES,
  TRACTOR_BEAM_LOCK_DISTANCE,
  TRACTOR_BEAM_MAX_TARGET_SPEED,
  TRACTOR_BEAM_PULL,
  TRACTOR_BEAM_RANGE,
  type Asteroid,
  type Player,
} from '@/constants';
import { InputManager } from '@/input';
import { joymap } from '@/joymap';
import { refillRespawnResources } from '@/playerFuel';
import { sceneManager } from '@/sceneManager';
import {
  asteroids,
  bullets,
  gameState,
  getGameCenterX,
  getGameCenterY,
  getGameHeight,
  getGameWidth,
  particles,
  player,
  resetState,
  screenShake,
  setPlayer,
  thrusterParticles,
  type PlayableSceneName,
} from '@/state';
import {
  disposeFuelMetaballs,
  initFuelMetaballs,
  renderFuelMetaballs,
  resizeFuelMetaballs,
  type FuelMetaball,
} from '../SandboxScene/fuelMetaballs';
import type { Scene } from '../scene';
import { drawAsteroid, spawnWave, splitAsteroid, updateAsteroid } from './asteroid';
import { drawBackground, updateBackground } from './background';
import { drawBullet, isBulletExpired, updateBullet } from './bullet';
import { processBulletAsteroidCollisions, processPlayerAsteroidCollisions } from './collision';
import {
  createExplosion,
  createExplosionBurst,
  createShipDebris,
  drawParticle,
  drawThrusterParticle,
  updateParticle,
  updateThrusterParticle,
} from './particle';
import { createPlayer, drawPlayer, incrementRespawnCount, updatePlayer } from './player';
import { rumbleDeath } from './rumble';
import { dispose, initShader, renderWithShaders, updateBlackHoles } from './shader';

type DroppedFuelBlob = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobbleSeed: number;
};

export class GameScene implements Scene {
  private canvas: HTMLCanvasElement | null = null;
  private droppedFuelBlobs: DroppedFuelBlob[] = [];
  private tractorTarget: Asteroid | null = null;
  private readonly restartScene: PlayableSceneName;

  constructor(options: { restartScene?: PlayableSceneName } = {}) {
    this.restartScene = options.restartScene ?? 'game';
  }

  private placePlayerSafely(currentPlayer: NonNullable<typeof player>): void {
    currentPlayer.x = Math.random() * getGameWidth();
    currentPlayer.y = Math.random() * getGameHeight();
  }

  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  resize(): void {
    if (gameState.gameSize && this.canvas) {
      dispose();
      initShader(this.canvas);
      resizeFuelMetaballs(gameState.gameSize.width, gameState.gameSize.height);
    }
  }

  private spawnAsteroidFuelDrops(asteroid: Asteroid, now: number): void {
    if (asteroid.size === 'small') {
      return;
    }

    if (Math.random() > ASTEROID_FUEL_DROP_CHANCES[asteroid.size]) {
      return;
    }

    const maxBlobs = ASTEROID_FUEL_DROP_MAX_BLOBS[asteroid.size];
    const count = 1 + Math.floor(Math.random() * maxBlobs);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const scatter = 10 + Math.random() * Math.max(18, asteroid.getRadius() * 0.35);
      this.droppedFuelBlobs.push({
        id: `game-drop-${now}-${asteroid.x}-${asteroid.y}-${i}`,
        x: asteroid.x + Math.cos(angle) * scatter,
        y: asteroid.y + Math.sin(angle) * scatter,
        vx: Math.cos(angle) * 0.35 + asteroid.vx * 0.12,
        vy: Math.sin(angle) * 0.35 + asteroid.vy * 0.12,
        wobbleSeed: Math.random(),
      });
    }
  }

  private updateDroppedFuel(): void {
    const currentPlayer = player;
    const width = getGameWidth();
    const height = getGameHeight();

    for (let i = this.droppedFuelBlobs.length - 1; i >= 0; i--) {
      const blob = this.droppedFuelBlobs[i];
      if (
        currentPlayer &&
        !currentPlayer.waitingToRespawn &&
        currentPlayer.fuel < currentPlayer.maxFuel
      ) {
        const dx = currentPlayer.x - blob.x;
        const dy = currentPlayer.y - blob.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && dist < FUEL_BLOB_ATTRACTION_RADIUS) {
          const pull = 1 - dist / FUEL_BLOB_ATTRACTION_RADIUS;
          blob.vx += (dx / dist) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull);
          blob.vy += (dy / dist) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull);
        }
      }

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

      if (blob.x < 0) blob.x = width;
      if (blob.x > width) blob.x = 0;
      if (blob.y < 0) blob.y = height;
      if (blob.y > height) blob.y = 0;

      if (
        currentPlayer &&
        !currentPlayer.waitingToRespawn &&
        currentPlayer.fuel < currentPlayer.maxFuel
      ) {
        const dx = currentPlayer.x - blob.x;
        const dy = currentPlayer.y - blob.y;
        if (Math.sqrt(dx * dx + dy * dy) <= currentPlayer.getRadius() + FUEL_BLOB_RADIUS) {
          currentPlayer.fuel = Math.min(
            currentPlayer.maxFuel,
            currentPlayer.fuel + FUEL_BLOB_AMOUNT,
          );
          this.droppedFuelBlobs.splice(i, 1);
        }
      }
    }
  }

  private applyTractorBeam(currentPlayer: Player): void {
    const input = InputManager.getInputState(currentPlayer.module, currentPlayer.x, currentPlayer.y);
    if (!input.tractor.pressed || currentPlayer.fuel <= 0 || currentPlayer.waitingToRespawn) {
      this.tractorTarget = null;
      return;
    }

    if (
      !this.tractorTarget ||
      !asteroids.includes(this.tractorTarget) ||
      Math.hypot(this.tractorTarget.x - currentPlayer.x, this.tractorTarget.y - currentPlayer.y) >
        TRACTOR_BEAM_RANGE
    ) {
      this.tractorTarget =
        asteroids
          .filter(
            (asteroid) =>
              Math.hypot(asteroid.x - currentPlayer.x, asteroid.y - currentPlayer.y) <=
              TRACTOR_BEAM_RANGE,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - currentPlayer.x, a.y - currentPlayer.y) -
              Math.hypot(b.x - currentPlayer.x, b.y - currentPlayer.y),
          )[0] ?? null;
    }

    const target = this.tractorTarget;
    if (!target) {
      return;
    }

    const dx = currentPlayer.x - target.x;
    const dy = currentPlayer.y - target.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist;
    const ny = dy / dist;
    const lockError = dist - TRACTOR_BEAM_LOCK_DISTANCE;
    target.vx += nx * lockError * 0.012 + currentPlayer.vx * 0.035;
    target.vy += ny * lockError * 0.012 + currentPlayer.vy * 0.035;
    if (dist > TRACTOR_BEAM_LOCK_DISTANCE) {
      target.vx += nx * TRACTOR_BEAM_PULL;
      target.vy += ny * TRACTOR_BEAM_PULL;
    }

    const speed = Math.hypot(target.vx, target.vy);
    if (speed > TRACTOR_BEAM_MAX_TARGET_SPEED) {
      target.vx = (target.vx / speed) * TRACTOR_BEAM_MAX_TARGET_SPEED;
      target.vy = (target.vy / speed) * TRACTOR_BEAM_MAX_TARGET_SPEED;
    }
  }

  private resolveAsteroidCollisions(): void {
    for (let i = 0; i < asteroids.length; i += 1) {
      for (let j = i + 1; j < asteroids.length; j += 1) {
        const a = asteroids[i];
        const b = asteroids[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(0.001, Math.hypot(dx, dy));
        const minDist = a.getRadius() + b.getRadius();
        if (dist >= minDist) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const totalMass = a.mass + b.mass;
        a.x -= nx * overlap * (b.mass / totalMass);
        a.y -= ny * overlap * (b.mass / totalMass);
        b.x += nx * overlap * (a.mass / totalMass);
        b.y += ny * overlap * (a.mass / totalMass);

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velocityAlongNormal = rvx * nx + rvy * ny;
        if (velocityAlongNormal > 0) continue;

        const impulse = (-(1.05) * velocityAlongNormal) / (1 / a.mass + 1 / b.mass);
        a.vx -= (impulse / a.mass) * nx;
        a.vy -= (impulse / a.mass) * ny;
        b.vx += (impulse / b.mass) * nx;
        b.vy += (impulse / b.mass) * ny;
      }
    }
  }

  private drawTractorBeam(ctx: CanvasRenderingContext2D): void {
    const currentPlayer = player;
    const target = this.tractorTarget;
    if (!currentPlayer || !target || currentPlayer.waitingToRespawn) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(100, 235, 255, 0.72)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(currentPlayer.x, currentPlayer.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(210, 255, 255, 0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(currentPlayer.x, currentPlayer.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.restore();
  }

  private collectFuelMetaballs(now: number): FuelMetaball[] {
    const width = getGameWidth();
    const height = getGameHeight();
    return this.droppedFuelBlobs.flatMap((blob) => {
      const wobble = Math.sin(now * 0.004 + blob.wobbleSeed * Math.PI * 2) * 3;
      const y = blob.y + wobble;
      if (
        blob.x + FUEL_BLOB_RADIUS * 3 < 0 ||
        blob.x - FUEL_BLOB_RADIUS * 3 > width ||
        y + FUEL_BLOB_RADIUS * 3 < 0 ||
        y - FUEL_BLOB_RADIUS * 3 > height
      ) {
        return [];
      }

      return [
        {
          x: blob.x,
          y,
          radius: FUEL_BLOB_RADIUS,
          seed: blob.wobbleSeed,
        },
      ];
    });
  }

  enter(): void {
    resetState();
    gameState.restartScene = this.restartScene;
    gameState.currentWave = gameState.startingWave;
    this.droppedFuelBlobs = [];
    this.tractorTarget = null;

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
    currentPlayer.shieldHits = 1;
    currentPlayer.shieldActive = false;
    refillRespawnResources(currentPlayer);
    currentPlayer.waitingToRespawn = false;
    currentPlayer.angle = 0;
    currentPlayer.turretAngle = 0;
    this.placePlayerSafely(currentPlayer);
    currentPlayer.vx = 0;
    currentPlayer.vy = 0;
    currentPlayer.invulnerable = true;
    currentPlayer.invulnerableUntil = Date.now() + 3000;
    currentPlayer.respawnTime = 0;

    spawnWave(gameState.currentWave);

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

    if (!gameState.baseAlphaMask) {
      return;
    }

    if (asteroids.length === 0 && !gameState.waveCleared) {
      gameState.waveCleared = true;
      gameState.waveClearTime = now;
    }

    if (gameState.waveCleared && now - gameState.waveClearTime > 2000) {
      gameState.currentWave++;
      spawnWave(gameState.currentWave);
      gameState.waveCleared = false;
    }

    if (asteroids.length === 0 && gameState.currentWave === 1) {
      spawnWave(1);
    }

    const bulletHits = processBulletAsteroidCollisions();
    const handledBullets = new Set<number>();
    const destroyedAsteroids = new Set<Asteroid>();
    for (const { bulletIndex: i, asteroid } of bulletHits) {
      if (handledBullets.has(i)) continue;
      if (destroyedAsteroids.has(asteroid) || !asteroids.includes(asteroid)) continue;
      handledBullets.add(i);

      const bullet = bullets[i];
      if (!bullet) continue;

      const massMultiplier = asteroid.size === 'big' ? 0.3 : asteroid.size === 'medium' ? 0.6 : 1.0;
      const impulse = bullet.impact * 2 * massMultiplier;
      asteroid.vx += bullet.vx * 0.1 * impulse;
      asteroid.vy += bullet.vy * 0.1 * impulse;

      asteroid.hits -= bullet.damage;

      if (asteroid.hits <= 0) {
        const shooter = player?.id === bullet.playerId ? player : null;
        if (shooter) {
          shooter.score += ASTEROID_CONFIGS[asteroid.size].points * shooter.lives;
        }

        const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
        createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
        this.spawnAsteroidFuelDrops(asteroid, now);

        const children = splitAsteroid(asteroid);
        asteroids.push(...children);

        destroyedAsteroids.add(asteroid);
        const asteroidIndex = asteroids.indexOf(asteroid);
        if (asteroidIndex !== -1) {
          asteroids.splice(asteroidIndex, 1);
        }
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (handledBullets.has(i)) {
        bullets.splice(i, 1);
      }
    }

    if (player) {
      updatePlayer(player, deltaTime);
      this.applyTractorBeam(player);
    }
    this.updateDroppedFuel();

    for (const asteroid of asteroids) {
      updateAsteroid(asteroid);
    }
    this.resolveAsteroidCollisions();

    processPlayerAsteroidCollisions((player) => {
      if (player.waitingToRespawn) return;

      player.lives--;
      player.waitingToRespawn = true;
      const debrisVx = player.vx;
      const debrisVy = player.vy;
      player.vx = 0;
      player.vy = 0;
      player.isThrusting = false;
      rumbleDeath(player.module);
      createShipDebris(player.x, player.y, 2, debrisVx, debrisVy, player.color);
      createExplosionBurst(player.x, player.y, 2, player.vx, player.vy);

      player.respawnTime = now + 2000;
    });

    const allWaitingToRespawn = player !== null && player.lives <= 0 && now >= player.respawnTime;

    if (allWaitingToRespawn) {
      sceneManager.transitionTo('gameover');
      gameState.gameOverTime = now;
    } else {
      const currentPlayer = player;
      if (currentPlayer && currentPlayer.waitingToRespawn && now >= currentPlayer.respawnTime) {
        currentPlayer.invulnerable = true;
        currentPlayer.invulnerableUntil = now + 2000;
        this.placePlayerSafely(currentPlayer);
        currentPlayer.vx = 0;
        currentPlayer.vy = 0;
        currentPlayer.shieldHits = 1;
        refillRespawnResources(currentPlayer);
        incrementRespawnCount(currentPlayer);
        currentPlayer.waitingToRespawn = false;
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      if (asteroid.hits <= 0) {
        const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
        createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
        this.spawnAsteroidFuelDrops(asteroid, now);
        const children = splitAsteroid(asteroid);
        asteroids.push(...children);
        asteroids.splice(i, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      updateBullet(bullets[i]);
      if (isBulletExpired(bullets[i])) {
        bullets.splice(i, 1);
      }
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      updateThrusterParticle(thrusterParticles[i], deltaTime);
      if (thrusterParticles[i].lifetime <= 0) {
        thrusterParticles.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      updateParticle(particles[i], deltaTime);
      if (particles[i].lifetime <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const now = Date.now();

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

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground(ctx);

    if (!gameState.baseAlphaMask) {
      ctx.fillStyle = '#4a4a6a';
      ctx.font = '32px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading...', getGameCenterX(), getGameCenterY());
      ctx.restore();
      return;
    }

    for (const bullet of bullets) {
      drawBullet(bullet, ctx);
    }

    for (const asteroid of asteroids) {
      drawAsteroid(asteroid, ctx);
    }
    this.drawTractorBeam(ctx);

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      drawThrusterParticle(thrusterParticles[i], ctx);
    }

    if (player && !player.waitingToRespawn) {
      drawPlayer(player, ctx);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      drawParticle(particles[i], ctx);
    }

    renderFuelMetaballs(ctx, this.collectFuelMetaballs(now), now);

    ctx.font = '20px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const currentPlayer = player;
    if (currentPlayer) {
      const hudX = 20;
      const hudY = 20;

      ctx.fillStyle = currentPlayer.color;
      ctx.fillText('Player', hudX, hudY);

      const remainingTime = Math.max(0, Math.ceil((currentPlayer.respawnTime - now) / 1000));
      if (currentPlayer.lives <= 0) {
        ctx.fillStyle = '#888';
        ctx.fillText(`Waiting... ${remainingTime}s`, hudX + 70, hudY);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillText(`x${currentPlayer.lives} ${'♥'.repeat(currentPlayer.lives)}`, hudX + 70, hudY);
      }
      ctx.fillText(`Score: ${currentPlayer.score}`, hudX + 70, hudY + 25);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    ctx.fillText(`Wave ${gameState.currentWave}`, getGameCenterX(), 20);

    if (this.canvas) {
      const blackHoles = bullets
        .filter((b) => b.type === 'blackHole')
        .map((b) => ({ x: b.x, y: b.y }));
      updateBlackHoles(blackHoles);
      renderWithShaders(this.canvas);
    }

    ctx.restore();
  }

  exit(): void {
    disposeFuelMetaballs();
    dispose();
  }
}
