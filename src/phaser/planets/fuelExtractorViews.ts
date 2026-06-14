import Phaser from 'phaser';

import type { FuelExtractionPlanetEntity } from './fuelExtraction';
import { getFuelExtractorPosition, getFuelExtractorWorldAngle } from './fuelExtraction';

const EXTRACTOR_BODY_TEXTURE = 'planet-fuel-extractor-building-cyberpunk-v1';
const EXTRACTOR_TEXTURE_WIDTH = 128;
const EXTRACTOR_TEXTURE_HEIGHT = 136;
const EXTRACTOR_TEXTURE_ORIGIN_X = 0.5;
const EXTRACTOR_TEXTURE_ORIGIN_Y = 100 / EXTRACTOR_TEXTURE_HEIGHT;
const EXTRACTOR_DISPLAY_SCALE = 0.5;
const EXTRACTOR_BASE_Y = 0;
const EXTRACTOR_MAIN_TOP = -70;
const EXTRACTOR_MAIN_WIDTH = 58;
const EXTRACTOR_MAIN_HEIGHT = 70;

type FuelExtractorSprites = {
  body: Phaser.GameObjects.Image;
};

export class FuelExtractorViews {
  private readonly extractors = new Map<number, FuelExtractorSprites>();

  constructor(private readonly scene: Phaser.Scene) {
    ensureFuelExtractorTextures(scene);
  }

  sync(planets: FuelExtractionPlanetEntity[], _now: number): void {
    const activePlanetIds = new Set<number>();
    for (const planet of planets) {
      activePlanetIds.add(planet.id);
      const sprites = this.getExtractorSprites(planet.id);
      const position = getFuelExtractorPosition(planet);
      const angle = getFuelExtractorWorldAngle(planet) + Math.PI * 0.5;

      sprites.body.setPosition(position.x, position.y).setRotation(angle);
    }
    this.removeInactiveExtractors(activePlanetIds);
  }

  destroy(): void {
    for (const sprites of this.extractors.values()) {
      sprites.body.destroy();
    }
    this.extractors.clear();
  }

  private getExtractorSprites(planetId: number): FuelExtractorSprites {
    const existing = this.extractors.get(planetId);
    if (existing) return existing;

    const body = this.scene.add
      .image(0, 0, EXTRACTOR_BODY_TEXTURE)
      .setName('planet-fuel-extractor-body')
      .setOrigin(EXTRACTOR_TEXTURE_ORIGIN_X, EXTRACTOR_TEXTURE_ORIGIN_Y)
      .setScale(EXTRACTOR_DISPLAY_SCALE)
      .setDepth(2);
    const sprites = { body };
    this.extractors.set(planetId, sprites);
    return sprites;
  }

  private removeInactiveExtractors(activePlanetIds: Set<number>): void {
    for (const [planetId, sprites] of this.extractors) {
      if (activePlanetIds.has(planetId)) {
        sprites.body.setVisible(true);
      } else {
        sprites.body.destroy();
        this.extractors.delete(planetId);
      }
    }
  }
}

function ensureFuelExtractorTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(EXTRACTOR_BODY_TEXTURE)) {
    scene.textures.addCanvas(EXTRACTOR_BODY_TEXTURE, createFuelExtractorBodyCanvas());
  }
}

function createFuelExtractorBodyCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = EXTRACTOR_TEXTURE_WIDTH;
  canvas.height = EXTRACTOR_TEXTURE_HEIGHT;
  const context = canvas.getContext('2d')!;
  context.translate(EXTRACTOR_TEXTURE_WIDTH * 0.5, 100);

  drawCyberpunkExtractorGlow(context);
  drawCyberpunkExtractorSilhouette(context);
  drawCyberpunkExtractorLights(context);
  drawCyberpunkExtractorBase(context);
  return canvas;
}

function drawCyberpunkExtractorGlow(context: CanvasRenderingContext2D): void {
  context.save();
  context.globalAlpha = 0.16;
  context.shadowColor = '#57d9ff';
  context.shadowBlur = 12;
  context.fillStyle = '#57d9ff';
  context.fillRect(-31, EXTRACTOR_MAIN_TOP + 12, 62, EXTRACTOR_MAIN_HEIGHT - 12);
  context.restore();
}

function drawCyberpunkExtractorSilhouette(context: CanvasRenderingContext2D): void {
  const mainLeft = -EXTRACTOR_MAIN_WIDTH * 0.5;

  context.fillStyle = '#07101c';
  context.strokeStyle = '#5f7f96';
  context.lineWidth = 2;
  drawPolygon(context, [
    { x: mainLeft, y: EXTRACTOR_BASE_Y },
    { x: mainLeft, y: EXTRACTOR_MAIN_TOP + 14 },
    { x: -14, y: EXTRACTOR_MAIN_TOP + 4 },
    { x: 14, y: EXTRACTOR_MAIN_TOP + 4 },
    { x: -mainLeft, y: EXTRACTOR_MAIN_TOP + 14 },
    { x: -mainLeft, y: EXTRACTOR_BASE_Y },
  ]);

  context.fillStyle = '#0b1726';
  context.strokeStyle = '#40566a';
  drawRect(context, -10, EXTRACTOR_MAIN_TOP - 8, 20, 12);

  context.strokeStyle = '#5f7f96';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, EXTRACTOR_MAIN_TOP - 8);
  context.lineTo(0, EXTRACTOR_MAIN_TOP - 20);
  context.stroke();
}

function drawCyberpunkExtractorLights(context: CanvasRenderingContext2D): void {
  context.save();
  context.shadowBlur = 5;
  context.shadowColor = '#57d9ff';
  context.fillStyle = '#8feaff';
  context.fillRect(-15, -48, 4, 24);
  context.fillRect(11, -48, 4, 24);
  context.fillRect(-4, -62, 8, 3);
  context.restore();
}

function drawCyberpunkExtractorBase(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#101a25';
  context.strokeStyle = '#5f7f96';
  context.lineWidth = 2;
  drawPolygon(context, [
    { x: -46, y: EXTRACTOR_BASE_Y },
    { x: 46, y: EXTRACTOR_BASE_Y },
    { x: 38, y: 10 },
    { x: -38, y: 10 },
  ]);

  context.strokeStyle = '#57d9ff';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(-20, 5);
  context.lineTo(20, 5);
  context.stroke();
}

function drawRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillRect(x, y, width, height);
  context.strokeRect(x, y, width, height);
}

function drawPolygon(context: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
  if (points.length === 0) return;

  const [firstPoint, ...remainingPoints] = points;
  context.beginPath();
  context.moveTo(firstPoint.x, firstPoint.y);
  for (const point of remainingPoints) {
    context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.fill();
  context.stroke();
}
