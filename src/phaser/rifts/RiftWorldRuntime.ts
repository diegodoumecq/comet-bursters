import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/logic';
import { ASTEROID_TEXTURES } from '../asteroids/textures';
import type { WorldSize } from '../core/types';
import { FUEL_BLOB_RADIUS } from '../fuel/rules';
import type { PlayerState } from '../player/state';
import { PLAYER_TEXTURE_KEY, PLAYER_VISUAL_SIZE } from '../player/textures';
import { getBlackHoleRenderRadius } from '../projectiles/blackHoles';
import type { ProjectileEntity } from '../projectiles/types';
import { PROJECTILES } from '../weapons/config';
import { getRiftSourceLocalPosition } from './geometry';
import { isVisibleInPortal } from './sourceSpace';
import { riftToArcade } from './transforms';
import type { RiftPortal, RiftSourceSpace } from './types';

const RIFT_GRID_SPACING = 72;

export class RiftWorldRuntime {
  private readonly canvas = document.createElement('canvas');
  private readonly context = this.canvas.getContext('2d');
  private readonly portals: RiftPortal[] = [];
  private readonly sourceSpaces: RiftSourceSpace[] = [];
  private size: WorldSize = { width: 1, height: 1 };

  constructor(private readonly scene: Phaser.Scene) {}

  getRenderCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  resize(size: WorldSize): void {
    this.size = size;
    if (this.canvas.width === size.width && this.canvas.height === size.height) return;
    this.canvas.width = size.width;
    this.canvas.height = size.height;
  }

  setPortals(portals: RiftPortal[]): void {
    this.portals.length = 0;
    this.portals.push(...portals);
  }

  setSourceSpaces(sourceSpaces: RiftSourceSpace[]): void {
    this.sourceSpaces.length = 0;
    this.sourceSpaces.push(...sourceSpaces);
  }

