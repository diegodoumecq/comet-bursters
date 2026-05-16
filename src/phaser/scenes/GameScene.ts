import Phaser from 'phaser';

import type { AsteroidEntity, FuelBlobEntity, ProjectileEntity, ProjectileKind, Vector, WeaponKind, WorldSize } from '../model';
import { ActionReader } from '../services/actions';
import { ASTEROIDS, createAsteroidTextures, createWaveAsteroids, resolveAsteroidCollisions, splitAsteroid, wrapAsteroid } from '../services/asteroids';
import { updateBlackHoles } from '../services/blackHoles';
import {
  addFuel,
  consumeThrustFuel,
  consumeTractorFuel,
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_RADIUS,
  FUELLESS_THRUST_SCALE,
  getFireMode,
  getFuelDropCount,
  MAX_FUEL,
  SHIELD_HIT_COOLDOWN_MS,
  SHIELD_RADIUS,
  spendShieldFuel,
  spendWeaponFuel,
} from '../services/fuel';
import { spawnFuelBlobs, updateFuelBlob } from '../services/fuelBlobs';
import { getTimeScale } from '../services/time';
import { applyTractorBeam, drawTractorBeam } from '../services/tractorBeam';
import { FIRE_INTERVAL_MS, PROJECTILES } from '../services/weapons';
import { normalize, wrapPoint } from '../services/world';
import { Hud } from '../ui/Hud';
import { WeaponMenu } from '../ui/WeaponMenu';

const PLAYER_ACCELERATION = 1600;
const PLAYER_MAX_SPEED = 820;
const RESPAWN_DELAY_MS = 1800;

