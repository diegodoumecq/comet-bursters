import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { PlanetEntity } from '../planets/types';

const WIDTH = 220;
const HEIGHT = 220;
const PADDING = 20;

export type MinimapFog = {
  columns: number;
  discoveredPlanetIds: Set<number>;
  exploredCells: Uint8Array;
  rows: number;
  visibleCells: Uint8Array;
};

export type MinimapNebulaRegion = {
  alpha: number;
  points: Vector[];
};

export class Minimap {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(200);
  }

  render(input: {
    asteroids?: AsteroidEntity[];
    camera: Phaser.Cameras.Scene2D.Camera;
    fog?: MinimapFog;
    nebulaRegions?: MinimapNebulaRegion[];
    planets: PlanetEntity[];
    player: Vector;
    playerAim: Vector;
    viewportMode: 'bounded' | 'wrapped';
    world: WorldSize;
  }): void {
    const x = this.scene.scale.width - WIDTH - PADDING;
    const y = PADDING;
    const scaleX = WIDTH / input.world.width;
    const scaleY = HEIGHT / input.world.height;

    this.graphics.clear();
    this.graphics.fillStyle(0x020617, 0.96);
    this.graphics.fillRect(x, y, WIDTH, HEIGHT);
    this.graphics.lineStyle(2, 0xffffff, 0.18);
    this.graphics.strokeRect(x, y, WIDTH, HEIGHT);

    if (input.fog) this.drawFog(input.fog, x, y);
    this.drawNebulaRegions(input.nebulaRegions ?? [], input.fog, input.world, x, y);
    this.drawGrid(x, y);
    this.drawPlanets(input.planets, input.fog, input.world, x, y, scaleX, scaleY);
    this.drawAsteroids(input.asteroids ?? [], input.fog, input.world, x, y, scaleX, scaleY);
    if (input.viewportMode === 'wrapped') {
      this.drawWrappedViewport(input.camera, input.world, x, y, scaleX, scaleY);
    } else {
      this.drawBoundedViewport(input.camera, x, y, scaleX, scaleY);
    }
    this.drawPlayer(input.player, input.playerAim, input.world, x, y, scaleX, scaleY);
  }

  private drawFog(fog: MinimapFog, x: number, y: number): void {
    const cellWidth = WIDTH / fog.columns;
    const cellHeight = HEIGHT / fog.rows;
    for (let row = 0; row < fog.rows; row += 1) {
      for (let col = 0; col < fog.columns; col += 1) {
        const index = row * fog.columns + col;
        if (fog.exploredCells[index]) {
          const visible = fog.visibleCells[index];
          const alpha = visible ? 0.9 : 0.42;
          this.graphics.fillStyle(visible ? 0x102338 : 0x0a1322, alpha);
          this.graphics.fillRect(x + col * cellWidth, y + row * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
        }
      }
    }
  }

  private drawGrid(x: number, y: number): void {
    this.graphics.lineStyle(1, 0xffffff, 0.08);
    for (let index = 1; index < 4; index += 1) {
      const gridX = x + (WIDTH / 4) * index;
      const gridY = y + (HEIGHT / 4) * index;
      this.graphics.lineBetween(gridX, y, gridX, y + HEIGHT);
      this.graphics.lineBetween(x, gridY, x + WIDTH, gridY);
    }
  }

  private drawPlanets(
    planets: PlanetEntity[],
    fog: MinimapFog | undefined,
    world: WorldSize,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    for (const planet of planets) {
      const discovered = !fog || fog.discoveredPlanetIds.has(planet.id);
      if (discovered) {
        this.graphics.fillStyle(planet.color, 0.9);
        this.graphics.fillCircle(
          x + positiveModulo(planet.position.x, world.width) * scaleX,
          y + positiveModulo(planet.position.y, world.height) * scaleY,
          Math.max(3, planet.radius * scaleX),
        );
      }
    }
  }

  private drawAsteroids(
    asteroids: AsteroidEntity[],
    fog: MinimapFog | undefined,
    world: WorldSize,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    for (const asteroid of asteroids) {
      if (this.isVisibleOnMinimap(asteroid.position, fog, world)) {
        this.graphics.fillStyle(ASTEROIDS[asteroid.tier].color, 0.82);
        this.graphics.fillCircle(
          x + positiveModulo(asteroid.position.x, world.width) * scaleX,
          y + positiveModulo(asteroid.position.y, world.height) * scaleY,
          Math.max(2, ASTEROIDS[asteroid.tier].collisionRadius * scaleX),
        );
      }
    }
  }

  private drawNebulaRegions(
    regions: MinimapNebulaRegion[],
    fog: MinimapFog | undefined,
    world: WorldSize,
    x: number,
    y: number,
  ): void {
    if (regions.length === 0) return;

    const columns = fog?.columns ?? MINIMAP_DEFAULT_COLUMNS;
    const rows = fog?.rows ?? MINIMAP_DEFAULT_ROWS;
    const cellWidth = WIDTH / columns;
    const cellHeight = HEIGHT / rows;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const index = row * columns + col;
        const discovered = !fog || fog.exploredCells[index];
        if (discovered) {
          const worldPosition = {
            x: ((col + 0.5) / columns) * world.width,
            y: ((row + 0.5) / rows) * world.height,
          };
          const region = getNebulaRegionAt(worldPosition, regions);
          if (region) {
            const visible = !fog || fog.visibleCells[index];
            this.graphics.fillStyle(0x2d7185, (visible ? 0.42 : 0.24) * region.alpha);
            this.graphics.fillRect(
              x + col * cellWidth,
              y + row * cellHeight,
              cellWidth + 0.5,
              cellHeight + 0.5,
            );
          }
        }
      }
    }
  }

  private isVisibleOnMinimap(position: Vector, fog: MinimapFog | undefined, world: WorldSize): boolean {
    if (!fog) return true;
    const col = Math.floor((positiveModulo(position.x, world.width) / world.width) * fog.columns);
    const row = Math.floor((positiveModulo(position.y, world.height) / world.height) * fog.rows);
    const index = Phaser.Math.Clamp(row, 0, fog.rows - 1) * fog.columns +
      Phaser.Math.Clamp(col, 0, fog.columns - 1);
    return Boolean(fog.visibleCells[index]);
  }

  private drawBoundedViewport(
    camera: Phaser.Cameras.Scene2D.Camera,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const boxX = camera.scrollX * scaleX;
    const boxY = camera.scrollY * scaleY;
    const boxWidth = Math.min(WIDTH, camera.width * scaleX);
    const boxHeight = Math.min(HEIGHT, camera.height * scaleY);
    this.graphics.lineStyle(1.5, 0xffffff, 0.72);
    this.strokeClippedRect(x + boxX, y + boxY, boxWidth, boxHeight, x, y, WIDTH, HEIGHT);
  }

  private drawWrappedViewport(
    camera: Phaser.Cameras.Scene2D.Camera,
    world: WorldSize,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const boxX = positiveModulo(camera.scrollX, world.width) * scaleX;
    const boxY = positiveModulo(camera.scrollY, world.height) * scaleY;
    const boxWidth = Math.min(WIDTH, camera.width * scaleX);
    const boxHeight = Math.min(HEIGHT, camera.height * scaleY);
    this.graphics.lineStyle(1.5, 0xffffff, 0.72);
    for (const offsetX of [0, -WIDTH]) {
      for (const offsetY of [0, -HEIGHT]) {
        const drawX = x + boxX + offsetX;
        const drawY = y + boxY + offsetY;
        if (drawX < x + WIDTH && drawX + boxWidth > x && drawY < y + HEIGHT && drawY + boxHeight > y) {
          this.strokeClippedRect(drawX, drawY, boxWidth, boxHeight, x, y, WIDTH, HEIGHT);
        }
      }
    }
  }

  private strokeClippedRect(
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number,
    clipX: number,
    clipY: number,
    clipWidth: number,
    clipHeight: number,
  ): void {
    const left = Math.max(rectX, clipX);
    const right = Math.min(rectX + rectWidth, clipX + clipWidth);
    const top = Math.max(rectY, clipY);
    const bottom = Math.min(rectY + rectHeight, clipY + clipHeight);

    if (rectY >= clipY && rectY <= clipY + clipHeight) this.graphics.lineBetween(left, rectY, right, rectY);
    if (rectY + rectHeight >= clipY && rectY + rectHeight <= clipY + clipHeight) {
      this.graphics.lineBetween(left, rectY + rectHeight, right, rectY + rectHeight);
    }
    if (rectX >= clipX && rectX <= clipX + clipWidth) this.graphics.lineBetween(rectX, top, rectX, bottom);
    if (rectX + rectWidth >= clipX && rectX + rectWidth <= clipX + clipWidth) {
      this.graphics.lineBetween(rectX + rectWidth, top, rectX + rectWidth, bottom);
    }
  }

  private drawPlayer(
    player: Vector,
    aim: Vector,
    world: WorldSize,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const centerX = x + positiveModulo(player.x, world.width) * scaleX;
    const centerY = y + positiveModulo(player.y, world.height) * scaleY;
    const angle = Math.atan2(aim.y, aim.x);
    const size = 6;
    this.graphics.fillStyle(0xe0f2fe, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(centerX + Math.cos(angle) * size, centerY + Math.sin(angle) * size);
    this.graphics.lineTo(centerX + Math.cos(angle + 2.45) * size, centerY + Math.sin(angle + 2.45) * size);
    this.graphics.lineTo(centerX + Math.cos(angle - 2.45) * size, centerY + Math.sin(angle - 2.45) * size);
    this.graphics.closePath();
    this.graphics.fillPath();
  }
}

const MINIMAP_DEFAULT_COLUMNS = 44;
const MINIMAP_DEFAULT_ROWS = 44;

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function getNebulaRegionAt(
  point: Vector,
  regions: MinimapNebulaRegion[],
): MinimapNebulaRegion | null {
  for (const region of regions) {
    if (pointInPolygon(point, region.points)) return region;
  }
  return null;
}

function pointInPolygon(point: Vector, polygon: Vector[]): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const denominator = previous.y - current.y;
    const intersectionX =
      ((previous.x - current.x) * (point.y - current.y)) / (Math.abs(denominator) < 0.0001 ? 0.0001 : denominator) +
      current.x;
    if (crossesY && point.x < intersectionX) inside = !inside;
  }
  return inside;
}
