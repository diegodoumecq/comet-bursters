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
  INSPECTION_PROBE_DURATION_MS,
  INSPECTION_PROBE_RADIUS,
  STARTING_LIVES,
  type Asteroid,
  type Particle,
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
  applySavedWeaponSlots,
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
import { configurePlayerEntity, configureProjectileEntity, SceneEntityRegistry } from '../entities';
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
import { spawnWave, splitAsteroid, updateAsteroid } from './asteroid';
import {
  getBlackHoleRenderRadius,
  updateBlackHoleLifecycles,
} from './blackHole';
import { drawBackground, updateBackground } from './background';
import { drawBullet, isBulletExpired, updateBullet } from './bullet';
import { processBulletAsteroidCollisions, processPlayerAsteroidCollisions } from './collision';
import {
  createExplosion,
  createExplosionBurst,
  createShipDebris,
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
  private inspectionProbes: InspectionProbe[] = [];
  private readonly entities = new SceneEntityRegistry();
  private simulationTime = Date.now();
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

  private updateDroppedFuel(deltaScale = 1): void {
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
          blob.vx += (dx / dist) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull) * deltaScale;
          blob.vy += (dy / dist) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull) * deltaScale;
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
      blob.x += blob.vx * deltaScale;
      blob.y += blob.vy * deltaScale;

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

  private applyTractorBeam(currentPlayer: Player, deltaScale = 1): void {
    const input = InputManager.getInputState(currentPlayer.module, currentPlayer.x, currentPlayer.y);
    applyTractorBeamToTargets(currentPlayer, input, asteroids, deltaScale);
  }

  private drawTractorBeam(ctx: CanvasRenderingContext2D): void {
    const currentPlayer = player;
    if (!currentPlayer) {
      return;
    }

    const input = InputManager.getInputState(currentPlayer.module, currentPlayer.x, currentPlayer.y);
    drawTractorBeam(ctx, currentPlayer, input);
  }

  private drawSceneWeaponSelectionMenu(ctx: CanvasRenderingContext2D, currentPlayer: Player): void {
    const input = InputManager.getInputState(currentPlayer.module, currentPlayer.x, currentPlayer.y);
    drawWeaponSelectionMenuIfOpen(ctx, currentPlayer, input);
  }

  private attachPlayerEntity(currentPlayer: Player): void {
    configurePlayerEntity(currentPlayer, (ctx) => {
      if (!currentPlayer.waitingToRespawn) {
        drawPlayer(currentPlayer, ctx);
        this.drawSceneWeaponSelectionMenu(ctx, currentPlayer);
      }
    });
    this.entities.add(currentPlayer);
  }

  private addAsteroids(newAsteroids: Asteroid[]): void {
    for (const asteroid of newAsteroids) this.entities.add(asteroid);
    asteroids.push(...newAsteroids);
  }

  private addParticlesFrom(create: () => Particle[]): void {
    for (const particle of create()) this.entities.add(particle);
  }

  private removeEntity(entity: { id?: string }): void {
    if (entity.id) this.entities.remove(entity.id);
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
    this.entities.clear();
    this.entities.add({
      id: 'tractorBeam',
      entityType: 'tractorBeam',
      zIndex: 30,
      render: (ctx) => this.drawTractorBeam(ctx),
    });
    gameState.restartScene = this.restartScene;
    gameState.currentWave = gameState.startingWave;
    this.droppedFuelBlobs = [];
    this.inspectionProbes = [];

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

    this.attachPlayerEntity(currentPlayer);
    currentPlayer.lives = STARTING_LIVES;
    currentPlayer.score = 0;
    currentPlayer.shieldHits = 1;
    currentPlayer.shieldActive = false;
    applySavedWeaponSlots(currentPlayer);
    refillRespawnResources(currentPlayer);
    currentPlayer.waitingToRespawn = false;
    currentPlayer.angle = 0;
    currentPlayer.turretAngle = 0;
    this.placePlayerSafely(currentPlayer);
    currentPlayer.vx = 0;
    currentPlayer.vy = 0;
    currentPlayer.invulnerable = true;
    this.simulationTime = Date.now();
    currentPlayer.invulnerableUntil = this.simulationTime + 3000;
    currentPlayer.respawnTime = 0;

    for (const asteroid of spawnWave(gameState.currentWave)) this.entities.add(asteroid);

    if (this.canvas) {
      initShader(this.canvas);
      initFuelMetaballs();
    }
  }

  update(deltaTime: number): void {
    const currentPlayer = player;
    const timeStep = currentPlayer
      ? getPlayerTimeDilationStep(
          currentPlayer,
          currentPlayer.x,
          currentPlayer.y,
          deltaTime,
          this.simulationTime,
        )
      : null;
    const deltaScale = timeStep?.deltaScale ?? 1;
    const scaledDeltaTime = timeStep?.scaledDeltaTime ?? deltaTime;
    this.simulationTime = timeStep?.now ?? this.simulationTime + scaledDeltaTime;
    const now = this.simulationTime;
    const realNow = Date.now();

    updateBackground(scaledDeltaTime, now, deltaScale);

    if (screenShake.intensity > 0) {
      const elapsed = realNow - screenShake.startTime;
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
      for (const asteroid of spawnWave(gameState.currentWave)) this.entities.add(asteroid);
      gameState.waveCleared = false;
    }

    if (asteroids.length === 0 && gameState.currentWave === 1) {
      for (const asteroid of spawnWave(1)) this.entities.add(asteroid);
    }

    const bulletHits = processBulletAsteroidCollisions(now);
    const handledBullets = new Set<number>();
    const destroyedAsteroids = new Set<Asteroid>();
    for (const { bulletIndex: i, asteroid } of bulletHits) {
      const bullet = bullets[i];
      const canHandleHit =
        Boolean(bullet) &&
        bullet.type !== 'blackHole' &&
        !handledBullets.has(i) &&
        !destroyedAsteroids.has(asteroid) &&
        asteroids.includes(asteroid);
      if (canHandleHit && bullet) {
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
          this.addParticlesFrom(() => createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy));
          this.spawnAsteroidFuelDrops(asteroid, now);

          const children = splitAsteroid(asteroid);
          this.addAsteroids(children);

          destroyedAsteroids.add(asteroid);
          const asteroidIndex = asteroids.indexOf(asteroid);
          if (asteroidIndex !== -1) {
            this.removeEntity(asteroid);
            asteroids.splice(asteroidIndex, 1);
          }
        }
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (handledBullets.has(i)) {
        this.removeEntity(bullets[i]);
        bullets.splice(i, 1);
      }
    }

    if (currentPlayer) {
      const created = updatePlayer(
        currentPlayer,
        scaledDeltaTime,
        now,
        deltaScale,
        Boolean(timeStep?.input.timeDilation.pressed),
        () => fireInspectionProbe(currentPlayer, this.inspectionProbes, now, (probe) => {
          configureProjectileEntity('inspectionProbe', probe, (ctx) =>
            drawInspectionProbe(probe, ctx),
          );
          this.entities.add(probe);
        }),
      );
      for (const bullet of created.bullets) {
        configureProjectileEntity('bullet', bullet, (ctx, context) =>
          drawBullet(bullet, ctx, context.now),
        );
        this.entities.add(bullet);
      }
      if (created.thrusterParticle) this.entities.add(created.thrusterParticle);
      if (!timeStep?.input.timeDilation.pressed) {
        this.applyTractorBeam(currentPlayer, deltaScale);
      }
    }
    updateBlackHoleLifecycles({
      now,
      deltaScale,
      planets,
      getDelta: (fromX, fromY, toX, toY) => this.getWrappedDelta(fromX, fromY, toX, toY),
      distance: (fromX, fromY, toX, toY) => Math.hypot(toX - fromX, toY - fromY),
      onAsteroidAbsorbed: (asteroid) => {
        const intensity = asteroid.size === 'big' ? 1.2 : asteroid.size === 'medium' ? 0.8 : 0.45;
        this.addParticlesFrom(() => createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy));
      },
      onAsteroidRemoved: (asteroid) => this.removeEntity(asteroid),
      onBlackHoleRemoved: (blackHole) => this.removeEntity(blackHole),
      onFuelBurst: (x, y, count, burstNow, baseVx, baseVy) =>
        this.spawnFuelBurst(x, y, count, burstNow, baseVx, baseVy),
      createExplosionBurst: (...args) => {
        this.addParticlesFrom(() => createExplosionBurst(...args));
        return [];
      },
    });
    this.updateDroppedFuel(deltaScale);
    updateInspectionProbes(this.inspectionProbes, now, {
      deltaScale,
      handleProbe: (probe) => {
        const hitPlanet = planets.find(
          (planet) =>
            Math.hypot(probe.x - planet.x, probe.y - planet.y) <=
            planet.getRadius() + INSPECTION_PROBE_RADIUS,
        );
        if (hitPlanet) {
          hitPlanet.inspectedUntil = now + INSPECTION_PROBE_DURATION_MS;
          return true;
        }

        return false;
      },
      onRemove: (probe) => {
        if (probe?.id) {
          this.entities.remove(probe.id);
        }
      },
    });

    for (const asteroid of asteroids) {
      updateAsteroid(asteroid, deltaScale);
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
      this.addParticlesFrom(() => createShipDebris(player.x, player.y, 2, debrisVx, debrisVy, player.color));
      this.addParticlesFrom(() => createExplosionBurst(player.x, player.y, 2, player.vx, player.vy));

      player.respawnTime = now + 2000;
    }, now);

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
        this.addParticlesFrom(() => createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy));
        this.spawnAsteroidFuelDrops(asteroid, now);
        const children = splitAsteroid(asteroid);
        this.addAsteroids(children);
        this.removeEntity(asteroid);
        asteroids.splice(i, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      updateBullet(bullet, deltaScale);
      if (bullet.type !== 'blackHole' && isBulletExpired(bullet, now)) {
        this.removeEntity(bullet);
        bullets.splice(i, 1);
      }
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      updateThrusterParticle(thrusterParticles[i], scaledDeltaTime, deltaScale);
      if (thrusterParticles[i].lifetime <= 0) {
        this.removeEntity(thrusterParticles[i]);
        thrusterParticles.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      updateParticle(particles[i], scaledDeltaTime, deltaScale);
      if (particles[i].lifetime <= 0) {
        this.removeEntity(particles[i]);
        particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const realNow = Date.now();
    const now = this.simulationTime;

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

    this.entities.renderAll(ctx, { now });

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
