import Phaser from 'phaser';

import type { ParticleEntity } from './types';

const THRUSTER_PARTICLE_DEPTH = 5;
const EFFECT_PARTICLE_DEPTH = 7;

export class ParticleViews {
  private readonly shapes = new Map<
    number,
    Phaser.GameObjects.Shape | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics
  >();

  constructor(private readonly scene: Phaser.Scene) {}

  add(
    particle: ParticleEntity,
  ): Phaser.GameObjects.Shape | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
    const shape =
      particle.kind === 'thruster'
        ? this.createThrusterShape(particle)
        : particle.kind === 'circle'
          ? this.scene.add.circle(
              particle.position.x,
              particle.position.y,
              particle.radius ?? 1,
              particle.color,
            )
          : this.createParticleGraphics(particle);
    if (particle.kind !== 'thruster') {
      shape.setDepth(
        particle.kind === 'shockwave' ? EFFECT_PARTICLE_DEPTH - 1 : EFFECT_PARTICLE_DEPTH,
      );
    }
    this.shapes.set(particle.id, shape);
    this.sync(particle);
    return shape;
  }

  get(
    particle: ParticleEntity,
  ): Phaser.GameObjects.Shape | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
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
    shape.setAlpha(getParticleAlpha(particle));
    if (particle.kind === 'thruster' && shape instanceof Phaser.GameObjects.Image) {
      const remainingRatio = Math.max(0, particle.lifetimeMs / particle.maxLifetimeMs);
      const displaySize = Math.max(1, (particle.size ?? 1) * remainingRatio * 4);
      shape.setDisplaySize(displaySize, displaySize);
    } else if (shape instanceof Phaser.GameObjects.Graphics) {
      drawParticleGraphics(shape, particle);
    } else if (shape instanceof Phaser.GameObjects.Arc) {
      shape.setRadius(particle.radius ?? particle.size ?? 1);
      shape.setFillStyle(particle.color);
    }
  }

  private createParticleGraphics(particle: ParticleEntity): Phaser.GameObjects.Graphics {
    const shape = this.scene.add.graphics({ x: particle.position.x, y: particle.position.y });
    drawParticleGraphics(shape, particle);
    return shape;
  }

  private createThrusterShape(particle: ParticleEntity): Phaser.GameObjects.Image {
    createThrusterTexture(this.scene);
    const shape = this.scene.add.image(
      particle.position.x,
      particle.position.y,
      'phaser-thruster-particle',
    );
    shape.setTint(particle.color);
    shape.setDisplaySize((particle.size ?? 1) * 2.4, (particle.size ?? 1) * 2.4);
    shape.setDepth(THRUSTER_PARTICLE_DEPTH);
    shape.setRotation(particle.rotation);
    return shape;
  }
}

function drawParticleGraphics(shape: Phaser.GameObjects.Graphics, particle: ParticleEntity): void {
  shape.clear();
  const size = particle.size ?? particle.radius ?? 1;
  if (particle.kind === 'shockwave') {
    drawShockwave(shape, particle, size);
    return;
  }
  if (particle.kind === 'smoke') {
    drawSmoke(shape, particle, size);
    return;
  }
  if (particle.kind === 'shard') {
    drawShard(shape, particle, size);
    return;
  }
  if (particle.kind === 'panel') {
    drawPanel(shape, particle, size);
    return;
  }
  if (particle.kind === 'wing') {
    drawWing(shape, particle, size);
    return;
  }
  if (particle.kind === 'core') {
    drawCore(shape, particle, size);
    return;
  }
  drawSpark(shape, particle, size);
}

function drawShockwave(
  shape: Phaser.GameObjects.Graphics,
  particle: ParticleEntity,
  size: number,
): void {
  const lineWidth = Math.max(2, size * 0.07);
  shape.lineStyle(lineWidth, particle.color2 ?? particle.color, 0.86);
  shape.strokeCircle(0, 0, size * 0.78);
  shape.lineStyle(Math.max(1, lineWidth * 0.45), particle.color, 0.5);
  shape.strokeCircle(0, 0, size * 0.94);
}

