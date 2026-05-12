import {
  ASTEROID_CONFIGS,
  ASTEROID_FUEL_DROP_CHANCES,
  ASTEROID_FUEL_DROP_MAX_BLOBS,
  BLACK_HOLE_GRAVITY_STRENGTH,
  BLACK_HOLE_RADIUS,
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_ATTRACTION_ACCELERATION,
  FUEL_BLOB_ATTRACTION_RADIUS,
  FUEL_BLOB_DRAG,
  FUEL_BLOB_MAX_SPEED,
  FUEL_BLOB_RADIUS,
  STARTING_LIVES,
  TRACTOR_BEAM_MAX_TARGET_SPEED,
  TRACTOR_BEAM_PULL,
  TRACTOR_BEAM_RANGE,
  PLAYER_SIZE,
  type Asteroid,
  type Bullet,
  type Player,
} from '@/constants';
import { resolveAsteroidCollisions } from '@/asteroidPhysics';
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
  planets,
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
import {
  getBlackHoleRenderRadius,
  getMatureBlackHoleRadius,
  isMatureBlackHole,
} from './blackHole';
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

const TRACTOR_BEAM_HALF_ANGLE = Math.PI / 6;
const TRACTOR_BEAM_MIN_FORWARD_DISTANCE = 0;
const TRACTOR_BEAM_MUZZLE_DISTANCE = PLAYER_SIZE * 0.68;
const TRACTOR_BEAM_GRAVITY_RADIUS = 72;
const TRACTOR_BEAM_GRAVITY_SOFTENING = 36;
const TRACTOR_BEAM_GRAVITY_MAX_ACCELERATION = TRACTOR_BEAM_PULL * 0.9;
const BLACK_HOLE_COLLAPSE_DURATION_MS = 700;
const BLACK_HOLE_ABSORBED_FUEL_BLOBS: Record<Asteroid['size'], number> = {
  small: 1,
  medium: 2,
  big: 4,
  mega: 8,
};

export class GameScene implements Scene {
  private canvas: HTMLCanvasElement | null = null;
  private droppedFuelBlobs: DroppedFuelBlob[] = [];
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

  private absorbAsteroidIntoBlackHole(blackHole: Bullet, asteroid: Asteroid): void {
    blackHole.absorbedFuelBlobs =
      (blackHole.absorbedFuelBlobs ?? 0) + BLACK_HOLE_ABSORBED_FUEL_BLOBS[asteroid.size];

    const shooter = player?.id === blackHole.playerId ? player : null;
    if (shooter) {
      shooter.score += ASTEROID_CONFIGS[asteroid.size].points * shooter.lives;
    }

    const intensity = asteroid.size === 'big' ? 1.2 : asteroid.size === 'medium' ? 0.8 : 0.45;
    createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);

