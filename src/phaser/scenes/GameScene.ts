import Phaser from 'phaser';

import type { AsteroidEntity, ProjectileEntity, ProjectileKind, Vector, WorldSize } from '../model';
import { ActionReader } from '../services/actions';
import { ASTEROIDS, createAsteroidTextures, createWaveAsteroids, resolveAsteroidCollisions, splitAsteroid, wrapAsteroid } from '../services/asteroids';
import { updateBlackHoles } from '../services/blackHoles';
import { getTimeScale } from '../services/time';
import { applyTractorBeam, drawTractorBeam } from '../services/tractorBeam';
import { PROJECTILES } from '../services/weapons';
import { normalize, wrapPoint } from '../services/world';
import { Hud } from '../ui/Hud';

const PLAYER_ACCELERATION = 1600;
const PLAYER_DRAG = 1.9;
const PLAYER_MAX_SPEED = 820;
const RESPAWN_DELAY_MS = 1800;

export class PhaserGameScene extends Phaser.Scene {
  private actions!: ActionReader;
  private beam!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private player!: Phaser.Physics.Matter.Image;
  private turret!: Phaser.GameObjects.Line;
  private worldSize!: WorldSize;
  private asteroids: AsteroidEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private playerVelocity: Vector = { x: 0, y: 0 };
  private lastAim: Vector = { x: 0, y: -1 };
  private lastShotAt = 0;
  private wave = 1;
  private score = 0;
  private lives = 3;
  private respawnAt = 0;
  private invulnerableUntil = 0;
  private waveClearAt = 0;

  constructor() {
    super('game');
  }

  create(): void {
    this.worldSize = { width: this.scale.width, height: this.scale.height };
    this.actions = new ActionReader(this);
    this.createTextures();
    this.createBackground();
    this.player = this.matter.add.image(this.worldSize.width / 2, this.worldSize.height / 2, 'phaser-ship');
    this.player.setStatic(true);
    this.player.setCircle(18);
    this.turret = this.add.line(this.player.x, this.player.y, 0, 0, 0, -52, 0xffffff).setLineWidth(3, 3);
    this.beam = this.add.graphics();
    this.hud = new Hud(this);
    this.spawnWave();
    this.scale.on('resize', this.handleResize, this);
  }

  update(time: number, delta: number): void {
    const action = this.actions.read(this.player);
    const timeScale = getTimeScale(action.timeDilation);
    const deltaSeconds = (delta / 1000) * timeScale;
    const aim = normalize(action.aim);
    const move = normalize(action.move);
    if (Math.hypot(aim.x, aim.y) > 0) this.lastAim = aim;
    if (this.isPlayerAlive()) this.updatePlayer(move, deltaSeconds);
    this.turret.setVisible(this.isPlayerAlive());
    this.turret.setPosition(this.player.x, this.player.y);
    this.turret.setRotation(Math.atan2(this.lastAim.y, this.lastAim.x) + Math.PI * 0.5);
    if (this.isPlayerAlive() && action.firePrimary && time - this.lastShotAt >= 140) {
      this.fireProjectile(action.timeDilation ? 'blackHole' : 'small', this.lastAim, time);
      this.lastShotAt = time;
    }
    applyTractorBeam(this.player, this.lastAim, this.asteroids, this.isPlayerAlive() && action.fireSecondary);
    drawTractorBeam(this.beam, this.player, this.lastAim, this.isPlayerAlive() && action.fireSecondary);
    this.updateAsteroids(deltaSeconds);
    resolveAsteroidCollisions(this.asteroids, this.worldSize);
    this.updateProjectiles(time, deltaSeconds);
    this.resolveProjectileHits();
    updateBlackHoles(this.projectiles, this.asteroids, [], time, (projectile) => this.removeProjectile(projectile), (asteroid) => this.removeAsteroid(asteroid));
    this.resolvePlayerHits(time);
    this.updateRespawn(time);
    this.updateWave(time);
    this.hud.update({ asteroids: this.asteroids.length, lives: this.lives, projectiles: this.projectiles.length, score: this.score, timeDilation: action.timeDilation, wave: this.wave });
  }

  private updatePlayer(move: Vector, deltaSeconds: number): void {
    if (Math.hypot(move.x, move.y) > 0) this.player.setRotation(Math.atan2(move.y, move.x) + Math.PI * 0.5);
    this.playerVelocity.x += move.x * PLAYER_ACCELERATION * deltaSeconds;
    this.playerVelocity.y += move.y * PLAYER_ACCELERATION * deltaSeconds;
    const drag = Math.exp(-PLAYER_DRAG * deltaSeconds);
    this.playerVelocity.x *= drag;
    this.playerVelocity.y *= drag;
    const speed = Math.hypot(this.playerVelocity.x, this.playerVelocity.y);
    if (speed > PLAYER_MAX_SPEED) {
      this.playerVelocity.x = (this.playerVelocity.x / speed) * PLAYER_MAX_SPEED;
      this.playerVelocity.y = (this.playerVelocity.y / speed) * PLAYER_MAX_SPEED;
    }
    this.player.setPosition(this.player.x + this.playerVelocity.x * deltaSeconds, this.player.y + this.playerVelocity.y * deltaSeconds);
    wrapPoint(this.player, this.worldSize);
  }

  private spawnWave(): void {
    this.asteroids.push(...createWaveAsteroids(this, this.wave, this.worldSize));
  }