function drawSmoke(
  shape: Phaser.GameObjects.Graphics,
  particle: ParticleEntity,
  size: number,
): void {
  shape.fillStyle(particle.glowColor ?? 0xff965a, 0.14);
  shape.fillCircle(0, 0, size * 1.16);
  shape.fillStyle(particle.color2 ?? particle.color, 0.74);
  shape.fillCircle(-size * 0.28, size * 0.06, size * 0.52);
  shape.fillCircle(size * 0.2, -size * 0.1, size * 0.4);
  shape.fillCircle(size * 0.06, size * 0.24, size * 0.34);
  shape.fillStyle(particle.color, 0.58);
  shape.fillCircle(-size * 0.08, 0, size * 0.82);
}

function drawShard(
  shape: Phaser.GameObjects.Graphics,
  particle: ParticleEntity,
  size: number,
): void {
  shape.fillStyle(particle.glowColor ?? particle.color, 0.2);
  shape.fillCircle(0, 0, size * 0.9);
  shape.fillStyle(particle.color, 1);
  shape.beginPath();
  shape.moveTo(size * 0.7, 0);
  shape.lineTo(-size * 0.45, -size * 0.35);
  shape.lineTo(-size * 0.7, 0);
  shape.lineTo(-size * 0.45, size * 0.35);
  shape.closePath();
  shape.fillPath();
  if (particle.color2 !== undefined) {
    shape.fillStyle(particle.color2, 0.42);
    shape.fillTriangle(size * 0.35, 0, -size * 0.45, -size * 0.22, -size * 0.15, 0);
  }
}

function drawPanel(
  shape: Phaser.GameObjects.Graphics,
  particle: ParticleEntity,
  size: number,
): void {
  shape.fillStyle(particle.color, 1);
  shape.beginPath();
  shape.moveTo(size * 0.62, 0);
  shape.lineTo(size * 0.08, -size * 0.34);
  shape.lineTo(-size * 0.56, -size * 0.22);
  shape.lineTo(-size * 0.44, size * 0.24);
  shape.lineTo(size * 0.12, size * 0.32);
  shape.closePath();
  shape.fillPath();
  shape.lineStyle(Math.max(1, size * 0.08), 0xffffff, 0.22);
  shape.strokePath();
}

function drawWing(
  shape: Phaser.GameObjects.Graphics,
  particle: ParticleEntity,
  size: number,
): void {
  shape.fillStyle(particle.color, 1);
  shape.beginPath();
  shape.moveTo(size * 0.82, 0);
  shape.lineTo(-size * 0.14, -size * 0.52);
  shape.lineTo(-size * 0.68, -size * 0.18);
  shape.lineTo(-size * 0.46, size * 0.12);
  shape.lineTo(-size * 0.12, size * 0.26);
  shape.closePath();
  shape.fillPath();
  shape.fillStyle(particle.color2 ?? 0xffffff, 0.18);
  shape.fillTriangle(size * 0.34, 0, -size * 0.12, -size * 0.16, -size * 0.2, size * 0.08);
}

function drawCore(
  shape: Phaser.GameObjects.Graphics,
  particle: ParticleEntity,
  size: number,
): void {
  shape.fillStyle(particle.glowColor ?? particle.color, 0.26);
  shape.fillCircle(0, 0, size * 0.92);
  shape.fillStyle(particle.color, 1);
  shape.fillCircle(0, 0, size * 0.58);
  shape.fillStyle(particle.color2 ?? 0xffffff, 0.38);
  shape.fillCircle(-size * 0.16, -size * 0.12, size * 0.24);
}

function drawSpark(
  shape: Phaser.GameObjects.Graphics,
  particle: ParticleEntity,
  size: number,
): void {
  shape.lineStyle(Math.max(2, size * 0.18), particle.color, 1);
  shape.beginPath();
  shape.moveTo(-size * 0.5, 0);
  shape.lineTo(size * 0.5, 0);
  shape.strokePath();
  shape.lineStyle(Math.max(1, size * 0.08), particle.color2 ?? 0xffffff, 0.45);
  shape.beginPath();
  shape.moveTo(-size * 0.22, 0);
  shape.lineTo(size * 0.28, 0);
  shape.strokePath();
}

function getParticleAlpha(particle: ParticleEntity): number {
  const life = Math.max(0, particle.lifetimeMs / particle.maxLifetimeMs);
  if (particle.kind === 'shockwave') return Math.pow(life, 1.35) * 0.82;
  if (particle.kind === 'smoke') return Math.pow(life, 0.82) * 0.72;
  if (particle.kind === 'core') return Math.min(0.72, 0.12 + life * 0.68);
  return Math.pow(life, 0.6);
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