export class PhaserGameScene extends Phaser.Scene {
  private actions!: ActionReader;
  private beam!: Phaser.GameObjects.Graphics;
  private shield!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private weaponMenu!: WeaponMenu;
  private player!: Phaser.Physics.Matter.Image;
  private turret!: Phaser.GameObjects.Line;
  private worldSize!: WorldSize;
  private asteroids: AsteroidEntity[] = [];
  private fuelBlobs: FuelBlobEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private playerVelocity: Vector = { x: 0, y: 0 };
  private lastAim: Vector = { x: 0, y: -1 };
  private lastShotAt: Record<ProjectileKind, number> = { blackHole: 0, pusher: 0, shotgun: 0, small: 0 };
  private primaryWeapon: WeaponKind = 'small';
  private secondaryWeapon: WeaponKind = 'pusher';
  private fuel = MAX_FUEL;
  private wave = 1;
  private score = 0;
  private lives = 3;
  private respawnAt = 0;
  private invulnerableUntil = 0;
  private waveClearAt = 0;
  private shieldHitUntil = 0;

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
    this.shield = this.add.graphics();
    this.hud = new Hud(this);
    this.weaponMenu = new WeaponMenu(this);
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
    if (action.timeDilation) {
      const selectedWeapon = this.weaponMenu.getSelected(this.lastAim);
      if (action.firePrimary) this.primaryWeapon = selectedWeapon;
      if (action.fireSecondary) this.secondaryWeapon = selectedWeapon;
    } else {
      if (this.isPlayerAlive() && action.firePrimary) this.fireWeapon(this.primaryWeapon, this.lastAim, time);
      if (this.isPlayerAlive() && action.fireSecondary) this.fireWeapon(this.secondaryWeapon, this.lastAim, time);
    }
    const tractorActive =
      !action.timeDilation &&
      this.isPlayerAlive() &&
      ((this.primaryWeapon === 'tractor' && action.firePrimary) ||
        (this.secondaryWeapon === 'tractor' && action.fireSecondary));
    this.fuel = consumeTractorFuel(this.fuel, deltaSeconds, tractorActive);
    applyTractorBeam(this.player, this.lastAim, this.asteroids, tractorActive);
    drawTractorBeam(this.beam, this.player, this.lastAim, tractorActive);
    this.drawShield(action.shield);
    this.weaponMenu.draw(this.player, this.lastAim, this.primaryWeapon, this.secondaryWeapon, action.timeDilation);
    this.updateAsteroids(deltaSeconds);
    this.updateFuelBlobs(deltaSeconds);
    resolveAsteroidCollisions(this.asteroids, this.worldSize);
    this.updateProjectiles(time, deltaSeconds);
    this.resolveProjectileHits();
    updateBlackHoles(
      this.projectiles,
      this.asteroids,
      [],
      time,
      (projectile) => this.removeProjectile(projectile),
      (asteroid) => this.removeAsteroid(asteroid),
      (asteroid) => {
        this.score += ASTEROIDS[asteroid.tier].points * this.lives;
      },
      (projectile) => {
        if (projectile.absorbedFuel > 0) {
          this.fuelBlobs.push(...spawnFuelBlobs(
            this,
            { x: projectile.shape.x, y: projectile.shape.y },
            projectile.velocity,
            projectile.absorbedFuel,
          ));
        }
      },
    );
    this.resolvePlayerHits(time, action.shield);
    this.updateRespawn(time);
    this.updateWave(time);
    this.hud.update({ asteroids: this.asteroids.length, fuel: this.fuel, lives: this.lives, primary: this.primaryWeapon, projectiles: this.projectiles.length, score: this.score, secondary: this.secondaryWeapon, timeDilation: action.timeDilation, wave: this.wave });
  }

  private updatePlayer(move: Vector, deltaSeconds: number): void {
    if (Math.hypot(move.x, move.y) > 0) this.player.setRotation(Math.atan2(move.y, move.x) + Math.PI * 0.5);
    const thrusting = Math.hypot(move.x, move.y) > 0;
    this.fuel = consumeThrustFuel(this.fuel, deltaSeconds, thrusting);
    const thrustScale = this.fuel > 0 ? 1 : FUELLESS_THRUST_SCALE;
    this.playerVelocity.x += move.x * PLAYER_ACCELERATION * thrustScale * deltaSeconds;
    this.playerVelocity.y += move.y * PLAYER_ACCELERATION * thrustScale * deltaSeconds;
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

  private fireWeapon(kind: WeaponKind, direction: Vector, now: number): void {
    if (kind === 'tractor') return;
    if (now - this.lastShotAt[kind] < FIRE_INTERVAL_MS[kind]) return;
    const mode = getFireMode(this.fuel, kind);
    if (!mode) return;
    this.fuel = spendWeaponFuel(this.fuel, kind, mode);
    this.lastShotAt[kind] = now;
    const spec = PROJECTILES[kind];
    const degradedSmall = kind === 'small' && mode === 'degraded';
    const baseAngle = Math.atan2(direction.y, direction.x);
    for (let i = 0; i < spec.count; i += 1) {
      const offset = spec.count === 1 ? 0 : (i / (spec.count - 1) - 0.5) * spec.spread;
      const angle = baseAngle + offset;
      const shotDirection = { x: Math.cos(angle), y: Math.sin(angle) };
      const shape = this.add.circle(this.player.x, this.player.y, spec.radius, kind === 'blackHole' ? 0x000000 : 0xffffff);
      if (kind === 'blackHole') shape.setStrokeStyle(2, 0xffffff);
      this.projectiles.push({
        absorbedFuel: 0,
        collapseStartedAt: null,
        createdAt: now,
        kind,
        lifetimeMs: spec.lifetimeMs * (degradedSmall ? 0.5 : 1),
        shape,
        velocity: {
          x: this.playerVelocity.x + shotDirection.x * spec.speed * (degradedSmall ? 0.5 : 1),
          y: this.playerVelocity.y + shotDirection.y * spec.speed * (degradedSmall ? 0.5 : 1),
        },
      });
    }
    this.playerVelocity.x -= direction.x * spec.recoil;
    this.playerVelocity.y -= direction.y * spec.recoil;
  }

  private updateProjectiles(now: number, deltaSeconds: number): void {
    for (const projectile of [...this.projectiles]) {
      if (now - projectile.createdAt >= projectile.lifetimeMs && projectile.kind !== 'blackHole') {
        this.removeProjectile(projectile);
      } else {
        projectile.shape.setPosition(projectile.shape.x + projectile.velocity.x * deltaSeconds, projectile.shape.y + projectile.velocity.y * deltaSeconds);
        wrapPoint(projectile.shape, this.worldSize);
      }
    }
  }

  private resolveProjectileHits(): void {
    for (const projectile of [...this.projectiles]) {
      if (projectile.kind !== 'blackHole') {
        for (const asteroid of [...this.asteroids]) {
          const distance = Phaser.Math.Distance.Between(projectile.shape.x, projectile.shape.y, asteroid.body.x, asteroid.body.y);
          if (distance <= PROJECTILES[projectile.kind].radius + ASTEROIDS[asteroid.tier].radius) {
            this.removeProjectile(projectile);
            this.applyProjectileImpulse(projectile, asteroid);
            asteroid.hits = (asteroid.hits ?? 1) - PROJECTILES[projectile.kind].damage;
            if ((asteroid.hits ?? 0) <= 0) {
              this.score += ASTEROIDS[asteroid.tier].points * this.lives;
              this.spawnFuelDrops(asteroid);
              this.asteroids.push(...splitAsteroid(this, asteroid));
              this.removeAsteroid(asteroid);
            }
            break;
          }
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

  private resolvePlayerHits(now: number, shieldActive: boolean): void {
    if (!this.isPlayerAlive() || now < this.invulnerableUntil) return;
    for (const asteroid of this.asteroids) {
      const asteroidRadius = ASTEROIDS[asteroid.tier].radius;
      const dx = this.player.x - asteroid.body.x;
      const dy = this.player.y - asteroid.body.y;
      const distance = Math.hypot(dx, dy);
      const shieldCollisionDistance = SHIELD_RADIUS + asteroidRadius;
      if (shieldActive && this.fuel > 0 && distance <= shieldCollisionDistance && now >= this.shieldHitUntil) {
        this.shieldHitUntil = now + SHIELD_HIT_COOLDOWN_MS;
        this.fuel = spendShieldFuel(this.fuel, asteroid.tier);
        this.bounceShieldCollision(asteroid, dx, dy, distance, shieldCollisionDistance);
      } else if (!shieldActive && distance <= 18 + asteroidRadius) {
        this.lives -= 1;
        this.respawnAt = now + RESPAWN_DELAY_MS;
        this.player.setVisible(false);
        this.turret.setVisible(false);
        this.playerVelocity = { x: 0, y: 0 };
        break;
      }
    }
  }

  private bounceShieldCollision(
    asteroid: AsteroidEntity,
    dx: number,
    dy: number,
    distance: number,
    shieldCollisionDistance: number,
  ): void {
    const safeDistance = distance || 1;
    const normal = { x: dx / safeDistance, y: dy / safeDistance };
    const asteroidConfig = ASTEROIDS[asteroid.tier];
    const asteroidVelocity = asteroid.velocity ?? { x: 0, y: 0 };
    const bounceForce = 480;
    const shipInfluence = asteroidConfig.mass / (1 + asteroidConfig.mass);
    asteroidVelocity.x -= normal.x * bounceForce * (1 - shipInfluence);
    asteroidVelocity.y -= normal.y * bounceForce * (1 - shipInfluence);
    this.playerVelocity.x += normal.x * bounceForce * shipInfluence;
    this.playerVelocity.y += normal.y * bounceForce * shipInfluence;
    asteroid.velocity = asteroidVelocity;
    const overlap = shieldCollisionDistance - distance;
    asteroid.body.setPosition(
      asteroid.body.x - normal.x * overlap,
      asteroid.body.y - normal.y * overlap,
    );
  }

  private drawShield(active: boolean): void {
    this.shield.clear();
    if (!active || !this.isPlayerAlive() || this.fuel <= 0) return;
    this.shield.lineStyle(3, 0x64c8ff, 0.75);
    this.shield.strokeCircle(this.player.x, this.player.y, SHIELD_RADIUS);
  }

  private spawnFuelDrops(asteroid: AsteroidEntity): void {
    const count = getFuelDropCount(asteroid.tier);
    if (count === 0) return;
    this.fuelBlobs.push(...spawnFuelBlobs(
      this,
      { x: asteroid.body.x, y: asteroid.body.y },
      asteroid.velocity ?? { x: 0, y: 0 },
      count,
    ));
  }

  private updateFuelBlobs(deltaSeconds: number): void {
    for (const blob of [...this.fuelBlobs]) {
      updateFuelBlob(blob, this.player, this.isPlayerAlive() && this.fuel < MAX_FUEL, deltaSeconds, this.worldSize);
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, blob.shape.x, blob.shape.y);
      if (this.isPlayerAlive() && this.fuel < MAX_FUEL && distance <= 18 + FUEL_BLOB_RADIUS) {
        this.fuel = addFuel(this.fuel, FUEL_BLOB_AMOUNT);
        this.removeFuelBlob(blob);
      }
    }
  }

  private updateRespawn(now: number): void {
    if (this.respawnAt === 0 || now < this.respawnAt || this.lives <= 0) return;
    this.respawnAt = 0;
    this.player.setPosition(this.worldSize.width / 2, this.worldSize.height / 2);
    this.player.setVisible(true);
    this.fuel = MAX_FUEL;
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

  private removeFuelBlob(blob: FuelBlobEntity): void {
    blob.shape.destroy();
    const index = this.fuelBlobs.indexOf(blob);
    if (index !== -1) this.fuelBlobs.splice(index, 1);
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