  private updateAsteroids(deltaSeconds: number): void {
    for (const asteroid of this.asteroids) {
      const velocity = asteroid.velocity ?? { x: 0, y: 0 };
      asteroid.body.setPosition(asteroid.body.x + velocity.x * deltaSeconds, asteroid.body.y + velocity.y * deltaSeconds);
      wrapAsteroid(asteroid, this.worldSize);
    }
  }

  private fireProjectile(kind: ProjectileKind, direction: Vector, now: number): void {
    const spec = PROJECTILES[kind];
    const shape = this.add.circle(this.player.x, this.player.y, spec.radius, kind === 'blackHole' ? 0x000000 : 0xffffff);
    if (kind === 'blackHole') shape.setStrokeStyle(2, 0xffffff);
    this.projectiles.push({ absorbedFuel: 0, collapseStartedAt: null, createdAt: now, kind, shape, velocity: { x: direction.x * spec.speed, y: direction.y * spec.speed } });
  }

  private updateProjectiles(now: number, deltaSeconds: number): void {
    for (const projectile of [...this.projectiles]) {
      if (now - projectile.createdAt >= PROJECTILES[projectile.kind].lifetimeMs && projectile.kind !== 'blackHole') {
        this.removeProjectile(projectile);
      } else {
        projectile.shape.setPosition(projectile.shape.x + projectile.velocity.x * deltaSeconds, projectile.shape.y + projectile.velocity.y * deltaSeconds);
        wrapPoint(projectile.shape, this.worldSize);
      }
    }
  }

  private resolveProjectileHits(): void {
    for (const projectile of [...this.projectiles]) {
      if (projectile.kind === 'blackHole') continue;
      for (const asteroid of [...this.asteroids]) {
        const distance = Phaser.Math.Distance.Between(projectile.shape.x, projectile.shape.y, asteroid.body.x, asteroid.body.y);
        if (distance <= PROJECTILES[projectile.kind].radius + ASTEROIDS[asteroid.tier].radius) {
          this.removeProjectile(projectile);
          this.applyProjectileImpulse(projectile, asteroid);
          asteroid.hits = (asteroid.hits ?? 1) - PROJECTILES[projectile.kind].damage;
          if ((asteroid.hits ?? 0) <= 0) {
            this.score += ASTEROIDS[asteroid.tier].points * this.lives;
            this.asteroids.push(...splitAsteroid(this, asteroid));
            this.removeAsteroid(asteroid);
          }
          break;
        }
      }
    }
  }

  private applyProjectileImpulse(projectile: ProjectileEntity, asteroid: AsteroidEntity): void {
    const asteroidVelocity = asteroid.velocity ?? { x: 0, y: 0 };
    const config = ASTEROIDS[asteroid.tier];
    const projectileSpeed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
    if (projectileSpeed === 0) return;
    const normalX = projectile.velocity.x / projectileSpeed;
    const normalY = projectile.velocity.y / projectileSpeed;
    const massScale = 1 / config.mass;
    const impulse = PROJECTILES[projectile.kind].impact * 90 * massScale;
    asteroidVelocity.x += normalX * impulse;
    asteroidVelocity.y += normalY * impulse;
    asteroid.velocity = asteroidVelocity;
  }

  private resolvePlayerHits(now: number): void {
    if (!this.isPlayerAlive() || now < this.invulnerableUntil) return;
    for (const asteroid of this.asteroids) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, asteroid.body.x, asteroid.body.y) <= 18 + ASTEROIDS[asteroid.tier].radius) {
        this.lives -= 1;
        this.respawnAt = now + RESPAWN_DELAY_MS;
        this.player.setVisible(false);
        this.turret.setVisible(false);
        this.playerVelocity = { x: 0, y: 0 };
        break;
      }
    }
  }

  private updateRespawn(now: number): void {
    if (this.respawnAt === 0 || now < this.respawnAt || this.lives <= 0) return;
    this.respawnAt = 0;
    this.player.setPosition(this.worldSize.width / 2, this.worldSize.height / 2);
    this.player.setVisible(true);
    this.invulnerableUntil = now + 2200;
  }

  private updateWave(now: number): void {
    if (this.asteroids.length === 0 && this.waveClearAt === 0) this.waveClearAt = now;
    if (this.asteroids.length === 0 && now - this.waveClearAt >= 1200) {
      this.wave += 1;
      this.waveClearAt = 0;
      this.spawnWave();
    }
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    projectile.shape.destroy();
    const index = this.projectiles.indexOf(projectile);
    if (index !== -1) this.projectiles.splice(index, 1);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
    asteroid.body.destroy();
    const index = this.asteroids.indexOf(asteroid);
    if (index !== -1) this.asteroids.splice(index, 1);
  }

  private isPlayerAlive(): boolean {
    return this.respawnAt === 0 && this.lives > 0;
  }

  private createBackground(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1f2a44, 0.7);
    for (let x = 0; x <= this.worldSize.width; x += 120) graphics.lineBetween(x, 0, x, this.worldSize.height);
    for (let y = 0; y <= this.worldSize.height; y += 120) graphics.lineBetween(0, y, this.worldSize.width, y);
  }

  private createTextures(): void {
    if (this.textures.exists('phaser-ship')) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xf4f7ff, 1);
    graphics.beginPath();
    graphics.moveTo(24, 0);
    graphics.lineTo(40, 44);
    graphics.lineTo(24, 36);
    graphics.lineTo(8, 44);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture('phaser-ship', 48, 48);
    graphics.destroy();
    createAsteroidTextures(this);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
  }
}