  update(now: number): void {
    if (!this.context) return;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const portal of this.portals) this.drawPortalView(portal, now);
    for (const sourceSpace of this.sourceSpaces) this.drawSourceSpaceEffects(sourceSpace);
    for (const sourceSpace of this.sourceSpaces) this.drawSourceAsteroids(sourceSpace);
    for (const sourceSpace of this.sourceSpaces) this.drawSourceProjectiles(sourceSpace);
    for (const sourceSpace of this.sourceSpaces) this.drawSourcePlayer(sourceSpace);
  }

  destroy(): void {
    this.portals.length = 0;
    this.sourceSpaces.length = 0;
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  private drawPortalView(portal: RiftPortal, now: number): void {
    if (!this.context) return;
    const pulse = 0.5 + Math.sin(now * 0.003 + portal.id) * 0.5;
    this.context.save();
    this.context.translate(portal.position.x, portal.position.y);
    this.context.rotate(portal.angle);
    this.drawRiftBackdrop(portal, pulse);
    this.drawRiftGrid(now, pulse);
    this.drawRiftAnchor(portal, pulse);
    this.context.restore();
  }

  private drawRiftBackdrop(portal: RiftPortal, pulse: number): void {
    if (!this.context) return;
    const gradient = this.context.createRadialGradient(0, 0, 4, 0, 0, portal.radiusX * 1.4);
    gradient.addColorStop(0, `rgba(93, 244, 255, ${0.32 + pulse * 0.08})`);
    gradient.addColorStop(0.45, 'rgba(32, 42, 92, 0.36)');
    gradient.addColorStop(1, 'rgba(2, 5, 14, 0.92)');
    this.context.fillStyle = gradient;
    this.context.fillRect(
      -this.size.width,
      -this.size.height,
      this.size.width * 2,
      this.size.height * 2,
    );
  }

  private drawRiftGrid(now: number, pulse: number): void {
    if (!this.context) return;
    const offset = ((now * 0.018) % RIFT_GRID_SPACING) - RIFT_GRID_SPACING;
    this.context.strokeStyle = `rgba(103, 232, 249, ${0.16 + pulse * 0.08})`;
    this.context.lineWidth = 1;
    for (let x = -this.size.width + offset; x <= this.size.width; x += RIFT_GRID_SPACING) {
      this.context.beginPath();
      this.context.moveTo(x, -this.size.height);
      this.context.lineTo(x, this.size.height);
      this.context.stroke();
    }
    for (let y = -this.size.height + offset; y <= this.size.height; y += RIFT_GRID_SPACING) {
      this.context.beginPath();
      this.context.moveTo(-this.size.width, y);
      this.context.lineTo(this.size.width, y);
      this.context.stroke();
    }
  }

  private drawRiftAnchor(portal: RiftPortal, pulse: number): void {
    if (!this.context) return;
    this.context.strokeStyle = `rgba(255, 209, 102, ${0.38 + pulse * 0.2})`;
    this.context.lineWidth = 3;
    this.context.beginPath();
    this.context.ellipse(
      0,
      0,
      portal.apertureRadiusX * 0.72,
      portal.apertureRadiusY * 0.72,
      0,
      0,
      Math.PI * 2,
    );
    this.context.stroke();
  }

  private drawSourceAsteroids(sourceSpace: RiftSourceSpace): void {
    for (const sourceAsteroid of sourceSpace.asteroids) {
      this.drawSourceAsteroid(sourceSpace, sourceAsteroid);
    }
  }

  private drawSourceAsteroid(
    sourceSpace: RiftSourceSpace,
    sourceAsteroid: RiftSourceSpace['asteroids'][number],
  ): void {
    if (!this.context) return;
    const asteroid = sourceAsteroid.asteroid;
    const localPosition = getRiftSourceLocalPosition(
      sourceSpace.portal,
      sourceAsteroid.sourcePosition,
    );
    if (!isVisibleInPortal(asteroid, localPosition, sourceSpace.portal)) return;
    const textureKey = ASTEROID_TEXTURES[asteroid.tier][asteroid.visualVariant];
    const texture = this.scene.textures.get(textureKey);
    const frame = texture.getSourceImage() as CanvasImageSource;
    const radius = ASTEROIDS[asteroid.tier].radius;
    const scenePosition = riftToArcade(sourceSpace.portal, sourceAsteroid.sourcePosition);
    this.context.save();
    this.context.drawImage(
      frame,
      scenePosition.x - radius,
      scenePosition.y - radius,
      radius * 2,
      radius * 2,
    );
    this.context.restore();
  }

  private drawSourceSpaceEffects(sourceSpace: RiftSourceSpace): void {
    for (const blob of sourceSpace.fuelBlobs) {
      const scenePosition = riftToArcade(sourceSpace.portal, blob.position);
      this.drawFuelBlob(scenePosition.x, scenePosition.y, blob.wobbleSeed);
    }
    for (const particle of sourceSpace.particles) {
      const scenePosition = riftToArcade(sourceSpace.portal, particle.position);
      this.drawParticle(scenePosition.x, scenePosition.y, particle);
    }
  }

  private drawSourceProjectiles(sourceSpace: RiftSourceSpace): void {
    for (const projectile of sourceSpace.projectiles) {
      this.drawSourceProjectile(sourceSpace, projectile);
    }
  }

  private drawSourceProjectile(sourceSpace: RiftSourceSpace, projectile: ProjectileEntity): void {
    if (!this.context) return;
    const scenePosition = riftToArcade(sourceSpace.portal, projectile.position);
    const radius =
      projectile.kind === 'blackHole'
        ? getBlackHoleRenderRadius(projectile)
        : PROJECTILES[projectile.kind].radius;
    this.context.save();
    this.context.translate(scenePosition.x, scenePosition.y);
    this.context.rotate(projectile.angle);
    this.context.fillStyle = `#${getProjectileTint(projectile).toString(16).padStart(6, '0')}`;
    this.context.beginPath();
    if (projectile.kind === 'blackHole') {
      this.context.arc(0, 0, radius, 0, Math.PI * 2);
    } else {
      this.context.ellipse(0, 0, radius * 2.1, radius * 0.8, 0, 0, Math.PI * 2);
    }
    this.context.fill();
    this.context.restore();
  }

  private drawFuelBlob(x: number, y: number, wobbleSeed: number): void {
    if (!this.context) return;
    this.context.save();
    this.context.fillStyle = '#38f8a8';
    this.context.globalAlpha = 0.78 + Math.sin(wobbleSeed * Math.PI * 2) * 0.12;
    this.context.beginPath();
    this.context.arc(x, y, FUEL_BLOB_RADIUS, 0, Math.PI * 2);
    this.context.fill();
    this.context.restore();
  }

  private drawParticle(x: number, y: number, particle: RiftSourceSpace['particles'][number]): void {
    if (!this.context) return;
    const alpha = Math.max(0, particle.lifetimeMs / particle.maxLifetimeMs);
    const radius = particle.radius ?? particle.size ?? 1;
    this.context.save();
    this.context.globalAlpha = alpha;
    this.context.fillStyle = `#${particle.color.toString(16).padStart(6, '0')}`;
    this.context.beginPath();
    this.context.arc(x, y, radius, 0, Math.PI * 2);
    this.context.fill();
    this.context.restore();
  }

  private drawSourcePlayer(sourceSpace: RiftSourceSpace): void {
    if (!sourceSpace.player) return;
    this.drawPlayer(sourceSpace.portal, sourceSpace.player);
  }

  private drawPlayer(portal: RiftPortal, player: PlayerState): void {
    if (!this.context) return;
    const texture = this.scene.textures.get(PLAYER_TEXTURE_KEY);
    const frame = texture.getSourceImage() as CanvasImageSource;
    const scenePosition = riftToArcade(portal, player.position);
    const size = PLAYER_VISUAL_SIZE * 2 * player.scale;
    this.context.save();
    this.context.translate(scenePosition.x, scenePosition.y);
    this.context.rotate(player.rotation);
    this.context.drawImage(frame, -size * 0.5, -size * 0.5, size, size);
    this.context.restore();
  }
}

function getProjectileTint(projectile: ProjectileEntity): number {
  if (projectile.kind === 'inspectionProbe' || projectile.kind === 'pusher') return 0x67e8f9;
  if (projectile.kind === 'shotgun') return 0xffd166;
  if (projectile.kind === 'blackHole') return 0x000000;
  return 0xffffff;
}
