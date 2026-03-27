import { ASTEROID_CONFIGS, PLANET_CONFIG, SHIELD_MAX_HITS, STARTING_LIVES } from '@/constants';
import { joymap } from '@/joymap';
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
  players,
  resetState,
  screenShake,
  thrusterParticles,
} from '@/state';
import type { Scene } from '../scene';
import { drawAsteroid, spawnWave, splitAsteroid, updateAsteroid } from './asteroid';
import { drawBackground, updateBackground } from './background';
import { drawBullet, isBulletExpired, updateBullet } from './bullet';
import {
  processBulletAsteroidCollisions,
  processPlanetAsteroidCollisions,
  processPlanetBulletCollisions,
  processPlanetPlayerCollisions,
  processPlayerAsteroidCollisions,
} from './collision';
import {
  createExplosion,
  drawParticle,
  drawThrusterParticle,
  updateParticle,
  updateThrusterParticle,
} from './particle';
import { drawPlanet, updatePlanets } from './planets';
import { createPlayer, drawPlayer, updatePlayer } from './player';
import { rumbleDeath } from './rumble';
import { dispose, initShader, renderWithShaders, updateBlackHoles } from './shader';

export class GameScene implements Scene {
  private canvas: HTMLCanvasElement | null = null;

  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  resize(): void {
    if (gameState.gameSize && this.canvas) {
      dispose();
      initShader(this.canvas);
    }
  }

  enter(): void {
    resetState();

    spawnWave(1);

    if (players.length === 0) {
      const unusedIds = joymap.getUnusedPadIds();
      let colorIndex = 0;

      if (unusedIds.length > 0) {
        unusedIds.forEach((padId: string) => {
          const player = createPlayer(padId, colorIndex);
          joymap.addModule(player.module);
          players.push(player);
          colorIndex++;
        });
      } else {
        const player = createPlayer('keyboard', 0);
        joymap.addModule(player.module);
        players.push(player);
      }
    }

    for (const player of players) {
      player.lives = STARTING_LIVES;
      player.score = 0;
      player.shieldHits = SHIELD_MAX_HITS;
      player.shieldActive = false;
      player.waitingToRespawn = false;
      player.angle = 0;
      player.turretAngle = 0;

      let safePositionFound = false;
      const maxAttempts = 50;
      const minDistFromPlanet = PLANET_CONFIG.radius * 3;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = Math.random() * getGameWidth();
        const y = Math.random() * getGameHeight();

        let tooClose = false;
        for (const planet of planets) {
          const width = getGameWidth();
          const height = getGameHeight();
          const planetPositions = [
            { x: planet.x, y: planet.y },
            { x: planet.x + width, y: planet.y },
            { x: planet.x - width, y: planet.y },
            { x: planet.x, y: planet.y + height },
            { x: planet.x, y: planet.y - height },
            { x: planet.x + width, y: planet.y + height },
            { x: planet.x - width, y: planet.y + height },
            { x: planet.x + width, y: planet.y - height },
            { x: planet.x - width, y: planet.y - height },
          ];

          for (const pPos of planetPositions) {
            const dx = pPos.x - x;
            const dy = pPos.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistFromPlanet) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) break;
        }

        if (!tooClose) {
          player.x = x;
          player.y = y;
          safePositionFound = true;
          break;
        }
      }

      if (!safePositionFound) {
        player.x = Math.random() * getGameWidth();
        player.y = Math.random() * getGameHeight();
      }

