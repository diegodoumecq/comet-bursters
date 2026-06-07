import Phaser from 'phaser';

import type { SandboxPlanetEntity } from './planetFuel';
import { getExtractorPosition } from './planetFuel';

const EXTRACTOR_BODY_TEXTURE = 'sandbox-extractor-body';
const EXTRACTOR_PULSE_TEXTURE = 'sandbox-extractor-pulse';
const EXTRACTOR_TEXTURE_WIDTH = 96;
const EXTRACTOR_TEXTURE_HEIGHT = 96;
const EXTRACTOR_TEXTURE_ORIGIN_X = 0.5;
const EXTRACTOR_TEXTURE_ORIGIN_Y = 60 / EXTRACTOR_TEXTURE_HEIGHT;

type ExtractorSprites = {
  body: Phaser.GameObjects.Image;
  pulse: Phaser.GameObjects.Image;
};

export class SandboxPlanetOverlay {
  private readonly inspectionGraphics: Phaser.GameObjects.Graphics;
  private readonly extractors = new Map<number, ExtractorSprites>();

  constructor(private readonly scene: Phaser.Scene) {
    ensureExtractorTextures(scene);
    this.inspectionGraphics = scene.add
      .graphics()
      .setName('sandbox-planet-inspection-overlay')
      .setDepth(1.9);
  }

  render(planets: SandboxPlanetEntity[], now: number): void {
    this.inspectionGraphics.clear();
    this.syncExtractors(planets, now);
    for (const planet of planets) {
      if (now < planet.inspectedUntil) this.drawInspectionOverlay(planet);
    }
  }

  private syncExtractors(planets: SandboxPlanetEntity[], now: number): void {
    const activePlanetIds = new Set<number>();
    for (const planet of planets) {
      activePlanetIds.add(planet.id);
      const sprites = this.getExtractorSprites(planet.id);
      const position = getExtractorPosition(planet);
      const angle = planet.extractor.angle + Math.PI * 0.5;
      const active = planet.fuelReserve > 0;
      const pulse = active ? 0.72 + Math.sin(now * 0.006 + planet.visualSeed) * 0.18 : 0.2;

      sprites.body.setPosition(position.x, position.y).setRotation(angle);
      sprites.pulse.setPosition(position.x, position.y).setRotation(angle).setAlpha(pulse);
    }

    for (const [planetId, sprites] of this.extractors) {
      if (activePlanetIds.has(planetId)) {
        sprites.body.setVisible(true);
        sprites.pulse.setVisible(true);
      } else {
        sprites.body.destroy();
        sprites.pulse.destroy();
        this.extractors.delete(planetId);
      }
    }
  }

  private getExtractorSprites(planetId: number): ExtractorSprites {
    const existing = this.extractors.get(planetId);
    if (existing) return existing;

    const body = this.scene.add
      .image(0, 0, EXTRACTOR_BODY_TEXTURE)
      .setName('sandbox-planet-static-extractor')
      .setOrigin(EXTRACTOR_TEXTURE_ORIGIN_X, EXTRACTOR_TEXTURE_ORIGIN_Y)
      .setDepth(2);
    const pulse = this.scene.add
      .image(0, 0, EXTRACTOR_PULSE_TEXTURE)
      .setName('sandbox-planet-extractor-pulse')
      .setOrigin(EXTRACTOR_TEXTURE_ORIGIN_X, EXTRACTOR_TEXTURE_ORIGIN_Y)
      .setDepth(2.1);
    const sprites = { body, pulse };
    this.extractors.set(planetId, sprites);
    return sprites;
  }

  private drawInspectionOverlay(planet: SandboxPlanetEntity): void {
    this.inspectionGraphics.fillStyle(0x020617, 0.5);
    this.inspectionGraphics.fillCircle(planet.position.x, planet.position.y, planet.radius * 0.96);
    this.inspectionGraphics.lineStyle(3, 0x7dd3fc, 0.82);
    this.inspectionGraphics.strokeCircle(
      planet.position.x,
      planet.position.y,
      planet.radius * 0.96,
    );
  }
}

function ensureExtractorTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(EXTRACTOR_BODY_TEXTURE)) {
    scene.textures.addCanvas(EXTRACTOR_BODY_TEXTURE, createExtractorBodyCanvas());
  }
  if (!scene.textures.exists(EXTRACTOR_PULSE_TEXTURE)) {
    scene.textures.addCanvas(EXTRACTOR_PULSE_TEXTURE, createExtractorPulseCanvas());
  }
}

function createExtractorBodyCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = EXTRACTOR_TEXTURE_WIDTH;
  canvas.height = EXTRACTOR_TEXTURE_HEIGHT;
  const context = canvas.getContext('2d')!;
  context.translate(EXTRACTOR_TEXTURE_WIDTH * 0.5, 60);

  fillRoundedRect(context, -24, -12, 48, 24, 5, '#0b1220');
  strokeRoundedRect(context, -24, -12, 48, 24, 5, '#334155', 2);

  context.fillStyle = '#111827';
  context.fillRect(-17, -25, 34, 13);
  context.strokeStyle = '#475569';
  context.lineWidth = 2;
  context.strokeRect(-17, -25, 34, 13);

  context.fillStyle = '#1e293b';
  context.fillRect(-10, -39, 20, 14);
  context.strokeStyle = 'rgba(100, 116, 139, 0.9)';
  context.lineWidth = 2;
  context.strokeRect(-10, -39, 20, 14);

  context.strokeStyle = 'rgba(148, 163, 184, 0.95)';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, -39);
  context.lineTo(0, -53);
  context.stroke();
  return canvas;
}

function createExtractorPulseCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = EXTRACTOR_TEXTURE_WIDTH;
  canvas.height = EXTRACTOR_TEXTURE_HEIGHT;
  const context = canvas.getContext('2d')!;
  context.translate(EXTRACTOR_TEXTURE_WIDTH * 0.5, 60);

  context.fillStyle = '#67e8f9';
  context.fillRect(-14, -7, 9, 5);
  context.fillRect(5, -7, 9, 5);
  context.fillStyle = '#22d3ee';
  context.fillRect(-7, -21, 14, 4);
  context.strokeStyle = '#67e8f9';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-8, -53);
  context.lineTo(8, -53);
  context.stroke();
  return canvas;
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
): void {
  traceRoundedRect(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
  lineWidth: number,
): void {
  traceRoundedRect(context, x, y, width, height, radius);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

function traceRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
