import Phaser from 'phaser';

import { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS } from '../asteroids/config';
import { ASTEROID_TEXTURES } from '../asteroids/textures';
import { MatterContacts } from '../combat/matterContacts';
import type { WorldSize } from '../core/types';
import { getDimensionCoordinator } from '../dimensions/runtime';
import type { PortalEntity } from '../dimensions/types';
import { FuelBlobViews } from '../fuel/blobViews';
import { ParticleViews } from '../particles/views';
import { PlayerBody } from '../player/body';
import { PLAYER_MASS } from '../player/config';
import type { PlayerState } from '../player/state';
import { ProjectileBodies } from '../projectiles/bodies';
import { getSandboxPerfToggles } from '../runtime/startup';
import { PROJECTILES } from '../weapons/config';
import { DimensionBackground } from '../world/DimensionBackground';
import { SpaceWorldRuntime } from '../world/SpaceWorldRuntime';
import { createArcadeTextures } from './arcade/arcadeVisuals';

export class PhaserRiftSpaceScene extends Phaser.Scene {
  private background!: DimensionBackground;
  private compositeCanvas: HTMLCanvasElement | null = null;
  private compositeContext: CanvasRenderingContext2D | null = null;
  private runtime!: SpaceWorldRuntime;
  private worldSize!: WorldSize;
  private readonly perfToggles = getSandboxPerfToggles();

  constructor() {
    super('rift-space');
  }

  create(): void {
    this.worldSize = { width: this.scale.width, height: this.scale.height };
    this.cameras.main.visible = false;
    createArcadeTextures(this);
    this.runtime = new SpaceWorldRuntime('rift', {
      asteroidBodies: new AsteroidBodies(this),
      contacts: new MatterContacts(this),
      createPlayerBody: (player) => this.createPlayerBody(player),
      fuelBlobViews: new FuelBlobViews(),
      particleViews: new ParticleViews(this),
      projectileBodies: new ProjectileBodies(this),
    });
    getDimensionCoordinator().registerWorld(this.runtime);
    this.background = new DimensionBackground(this, this.worldSize, 'rift');
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  private createPlayerBody(player: PlayerState): PlayerBody {
    const body = new PlayerBody(this, player.position, player);
    body.body.setMass(PLAYER_MASS);
    body.body.setFrictionAir(0);
    body.body.setBounce(0.8);
    return body;
  }

  update(time: number, delta: number): void {
    this.runtime.updateSceneEntities({
      deltaMs: delta,
      deltaSeconds: delta / 1000,
      worldSize: this.worldSize,
    });
    this.background.render(time, {
      grid: this.perfToggles.grid,
      starfield: this.perfToggles.starfield,
      threeBackground: this.perfToggles.threeBackground,
    });
  }

  getRuntime(): SpaceWorldRuntime {
    return this.runtime;
  }

  getRenderCanvas(): HTMLCanvasElement {
    return this.renderCompositeCanvas();
  }

  setPortals(_portals: PortalEntity[]): void {}

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
    if (this.compositeCanvas) {
      this.compositeCanvas.width = gameSize.width;
      this.compositeCanvas.height = gameSize.height;
    }
    this.background.resize(this.worldSize);
  }

  private handleShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.runtime.clearNonShipEntities();
    this.compositeCanvas = null;
    this.compositeContext = null;
  }

  private renderCompositeCanvas(): HTMLCanvasElement {
    this.ensureCompositeCanvas();
    if (!this.compositeCanvas || !this.compositeContext) {
      throw new Error('Rift render canvas is unavailable');
    }

    const context = this.compositeContext;
    context.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
    const backgroundCanvas = this.background.getCanvas();
    if (backgroundCanvas) {
      context.drawImage(
        backgroundCanvas,
        0,
        0,
        this.compositeCanvas.width,
        this.compositeCanvas.height,
      );
    }
    this.drawAsteroids(context);
    this.drawProjectiles(context);
    this.drawFuelBlobs(context);
    this.drawParticles(context);
    return this.compositeCanvas;
  }

  private ensureCompositeCanvas(): void {
    if (this.compositeCanvas) return;
    this.compositeCanvas = document.createElement('canvas');
    this.compositeCanvas.width = this.worldSize.width;
    this.compositeCanvas.height = this.worldSize.height;
    this.compositeContext = this.compositeCanvas.getContext('2d');
  }

  private drawAsteroids(context: CanvasRenderingContext2D): void {
    for (const asteroid of this.runtime.world.asteroids) {
      const textureKey = ASTEROID_TEXTURES[asteroid.tier][asteroid.visualVariant];
      const frame = this.textures.getFrame(textureKey);
      const source = frame?.source.image;
      if (frame && source && isDrawableTextureSource(source)) {
        const radius = ASTEROIDS[asteroid.tier].radius;
        context.drawImage(
          source,
          frame.cutX,
          frame.cutY,
          frame.cutWidth,
          frame.cutHeight,
          asteroid.position.x - radius,
          asteroid.position.y - radius,
          radius * 2,
          radius * 2,
        );
      }
    }
  }

  private drawProjectiles(context: CanvasRenderingContext2D): void {
    for (const projectile of this.runtime.world.projectiles) {
      const spec = PROJECTILES[projectile.kind];
      context.save();
      context.translate(projectile.position.x, projectile.position.y);
      context.rotate(projectile.angle);
      context.fillStyle = getProjectileCanvasColor(projectile.kind);
      context.beginPath();
      context.ellipse(0, 0, spec.radius * 2, spec.radius, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  private drawFuelBlobs(context: CanvasRenderingContext2D): void {
    context.fillStyle = 'rgba(103, 232, 249, 0.78)';
    for (const blob of this.runtime.world.fuelBlobs) {
      context.beginPath();
      context.arc(blob.position.x, blob.position.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawParticles(context: CanvasRenderingContext2D): void {
    for (const particle of this.runtime.world.particles) {
      const alpha = Math.max(0, particle.lifetimeMs / particle.maxLifetimeMs);
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = `#${particle.color.toString(16).padStart(6, '0')}`;
      context.translate(particle.position.x, particle.position.y);
      context.rotate(particle.rotation);
      context.beginPath();
      if (particle.kind === 'thruster') {
        const size = particle.size ?? 2;
        context.moveTo(0, -size * 2);
        context.lineTo(size * 3, 0);
        context.lineTo(0, size * 2);
        context.lineTo(-size * 1.5, 0);
        context.closePath();
      } else {
        context.arc(0, 0, particle.radius ?? 2, 0, Math.PI * 2);
      }
      context.fill();
      context.restore();
    }
  }
}

function getProjectileCanvasColor(kind: keyof typeof PROJECTILES): string {
  if (kind === 'blackHole') return 'rgba(0, 0, 0, 0.92)';
  if (kind === 'inspectionProbe') return '#67e8f9';
  if (kind === 'pusher') return '#67e8f9';
  if (kind === 'shotgun') return '#ffd166';
  return '#ffffff';
}

function isDrawableTextureSource(source: unknown): source is CanvasImageSource {
  return (
    source instanceof HTMLCanvasElement ||
    source instanceof HTMLImageElement ||
    source instanceof HTMLVideoElement ||
    (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas)
  );
}