      player.vx = 0;
      player.vy = 0;
      player.invulnerable = true;
      player.invulnerableUntil = Date.now() + 3000;
      player.respawnTime = 0;
    }

    spawnWave(1);

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

    if (!gameState.baseAlphaMask) {
      return;
    }

    updatePlanets();

    processPlanetPlayerCollisions((player) => {
      if (player.waitingToRespawn) return;
      player.lives--;
      player.waitingToRespawn = true;
      player.respawnTime = now + 2000;
      player.vx = 0;
      player.vy = 0;
      player.isThrusting = false;
      rumbleDeath(player.module);
      createExplosion(player.x, player.y, 1, player.vx, player.vy);
    });

    const planetAsteroidHits = processPlanetAsteroidCollisions();
    const destroyedAsteroids = new Set(planetAsteroidHits);
    for (let i = asteroids.length - 1; i >= 0; i--) {
      if (destroyedAsteroids.has(i)) {
        const asteroid = asteroids[i];
        const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
        createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
        asteroids.splice(i, 1);
      }
    }

    const planetBulletHits = processPlanetBulletCollisions();
    const planetHitBullets = new Set(planetBulletHits);
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (planetHitBullets.has(i)) {
        bullets.splice(i, 1);
      }
    }

    if (asteroids.length === 0 && !gameState.waveCleared) {
      gameState.waveCleared = true;
      gameState.waveClearTime = now;
    }

    if (gameState.waveCleared && now - gameState.waveClearTime > 2000) {
      gameState.currentWave++;
      spawnWave(gameState.currentWave);
      gameState.waveCleared = false;
      for (const player of players) {
        player.shieldHits = SHIELD_MAX_HITS;
      }
    }

    if (asteroids.length === 0 && gameState.currentWave === 1) {
      spawnWave(1);
    }

    const bulletHits = processBulletAsteroidCollisions();
    const handledBullets = new Set<number>();
    for (const { bulletIndex: i, asteroidIndex: j } of bulletHits) {
      if (handledBullets.has(i)) continue;
      handledBullets.add(i);

      const bullet = bullets[i];
      if (!bullet) continue;

      const asteroid = asteroids[j];
      if (!asteroid) continue;

      const massMultiplier = asteroid.size === 'big' ? 0.3 : asteroid.size === 'medium' ? 0.6 : 1.0;
      const impulse = bullet.impact * 2 * massMultiplier;
      asteroid.vx += bullet.vx * 0.1 * impulse;
      asteroid.vy += bullet.vy * 0.1 * impulse;

      asteroid.hits -= bullet.damage;

      if (asteroid.hits <= 0) {
        const shooter = players.find((p) => p.id === bullet.playerId);
        if (shooter) {
          shooter.score += ASTEROID_CONFIGS[asteroid.size].points * shooter.lives;
        }

        const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
        createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);

        const children = splitAsteroid(asteroid);
        asteroids.push(...children);

        asteroids.splice(j, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (handledBullets.has(i)) {
        bullets.splice(i, 1);
      }
    }

    for (const player of players) {
      updatePlayer(player);
    }

    for (const asteroid of asteroids) {
      updateAsteroid(asteroid);
    }

    processPlayerAsteroidCollisions((player) => {
      if (player.waitingToRespawn) return;

      player.lives--;
      player.waitingToRespawn = true;
      player.vx = 0;
      player.vy = 0;
      player.isThrusting = false;
      rumbleDeath(player.module);
      createExplosion(player.x, player.y, 2, player.vx, player.vy);

      player.respawnTime = now + 2000;
    });

    const allWaitingToRespawn =
      players.length > 0 && players.every((p) => p.lives <= 0 && now >= p.respawnTime);

    if (allWaitingToRespawn) {
      sceneManager.transitionTo('gameover');
      gameState.gameOverTime = now;
    } else {
      for (const player of players) {
        if (player.waitingToRespawn && now >= player.respawnTime) {
          player.invulnerable = true;
          player.invulnerableUntil = now + 2000;

          let safePositionFound = false;
          const maxAttempts = 50;
          const minDistFromPlanet = PLANET_CONFIG.radius * 3;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = Math.random() * getGameWidth();
            const y = Math.random() * getGameHeight();

            let tooClose = false;
            for (const planet of planets) {
              const width = getGameWidth();
              const height = getGameHeight();
              const planetPositions = [
                { x: planet.x, y: planet.y },
                { x: planet.x + width, y: planet.y },
                { x: planet.x - width, y: planet.y },
                { x: planet.x, y: planet.y + height },
                { x: planet.x, y: planet.y - height },
                { x: planet.x + width, y: planet.y + height },
                { x: planet.x - width, y: planet.y + height },
                { x: planet.x + width, y: planet.y - height },
                { x: planet.x - width, y: planet.y - height },
              ];

              for (const pPos of planetPositions) {
                const dx = pPos.x - x;
                const dy = pPos.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDistFromPlanet) {
                  tooClose = true;
                  break;
                }
              }
              if (tooClose) break;
            }

            if (!tooClose) {
              player.x = x;
              player.y = y;
              safePositionFound = true;
              break;
            }
          }

          if (!safePositionFound) {
            player.x = Math.random() * getGameWidth();
            player.y = Math.random() * getGameHeight();
          }

          player.vx = 0;
          player.vy = 0;
          player.shieldHits = SHIELD_MAX_HITS;
          player.waitingToRespawn = false;
        }
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      if (asteroid.hits <= 0) {
        const intensity = asteroid.size === 'big' ? 1.5 : asteroid.size === 'medium' ? 1 : 0.5;
        createExplosion(asteroid.x, asteroid.y, intensity, asteroid.vx, asteroid.vy);
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

    for (const planet of planets) {
      drawPlanet(planet, ctx);
    }

    for (const bullet of bullets) {
      drawBullet(bullet, ctx);
    }

    for (const asteroid of asteroids) {
      drawAsteroid(asteroid, ctx);
    }

    for (let i = thrusterParticles.length - 1; i >= 0; i--) {
      drawThrusterParticle(thrusterParticles[i], ctx);
    }

    for (const player of players) {
      if (!player.waitingToRespawn) {
        drawPlayer(player, ctx);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      drawParticle(particles[i], ctx);
    }

    ctx.font = '20px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    players.forEach((player, index) => {
      const hudX = index % 2 === 0 ? 20 : getGameWidth() - 200;
      const hudY = 20;

      ctx.fillStyle = player.color;
      ctx.fillText(`P${index + 1}`, hudX, hudY);

      const remainingTime = Math.max(0, Math.ceil((player.respawnTime - now) / 1000));
      if (player.lives <= 0) {
        ctx.fillStyle = '#888';
        ctx.fillText(`Waiting... ${remainingTime}s`, hudX + 40, hudY);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillText(`x${player.lives} ${'♥'.repeat(player.lives)}`, hudX + 40, hudY);
      }
      ctx.fillText(`Score: ${player.score}`, hudX + 40, hudY + 25);
    });

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
    dispose();
  }
}
