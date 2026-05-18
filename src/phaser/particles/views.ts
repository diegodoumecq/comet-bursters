import Phaser from 'phaser';

import type { ParticleEntity } from './types';

export class ParticleViews {
  private readonly shapes = new Map<number, Phaser.GameObjects.Shape | Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(particle: ParticleEntity): Phaser.GameObjects.Shape | Phaser.GameObjects.Image {
    const shape = particle.kind === 'circle'
      ? this.scene.add.circle(particle.position.x, particle.position.y, particle.radius ?? 1, particle.color)
      : this.createThrusterShape(particle);
    this.shapes.set(particle.id, shape);
    return shape;
  }

  get(particle: ParticleEntity): Phaser.GameObjects.Shape | Phaser.GameObjects.Image {
    const shape = this.shapes.get(particle.id);
    if (!shape) throw new Error(`Missing particle shape ${particle.id}`);
    return shape;
  }

  remove(particle: ParticleEntity): void {
    this.get(particle).destroy();
    this.shapes.delete(particle.id);
  }

  sync(particle: ParticleEntity): void {
    const shape = this.get(particle);
    shape.setPosition(particle.position.x, particle.position.y);
    shape.setRotation(particle.rotation);
    shape.setAlpha(Math.max(0, particle.lifetimeMs / particle.maxLifetimeMs));
    if (particle.kind === 'thruster' && shape instanceof Phaser.GameObjects.Image) {
      const remainingRatio = Math.max(0, particle.lifetimeMs / particle.maxLifetimeMs);
      const displaySize = Math.max(1, (particle.size ?? 1) * remainingRatio * 4);
      shape.setDisplaySize(displaySize, displaySize);
    }
  }

  private createThrusterShape(particle: ParticleEntity): Phaser.GameObjects.Image {
    createThrusterTexture(this.scene);
    const shape = this.scene.add.image(particle.position.x, particle.position.y, 'phaser-thruster-particle');
    shape.setTint(particle.color);
    shape.setDisplaySize((particle.size ?? 1) * 2.4, (particle.size ?? 1) * 2.4);
    shape.setRotation(particle.rotation);
    return shape;
  }
}

function createThrusterTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('phaser-thruster-particle')) return;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(32, 32);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  glow.addColorStop(0, 'rgba(255,255,255,0.1)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.quadraticCurveTo(4, -9, 12, 0);
  ctx.quadraticCurveTo(9, 4, 0, 12);
  ctx.quadraticCurveTo(-4, 9, -12, 0);
  ctx.quadraticCurveTo(-9, -4, 0, -12);
  ctx.closePath();
  ctx.fill();
  scene.textures.addCanvas('phaser-thruster-particle', canvas);
}
