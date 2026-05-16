import Phaser from 'phaser';

import { ActionReader } from '../services/actions';
import { createAsteroid, createAsteroidTextures } from '../services/asteroids';
import { updateBlackHoles } from '../services/blackHoles';
import { getTimeScale } from '../services/time';
import { drawTractorBeam } from '../services/tractorBeam';
import { PROJECTILES } from '../services/weapons';
import { normalize, wrapPoint } from '../services/world';
import { Hud } from '../ui/Hud';
import type { AsteroidEntity, PlanetEntity, ProjectileEntity, ProjectileKind, Vector, WorldSize } from '../model';

const WORLD: WorldSize = { width: 4600, height: 3400 };
const PLAYER_ACCELERATION = 2400;
const PLAYER_DRAG = 2.45;
const PLAYER_MAX_SPEED = 1500;

export class PhaserDemoScene extends Phaser.Scene {
  private actions!: ActionReader;
  private player!: Phaser.Physics.Matter.Image;
  private turret!: Phaser.GameObjects.Line;
  private beam!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private projectiles: ProjectileEntity[] = [];
  private planets: PlanetEntity[] = [];
  private asteroids: AsteroidEntity[] = [];
  private lastShotAt = 0;
  private lastAim: Vector = { x: 0, y: -1 };
  private playerVelocity: Vector = { x: 0, y: 0 };

  constructor() {
    super('demo');
  }

  create(): void {
    this.matter.world.setBounds(0, 0, WORLD.width, WORLD.height, 64, true, true, true, true);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.actions = new ActionReader(this);
    this.createGrid();
    this.createTextures();
    this.createPlanets();
    this.createAsteroids();
    this.player = this.matter.add.image(620, 760, 'phaser-ship');
    this.player.setCircle(18);
    this.player.setStatic(true);
    this.player.setMass(18);
    this.turret = this.add.line(620, 760, 0, 0, 0, -52, 0xffffff).setLineWidth(3, 3);
    this.beam = this.add.graphics();
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.hud = new Hud(this);
  }

  update(time: number, delta: number): void {
    const action = this.actions.read(this.player);
    const timeScale = getTimeScale(action.timeDilation);
    this.matter.world.engine.timing.timeScale = timeScale;
    const aim = normalize(action.aim);
    const move = normalize(action.move);
    if (Math.hypot(aim.x, aim.y) > 0) this.lastAim = aim;
    if (Math.hypot(move.x, move.y) > 0) {
      this.player.setRotation(Math.atan2(move.y, move.x) + Math.PI * 0.5);
    }
    const scaledDeltaSeconds = (delta / 1000) * timeScale;
    const nextVelocity = {
      x: this.playerVelocity.x + move.x * PLAYER_ACCELERATION * scaledDeltaSeconds,
      y: this.playerVelocity.y + move.y * PLAYER_ACCELERATION * scaledDeltaSeconds,
    };
    const drag = Math.exp(-PLAYER_DRAG * scaledDeltaSeconds);
    nextVelocity.x *= drag;
    nextVelocity.y *= drag;
    const speed = Math.hypot(nextVelocity.x, nextVelocity.y);
    if (speed > PLAYER_MAX_SPEED) {
      nextVelocity.x = (nextVelocity.x / speed) * PLAYER_MAX_SPEED;
      nextVelocity.y = (nextVelocity.y / speed) * PLAYER_MAX_SPEED;
    }
    this.playerVelocity = nextVelocity;
    this.player.setPosition(
      this.player.x + this.playerVelocity.x * scaledDeltaSeconds,
      this.player.y + this.playerVelocity.y * scaledDeltaSeconds,
    );
    this.turret.setPosition(this.player.x, this.player.y);
    this.turret.setRotation(Math.atan2(this.lastAim.y, this.lastAim.x) + Math.PI * 0.5);

    if (action.firePrimary && time - this.lastShotAt >= 140) {
      this.fireProjectile(action.timeDilation ? 'blackHole' : 'small', this.lastAim, time);
      this.lastShotAt = time;
    }
    drawTractorBeam(this.beam, this.player, this.lastAim, action.fireSecondary);

    wrapPoint(this.player, WORLD);
    this.player.setPosition(this.player.x, this.player.y);
    this.updateProjectiles(time, (delta / 1000) * timeScale);
    updateBlackHoles(
      this.projectiles,
      this.asteroids,
      this.planets,
      time,
      (projectile) => this.removeProjectile(projectile),
      (asteroid) => this.removeAsteroid(asteroid),
    );
    this.hud.update({ asteroids: this.asteroids.length, projectiles: this.projectiles.length, timeDilation: action.timeDilation });
  }

  private fireProjectile(kind: ProjectileKind, direction: Vector, now: number): void {
    const spec = PROJECTILES[kind];
    const shape = this.add.circle(this.player.x, this.player.y, spec.radius, 0xffffff);
    this.projectiles.push({
      absorbedFuel: 0,
      collapseStartedAt: null,
      createdAt: now,
      kind,
      shape,
      velocity: {
        x: direction.x * spec.speed,
        y: direction.y * spec.speed,
      },
    });
  }

  private updateProjectiles(now: number, deltaSeconds: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      const spec = PROJECTILES[projectile.kind];
      if (now - projectile.createdAt >= spec.lifetimeMs) {
        this.removeProjectile(projectile);
      } else {
        projectile.shape.setPosition(
          projectile.shape.x + projectile.velocity.x * deltaSeconds,
          projectile.shape.y + projectile.velocity.y * deltaSeconds,
        );
        wrapPoint(projectile.shape, WORLD);
      }
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

  private createGrid(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1f2a44, 1);
    for (let x = 0; x <= WORLD.width; x += 120) graphics.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += 120) graphics.lineBetween(0, y, WORLD.width, y);
  }

  private createTextures(): void {
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

  private createPlanets(): void {
    const layouts: Array<[number, number, number, number]> = [
      [980, 980, 130, 0x4ade80],
      [1660, 930, 150, 0xf59e0b],
      [2320, 1130, 120, 0x7dd3fc],
      [2940, 1560, 140, 0xa78bfa],
    ];
    this.planets = layouts.map(([x, y, radius, color]) => ({
      body: this.add.circle(x, y, radius, color).setStrokeStyle(4, 0xffffff, 0.25),
      radius,
    }));
  }

  private createAsteroids(): void {
    const positions: Array<[number, number]> = [
      [1100, 2620],
      [1940, 2740],
      [2820, 2650],
      [3660, 2480],
    ];
    const tiers = ['mega', 'big', 'medium', 'small'] as const;
    this.asteroids = positions.map(([x, y], index) => {
      const asteroid = createAsteroid(this, tiers[index], { x, y }, { x: 0, y: 0 });
      asteroid.body.setStatic(true);
      return asteroid;
    });
  }
}