    const asteroidIndex = asteroids.indexOf(asteroid);
    if (asteroidIndex !== -1) {
      asteroids.splice(asteroidIndex, 1);
    }
  }

  private getWrappedDelta(fromX: number, fromY: number, toX: number, toY: number): {
    x: number;
    y: number;
  } {
    const width = getGameWidth();
    const height = getGameHeight();
    let dx = toX - fromX;
    let dy = toY - fromY;

    if (dx > width * 0.5) dx -= width;
    if (dx < -width * 0.5) dx += width;
    if (dy > height * 0.5) dy -= height;
    if (dy < -height * 0.5) dy += height;

    return { x: dx, y: dy };
  }

  private applyBlackHoleGravity(now: number): void {
    const activeBlackHoles = bullets.filter(
      (bullet) =>
        bullet.type === 'blackHole' &&
        !bullet.collapseStartTime &&
        isMatureBlackHole(bullet, now),
    );
    if (activeBlackHoles.length === 0) {
      return;
    }

    for (const blackHole of activeBlackHoles) {
      const radius = getMatureBlackHoleRadius(blackHole, now);
      const gravityRange = radius * 6;
      for (const asteroid of asteroids) {
        const { x: dx, y: dy } = this.getWrappedDelta(
          asteroid.x,
          asteroid.y,
          blackHole.x,
          blackHole.y,
        );
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        if (dist > 0 && dist < gravityRange) {
          const force = (BLACK_HOLE_GRAVITY_STRENGTH * 0.5 * radius * radius) / distSq;
          asteroid.vx += (dx / dist) * force;
          asteroid.vy += (dy / dist) * force;
        }
      }
    }
  }

  private removeBlackHolesCollidingWithPlanets(): void {
    if (planets.length === 0) {
      return;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (bullet.type === 'blackHole') {
        const hitPlanet = planets.some((planet) => {
          const dx = bullet.x - planet.x;
          const dy = bullet.y - planet.y;
          return Math.hypot(dx, dy) <= planet.getRadius() + BLACK_HOLE_RADIUS;
        });
        if (hitPlanet) {
          bullets.splice(i, 1);
        }
      }
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

  private getTractorBeamDirection(currentPlayer: Player): { x: number; y: number } {
    const angle = currentPlayer.turretAngle - Math.PI * 0.5;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  private getTractorMuzzlePosition(
    currentPlayer: Player,
    direction = this.getTractorBeamDirection(currentPlayer),
  ): { x: number; y: number } {
    return {
      x: currentPlayer.x + direction.x * TRACTOR_BEAM_MUZZLE_DISTANCE,
      y: currentPlayer.y + direction.y * TRACTOR_BEAM_MUZZLE_DISTANCE,
    };
  }

  private getTractorBeamGeometry(currentPlayer: Player): {
    direction: { x: number; y: number };
    muzzle: { x: number; y: number };
    gravityPoint: { x: number; y: number };
  } {
    const direction = this.getTractorBeamDirection(currentPlayer);
    const muzzle = this.getTractorMuzzlePosition(currentPlayer, direction);
    return {
      direction,
      muzzle,
      gravityPoint: {
        x: muzzle.x + direction.x * TRACTOR_BEAM_RANGE,
        y: muzzle.y + direction.y * TRACTOR_BEAM_RANGE,
      },
    };
  }

  private isInTractorBeam(
    currentPlayer: Player,
    asteroid: { x: number; y: number },
    direction = this.getTractorBeamDirection(currentPlayer),
  ): boolean {
    const muzzle = this.getTractorMuzzlePosition(currentPlayer, direction);
    const dx = asteroid.x - muzzle.x;
    const dy = asteroid.y - muzzle.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0 || distance > TRACTOR_BEAM_RANGE) {
      return false;
    }

    const forwardDistance = dx * direction.x + dy * direction.y;
    if (forwardDistance < TRACTOR_BEAM_MIN_FORWARD_DISTANCE) {
      return false;
    }

    const angle = Math.acos(Math.max(-1, Math.min(1, forwardDistance / distance)));
    return angle <= TRACTOR_BEAM_HALF_ANGLE;
  }

  private isNearTractorGravityPoint(
    asteroid: { x: number; y: number },
    gravityPoint: { x: number; y: number },
  ): boolean {
    return Math.hypot(asteroid.x - gravityPoint.x, asteroid.y - gravityPoint.y) <=
      TRACTOR_BEAM_GRAVITY_RADIUS;
  }

  private applyTractorBeam(currentPlayer: Player): void {
    const input = InputManager.getInputState(currentPlayer.module, currentPlayer.x, currentPlayer.y);
    if (!input.tractor.pressed || currentPlayer.fuel <= 0 || currentPlayer.waitingToRespawn) {
      return;
    }

    const { direction, gravityPoint } = this.getTractorBeamGeometry(currentPlayer);
    for (const asteroid of asteroids) {
      const affected =
        this.isInTractorBeam(currentPlayer, asteroid, direction) ||
        this.isNearTractorGravityPoint(asteroid, gravityPoint);

      if (affected) {
        const dx = gravityPoint.x - asteroid.x;
        const dy = gravityPoint.y - asteroid.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 0) {
          const softenedDistance = Math.max(distance, TRACTOR_BEAM_GRAVITY_SOFTENING);
          const gravityScale = Math.min(
            TRACTOR_BEAM_GRAVITY_MAX_ACCELERATION,
            (TRACTOR_BEAM_PULL * TRACTOR_BEAM_GRAVITY_RADIUS) / softenedDistance,
          );
          asteroid.vx += (dx / distance) * gravityScale;
          asteroid.vy += (dy / distance) * gravityScale;

          const speed = Math.hypot(asteroid.vx, asteroid.vy);
          if (speed > TRACTOR_BEAM_MAX_TARGET_SPEED) {
            asteroid.vx = (asteroid.vx / speed) * TRACTOR_BEAM_MAX_TARGET_SPEED;
            asteroid.vy = (asteroid.vy / speed) * TRACTOR_BEAM_MAX_TARGET_SPEED;
          }
        }
      }
    }
  }

  private drawTractorBeam(ctx: CanvasRenderingContext2D): void {
    const currentPlayer = player;
    if (!currentPlayer || currentPlayer.waitingToRespawn || currentPlayer.fuel <= 0) {
      return;
    }

    const input = InputManager.getInputState(currentPlayer.module, currentPlayer.x, currentPlayer.y);
    if (!input.tractor.pressed) {
      return;
    }

    ctx.save();
    const { direction, muzzle, gravityPoint } = this.getTractorBeamGeometry(currentPlayer);
    const beamAngle = Math.atan2(direction.y, direction.x);
    const edgeA = beamAngle - TRACTOR_BEAM_HALF_ANGLE;
    const edgeB = beamAngle + TRACTOR_BEAM_HALF_ANGLE;
    const endAX = muzzle.x + Math.cos(edgeA) * TRACTOR_BEAM_RANGE;
    const endAY = muzzle.y + Math.sin(edgeA) * TRACTOR_BEAM_RANGE;
    const endBX = muzzle.x + Math.cos(edgeB) * TRACTOR_BEAM_RANGE;
    const endBY = muzzle.y + Math.sin(edgeB) * TRACTOR_BEAM_RANGE;

    const beamGradient = ctx.createRadialGradient(
      muzzle.x,
      muzzle.y,
      0,
      muzzle.x,
      muzzle.y,
      TRACTOR_BEAM_RANGE,
    );
    beamGradient.addColorStop(0, 'rgba(210, 255, 255, 0.24)');
    beamGradient.addColorStop(0.42, 'rgba(100, 235, 255, 0.14)');
    beamGradient.addColorStop(1, 'rgba(100, 235, 255, 0.02)');
    ctx.fillStyle = beamGradient;
    ctx.beginPath();
    ctx.moveTo(muzzle.x, muzzle.y);
    ctx.lineTo(endAX, endAY);
    ctx.lineTo(endBX, endBY);
    ctx.lineTo(muzzle.x, muzzle.y);
    ctx.fill();

    ctx.strokeStyle = 'rgba(210, 255, 255, 0.28)';
    ctx.lineWidth = 2;
    for (let band = 0.28; band <= 1; band += 0.24) {
      ctx.beginPath();
      ctx.arc(muzzle.x, muzzle.y, TRACTOR_BEAM_RANGE * band, edgeA, edgeB);
      ctx.stroke();
    }

    const focusGradient = ctx.createRadialGradient(
      gravityPoint.x,
      gravityPoint.y,
      0,
      gravityPoint.x,
      gravityPoint.y,
      26,
    );
    focusGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    focusGradient.addColorStop(0.22, 'rgba(210, 255, 255, 0.7)');
    focusGradient.addColorStop(0.58, 'rgba(100, 235, 255, 0.24)');
    focusGradient.addColorStop(1, 'rgba(100, 235, 255, 0)');
    ctx.fillStyle = focusGradient;
    ctx.beginPath();
    ctx.arc(gravityPoint.x, gravityPoint.y, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(210, 255, 255, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gravityPoint.x, gravityPoint.y, 8, 0, Math.PI * 2);
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
      const bullet = bullets[i];
      const canHandleHit =
        Boolean(bullet) &&
        (bullet.type === 'blackHole' || !handledBullets.has(i)) &&
        !destroyedAsteroids.has(asteroid) &&
        asteroids.includes(asteroid);
      if (canHandleHit && bullet) {
        if (bullet.type === 'blackHole') {
          if (!bullet.collapseStartTime) {
            this.absorbAsteroidIntoBlackHole(bullet, asteroid);
            destroyedAsteroids.add(asteroid);
          }
        } else {
          handledBullets.add(i);

          const massMultiplier =
            asteroid.size === 'big' ? 0.3 : asteroid.size === 'medium' ? 0.6 : 1.0;
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
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (handledBullets.has(i)) {
        bullets.splice(i, 1);
      }
    }

    this.removeBlackHolesCollidingWithPlanets();

    if (player) {
      updatePlayer(player, deltaTime);
      this.applyTractorBeam(player);
    }
    this.applyBlackHoleGravity(now);
    this.updateDroppedFuel();

    for (const asteroid of asteroids) {
      updateAsteroid(asteroid);
    }
    resolveAsteroidCollisions(asteroids);

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
      const bullet = bullets[i];
      updateBullet(bullet);
      if (bullet.type === 'blackHole') {
        if (bullet.collapseStartTime && bullet.collapseDuration) {
          if (now - bullet.collapseStartTime >= bullet.collapseDuration) {
            createExplosionBurst(
              bullet.x,
              bullet.y,
              Math.max(0.45, (bullet.absorbedFuelBlobs ?? 0) * 0.08),
              bullet.vx,
              bullet.vy,
            );
            this.spawnFuelBurst(
              bullet.x,
              bullet.y,
              bullet.absorbedFuelBlobs ?? 0,
              now,
              bullet.vx,
              bullet.vy,
            );
            bullets.splice(i, 1);
          }
        } else if (isBulletExpired(bullet)) {
          bullet.collapseStartTime = now;
          bullet.collapseDuration = BLACK_HOLE_COLLAPSE_DURATION_MS;
          bullet.vx = 0;
          bullet.vy = 0;
        }
      } else if (isBulletExpired(bullet)) {
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
        .map((b) => ({ x: b.x, y: b.y, radius: getBlackHoleRenderRadius(b, now) }));
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
