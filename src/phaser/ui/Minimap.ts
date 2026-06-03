import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { PlanetEntity } from '../planets/types';
import type { NebulaRegionColor, NebulaRegionVisuals } from '../scenes/sandbox/nebulaRegions';

const WIDTH = 220;
const HEIGHT = 220;
const PADDING = 20;
const NEBULA_SAMPLE_SCALE = 2;

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
  visuals?: NebulaRegionVisuals;
};

export type MinimapBiomeRegion = {
  points: Vector[];
};

type MinimapNebulaCoverageCell = {
  alpha: number;
  color: number;
};

type MinimapNebulaCoverage = {
  cells: Array<MinimapNebulaCoverageCell | null>;
  columns: number;
  key: string;
  rows: number;
};

export class Minimap {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private nebulaCoverage: MinimapNebulaCoverage | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(200);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  render(input: {
    asteroids?: AsteroidEntity[];
    biomeRegions?: MinimapBiomeRegion[];
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
    this.drawBiomeRegions(input.biomeRegions ?? [], input.world, x, y, scaleX, scaleY);
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

  private drawBiomeRegions(
    regions: MinimapBiomeRegion[],
    world: WorldSize,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    if (regions.length === 0) return;

    this.graphics.lineStyle(1, 0x7dd3fc, 0.7);
    for (const region of regions) {
      for (const offsetX of [-world.width, 0, world.width]) {
        for (const offsetY of [-world.height, 0, world.height]) {
          this.drawBiomeRegionCopy(region, offsetX, offsetY, x, y, scaleX, scaleY);
        }
      }
    }
  }

  private drawBiomeRegionCopy(
    region: MinimapBiomeRegion,
    offsetX: number,
    offsetY: number,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    for (let index = 0; index < region.points.length; index += 1) {
      const start = region.points[index];
      const end = region.points[(index + 1) % region.points.length];
      const clipped = clipLineToRect(
        {
          x: x + (start.x + offsetX) * scaleX,
          y: y + (start.y + offsetY) * scaleY,
        },
        {
          x: x + (end.x + offsetX) * scaleX,
          y: y + (end.y + offsetY) * scaleY,
        },
        { bottom: y + HEIGHT, left: x, right: x + WIDTH, top: y },
      );
      if (clipped) {
        this.graphics.lineBetween(clipped.start.x, clipped.start.y, clipped.end.x, clipped.end.y);
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
    const sampleColumns = columns * NEBULA_SAMPLE_SCALE;
    const sampleRows = rows * NEBULA_SAMPLE_SCALE;
    const cellWidth = WIDTH / sampleColumns;
    const cellHeight = HEIGHT / sampleRows;
    const coverage = this.getNebulaCoverage(regions, world, sampleColumns, sampleRows);

    for (let row = 0; row < sampleRows; row += 1) {
      for (let col = 0; col < sampleColumns; col += 1) {
        const fogCol = Math.floor(col / NEBULA_SAMPLE_SCALE);
        const fogRow = Math.floor(row / NEBULA_SAMPLE_SCALE);
        const index = fogRow * columns + fogCol;
        const discovered = !fog || fog.exploredCells[index];
        if (discovered) {
          const coverageCell = coverage.cells[row * sampleColumns + col];
          if (coverageCell) {
            const visible = !fog || fog.visibleCells[index];
            this.graphics.fillStyle(
              coverageCell.color,
              (visible ? 0.46 : 0.26) * coverageCell.alpha,
            );
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

  private getNebulaCoverage(
    regions: MinimapNebulaRegion[],
    world: WorldSize,
    columns: number,
    rows: number,
  ): MinimapNebulaCoverage {
    const key = `${world.width}:${world.height}:${columns}:${rows}:${regions.map((region) => region.alpha).join(',')}`;
    if (this.nebulaCoverage?.key === key) return this.nebulaCoverage;

    const cells: Array<MinimapNebulaCoverageCell | null> = Array.from(
      { length: columns * rows },
      () => null,
    );
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const worldPosition = {
          x: ((col + 0.5) / columns) * world.width,
          y: ((row + 0.5) / rows) * world.height,
        };
        const region = getNebulaRegionAt(worldPosition, regions);
        if (region) {
          cells[row * columns + col] = {
            alpha: region.alpha,
            color: getNebulaMinimapColor(region),
          };
        }
      }
    }
    this.nebulaCoverage = { cells, columns, key, rows };
    return this.nebulaCoverage;
  }

  private isVisibleOnMinimap(
    position: Vector,
    fog: MinimapFog | undefined,
    world: WorldSize,
  ): boolean {
    if (!fog) return true;
    const col = Math.floor((positiveModulo(position.x, world.width) / world.width) * fog.columns);
    const row = Math.floor((positiveModulo(position.y, world.height) / world.height) * fog.rows);
    const index =
      Phaser.Math.Clamp(row, 0, fog.rows - 1) * fog.columns +
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
        if (
          drawX < x + WIDTH &&
          drawX + boxWidth > x &&
          drawY < y + HEIGHT &&
          drawY + boxHeight > y
        ) {
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

    if (rectY >= clipY && rectY <= clipY + clipHeight)
      this.graphics.lineBetween(left, rectY, right, rectY);
    if (rectY + rectHeight >= clipY && rectY + rectHeight <= clipY + clipHeight) {
      this.graphics.lineBetween(left, rectY + rectHeight, right, rectY + rectHeight);
    }
    if (rectX >= clipX && rectX <= clipX + clipWidth)
      this.graphics.lineBetween(rectX, top, rectX, bottom);
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
    this.graphics.lineTo(
      centerX + Math.cos(angle + 2.45) * size,
      centerY + Math.sin(angle + 2.45) * size,
    );
    this.graphics.lineTo(
      centerX + Math.cos(angle - 2.45) * size,
      centerY + Math.sin(angle - 2.45) * size,
    );
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
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const denominator = previous.y - current.y;
    const intersectionX =
      ((previous.x - current.x) * (point.y - current.y)) /
        (Math.abs(denominator) < 0.0001 ? 0.0001 : denominator) +
      current.x;
    if (crossesY && point.x < intersectionX) inside = !inside;
  }
  return inside;
}

function getNebulaMinimapColor(region: MinimapNebulaRegion): number {
  const visuals = region.visuals;
  if (!visuals) return 0x2d7185;
  return rgbToNumber(visuals.tint);
}

function rgbToNumber(color: NebulaRegionColor): number {
  const r = Phaser.Math.Clamp(Math.round(color.r * 255), 0, 255);
  const g = Phaser.Math.Clamp(Math.round(color.g * 255), 0, 255);
  const b = Phaser.Math.Clamp(Math.round(color.b * 255), 0, 255);
  return (r << 16) | (g << 8) | b;
}

function clipLineToRect(
  start: Vector,
  end: Vector,
  rect: { bottom: number; left: number; right: number; top: number },
): { end: Vector; start: Vector } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let enter = 0;
  let exit = 1;
  let visible = true;
  const edges = [
    { p: -dx, q: start.x - rect.left },
    { p: dx, q: rect.right - start.x },
    { p: -dy, q: start.y - rect.top },
    { p: dy, q: rect.bottom - start.y },
  ];

  for (const edge of edges) {
    if (edge.p === 0) {
      if (edge.q < 0) visible = false;
    } else {
      const ratio = edge.q / edge.p;
      if (edge.p < 0) {
        enter = Math.max(enter, ratio);
      } else {
        exit = Math.min(exit, ratio);
      }
      if (enter > exit) visible = false;
    }
  }

  if (!visible) return null;
  return {
    end: { x: start.x + dx * exit, y: start.y + dy * exit },
    start: { x: start.x + dx * enter, y: start.y + dy * enter },
  };
}
