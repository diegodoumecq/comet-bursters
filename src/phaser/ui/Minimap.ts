import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { PlanetEntity } from '../planets/types';
import { getActiveCanvasOverscan } from '../runtime/canvasOverscan';
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
  version: number;
};

export type MinimapNebulaRegion = {
  alpha: number;
  points: Vector[];
  visuals?: NebulaRegionVisuals;
};

export type MinimapBiomeRegion = {
  color: NebulaRegionColor;
  points: Vector[];
};

type MinimapNebulaCoverageCell = {
  alpha: number;
  color: number;
};

type MinimapNebulaDrawableCell = MinimapNebulaCoverageCell & {
  col: number;
  fogIndex: number;
  row: number;
};

type MinimapNebulaCoverage = {
  cells: Array<MinimapNebulaCoverageCell | null>;
  columns: number;
  drawableCells: MinimapNebulaDrawableCell[];
  key: string;
  rows: number;
};

export class Minimap {
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly baseContext: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private baseCacheKey = '';
  private nebulaCoverage: MinimapNebulaCoverage | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = WIDTH;
    this.baseCanvas.height = HEIGHT;
    const baseContext = this.baseCanvas.getContext('2d');
    if (!baseContext) throw new Error('Unable to create minimap base canvas context');
    this.baseContext = baseContext;
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Unable to create minimap canvas context');
    this.context = context;
    const textureKey = `phaser-minimap-${Phaser.Math.RND.uuid()}`;
    const texture = scene.textures.addCanvas(textureKey, this.canvas);
    if (!texture) throw new Error('Unable to create minimap texture');
    this.texture = texture;
    this.image = scene.add.image(0, 0, textureKey).setOrigin(0).setScrollFactor(0).setDepth(200);
  }

  setVisible(visible: boolean): void {
    this.image.setVisible(visible);
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
    const overscan = getActiveCanvasOverscan();
    const x = this.scene.scale.width - overscan - WIDTH - PADDING;
    const y = overscan + PADDING;
    const scaleX = WIDTH / input.world.width;
    const scaleY = HEIGHT / input.world.height;

    this.image.setPosition(x, y);
    this.context.clearRect(0, 0, WIDTH, HEIGHT);
    this.drawBaseLayer(input, scaleX, scaleY);
    this.context.drawImage(this.baseCanvas, 0, 0);
    this.drawAsteroids(input.asteroids ?? [], input.fog, input.world, scaleX, scaleY);
    if (input.viewportMode === 'wrapped') {
      this.drawWrappedViewport(input.camera, input.world, scaleX, scaleY);
    } else {
      this.drawBoundedViewport(input.camera, scaleX, scaleY);
    }
    this.drawPlayer(input.player, input.playerAim, input.world, scaleX, scaleY);
    this.texture.refresh();
  }

  private drawBaseLayer(
    input: {
      biomeRegions?: MinimapBiomeRegion[];
      fog?: MinimapFog;
      nebulaRegions?: MinimapNebulaRegion[];
      planets: PlanetEntity[];
      world: WorldSize;
    },
    scaleX: number,
    scaleY: number,
  ): void {
    const cacheKey = this.getBaseCacheKey(input);
    if (this.baseCacheKey === cacheKey) return;

    this.baseContext.clearRect(0, 0, WIDTH, HEIGHT);
    setFillStyle(this.baseContext, 0x020617, 0.96);
    this.baseContext.fillRect(0, 0, WIDTH, HEIGHT);
    setStrokeStyle(this.baseContext, 0xffffff, 0.18, 2);
    this.baseContext.strokeRect(0, 0, WIDTH, HEIGHT);

    if (input.fog) this.drawFog(this.baseContext, input.fog);
    this.drawNebulaRegions(
      this.baseContext,
      input.nebulaRegions ?? [],
      input.fog,
      input.world,
    );
    this.drawBiomeRegions(this.baseContext, input.biomeRegions ?? [], input.world, scaleX, scaleY);
    this.drawGrid(this.baseContext);
    this.drawPlanets(this.baseContext, input.planets, input.fog, input.world, scaleX, scaleY);
    this.baseCacheKey = cacheKey;
  }

  private getBaseCacheKey(input: {
    biomeRegions?: MinimapBiomeRegion[];
    fog?: MinimapFog;
    nebulaRegions?: MinimapNebulaRegion[];
    planets: PlanetEntity[];
    world: WorldSize;
  }): string {
    const biomeKey =
      input.biomeRegions
        ?.map((region) => `${rgbToNumber(region.color)}:${region.points.length}`)
        .join('|') ?? 'none';
    const fogKey = input.fog ? input.fog.version : 'none';
    const nebulaKey =
      input.nebulaRegions
        ?.map((region) => `${region.alpha}:${region.points.length}:${getNebulaMinimapColor(region)}`)
        .join('|') ?? 'none';
    const planetKey = input.planets
      .map(
        (planet) =>
          `${planet.id}:${planet.position.x}:${planet.position.y}:${planet.radius}:${planet.color}`,
      )
      .join('|');
    return [
      input.world.width,
      input.world.height,
      biomeKey,
      fogKey,
      nebulaKey,
      planetKey,
    ].join(':');
  }

  private drawFog(context: CanvasRenderingContext2D, fog: MinimapFog): void {
    const cellWidth = WIDTH / fog.columns;
    const cellHeight = HEIGHT / fog.rows;
    setFillStyle(context, 0x0a1322, 0.42);
    for (let row = 0; row < fog.rows; row += 1) {
      for (let col = 0; col < fog.columns; col += 1) {
        const index = row * fog.columns + col;
        if (fog.exploredCells[index] && !fog.visibleCells[index]) {
          context.fillRect(
            col * cellWidth,
            row * cellHeight,
            cellWidth + 0.5,
            cellHeight + 0.5,
          );
        }
      }
    }
    setFillStyle(context, 0x102338, 0.9);
    for (let row = 0; row < fog.rows; row += 1) {
      for (let col = 0; col < fog.columns; col += 1) {
        const index = row * fog.columns + col;
        if (fog.exploredCells[index] && fog.visibleCells[index]) {
          context.fillRect(
            col * cellWidth,
            row * cellHeight,
            cellWidth + 0.5,
            cellHeight + 0.5,
          );
        }
      }
    }
  }

  private drawGrid(context: CanvasRenderingContext2D): void {
    setStrokeStyle(context, 0xffffff, 0.08, 1);
    for (let index = 1; index < 4; index += 1) {
      const gridX = (WIDTH / 4) * index;
      const gridY = (HEIGHT / 4) * index;
      strokeLine(context, gridX, 0, gridX, HEIGHT);
      strokeLine(context, 0, gridY, WIDTH, gridY);
    }
  }

  private drawPlanets(
    context: CanvasRenderingContext2D,
    planets: PlanetEntity[],
    fog: MinimapFog | undefined,
    world: WorldSize,
    scaleX: number,
    scaleY: number,
  ): void {
    for (const planet of planets) {
      const discovered = !fog || fog.discoveredPlanetIds.has(planet.id);
      if (discovered) {
        setFillStyle(context, planet.color, 0.9);
        fillCircle(
          context,
          positiveModulo(planet.position.x, world.width) * scaleX,
          positiveModulo(planet.position.y, world.height) * scaleY,
          Math.max(3, planet.radius * scaleX),
        );
      }
    }
  }

  private drawAsteroids(
    asteroids: AsteroidEntity[],
    fog: MinimapFog | undefined,
    world: WorldSize,
    scaleX: number,
    scaleY: number,
  ): void {
    for (const asteroid of asteroids) {
      if (this.isVisibleOnMinimap(asteroid.position, fog, world)) {
        setFillStyle(this.context, ASTEROIDS[asteroid.tier].color, 0.82);
        fillCircle(
          this.context,
          positiveModulo(asteroid.position.x, world.width) * scaleX,
          positiveModulo(asteroid.position.y, world.height) * scaleY,
          Math.max(2, ASTEROIDS[asteroid.tier].collisionRadius * scaleX),
        );
      }
    }
  }

  private drawBiomeRegions(
    context: CanvasRenderingContext2D,
    regions: MinimapBiomeRegion[],
    world: WorldSize,
    scaleX: number,
    scaleY: number,
  ): void {
    if (regions.length === 0) return;

    for (const region of regions) {
      setStrokeStyle(context, rgbToNumber(region.color), 0.78, 1);
      for (const offsetX of [-world.width, 0, world.width]) {
        for (const offsetY of [-world.height, 0, world.height]) {
          this.drawBiomeRegionCopy(context, region, offsetX, offsetY, scaleX, scaleY);
        }
      }
    }
  }

  private drawBiomeRegionCopy(
    context: CanvasRenderingContext2D,
    region: MinimapBiomeRegion,
    offsetX: number,
    offsetY: number,
    scaleX: number,
    scaleY: number,
  ): void {
    for (let index = 0; index < region.points.length; index += 1) {
      const start = region.points[index];
      const end = region.points[(index + 1) % region.points.length];
      const clipped = clipLineToRect(
        {
          x: (start.x + offsetX) * scaleX,
          y: (start.y + offsetY) * scaleY,
        },
        {
          x: (end.x + offsetX) * scaleX,
          y: (end.y + offsetY) * scaleY,
        },
        { bottom: HEIGHT, left: 0, right: WIDTH, top: 0 },
      );
      if (clipped) {
        strokeLine(context, clipped.start.x, clipped.start.y, clipped.end.x, clipped.end.y);
      }
    }
  }

  private drawNebulaRegions(
    context: CanvasRenderingContext2D,
    regions: MinimapNebulaRegion[],
    fog: MinimapFog | undefined,
    world: WorldSize,
  ): void {
    if (regions.length === 0) return;

    const columns = fog?.columns ?? MINIMAP_DEFAULT_COLUMNS;
    const rows = fog?.rows ?? MINIMAP_DEFAULT_ROWS;
    const sampleColumns = columns * NEBULA_SAMPLE_SCALE;
    const sampleRows = rows * NEBULA_SAMPLE_SCALE;
    const cellWidth = WIDTH / sampleColumns;
    const cellHeight = HEIGHT / sampleRows;
    const coverage = this.getNebulaCoverage(regions, world, columns, rows);

    for (const coverageCell of coverage.drawableCells) {
      const discovered = !fog || fog.exploredCells[coverageCell.fogIndex];
      if (discovered) {
        const visible = !fog || fog.visibleCells[coverageCell.fogIndex];
        setFillStyle(
          context,
          coverageCell.color,
          (visible ? 0.46 : 0.26) * coverageCell.alpha,
        );
        context.fillRect(
          coverageCell.col * cellWidth,
          coverageCell.row * cellHeight,
          cellWidth + 0.5,
          cellHeight + 0.5,
        );
      }
    }
  }

  private getNebulaCoverage(
    regions: MinimapNebulaRegion[],
    world: WorldSize,
    columns: number,
    rows: number,
  ): MinimapNebulaCoverage {
    const sampleColumns = columns * NEBULA_SAMPLE_SCALE;
    const sampleRows = rows * NEBULA_SAMPLE_SCALE;
    const key = `${world.width}:${world.height}:${columns}:${rows}:${regions.map((region) => region.alpha).join(',')}`;
    if (this.nebulaCoverage?.key === key) return this.nebulaCoverage;

    const cells: Array<MinimapNebulaCoverageCell | null> = Array.from(
      { length: sampleColumns * sampleRows },
      () => null,
    );
    const drawableCells: MinimapNebulaDrawableCell[] = [];
    for (let row = 0; row < sampleRows; row += 1) {
      for (let col = 0; col < sampleColumns; col += 1) {
        const worldPosition = {
          x: ((col + 0.5) / sampleColumns) * world.width,
          y: ((row + 0.5) / sampleRows) * world.height,
        };
        const region = getNebulaRegionAt(worldPosition, regions);
        if (region) {
          const fogCol = Math.floor(col / NEBULA_SAMPLE_SCALE);
          const fogRow = Math.floor(row / NEBULA_SAMPLE_SCALE);
          const fogIndex = fogRow * columns + fogCol;
          const coverageCell = {
            alpha: region.alpha,
            color: getNebulaMinimapColor(region),
          };
          cells[row * sampleColumns + col] = coverageCell;
          drawableCells.push({
            ...coverageCell,
            col,
            fogIndex,
            row,
          });
        }
      }
    }
    this.nebulaCoverage = { cells, columns: sampleColumns, drawableCells, key, rows: sampleRows };
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
    scaleX: number,
    scaleY: number,
  ): void {
    const boxX = camera.scrollX * scaleX;
    const boxY = camera.scrollY * scaleY;
    const boxWidth = Math.min(WIDTH, camera.width * scaleX);
    const boxHeight = Math.min(HEIGHT, camera.height * scaleY);
    setStrokeStyle(this.context, 0xffffff, 0.72, 1.5);
    this.strokeClippedRect(boxX, boxY, boxWidth, boxHeight, 0, 0, WIDTH, HEIGHT);
  }

  private drawWrappedViewport(
    camera: Phaser.Cameras.Scene2D.Camera,
    world: WorldSize,
    scaleX: number,
    scaleY: number,
  ): void {
    const boxX = positiveModulo(camera.scrollX, world.width) * scaleX;
    const boxY = positiveModulo(camera.scrollY, world.height) * scaleY;
    const boxWidth = Math.min(WIDTH, camera.width * scaleX);
    const boxHeight = Math.min(HEIGHT, camera.height * scaleY);
    setStrokeStyle(this.context, 0xffffff, 0.72, 1.5);
    for (const offsetX of [0, -WIDTH]) {
      for (const offsetY of [0, -HEIGHT]) {
        const drawX = boxX + offsetX;
        const drawY = boxY + offsetY;
        if (drawX < WIDTH && drawX + boxWidth > 0 && drawY < HEIGHT && drawY + boxHeight > 0) {
          this.strokeClippedRect(drawX, drawY, boxWidth, boxHeight, 0, 0, WIDTH, HEIGHT);
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
      strokeLine(this.context, left, rectY, right, rectY);
    if (rectY + rectHeight >= clipY && rectY + rectHeight <= clipY + clipHeight) {
      strokeLine(this.context, left, rectY + rectHeight, right, rectY + rectHeight);
    }
    if (rectX >= clipX && rectX <= clipX + clipWidth)
      strokeLine(this.context, rectX, top, rectX, bottom);
    if (rectX + rectWidth >= clipX && rectX + rectWidth <= clipX + clipWidth) {
      strokeLine(this.context, rectX + rectWidth, top, rectX + rectWidth, bottom);
    }
  }

  private drawPlayer(
    player: Vector,
    aim: Vector,
    world: WorldSize,
    scaleX: number,
    scaleY: number,
  ): void {
    const centerX = positiveModulo(player.x, world.width) * scaleX;
    const centerY = positiveModulo(player.y, world.height) * scaleY;
    const angle = Math.atan2(aim.y, aim.x);
    const size = 6;
    setFillStyle(this.context, 0xe0f2fe, 1);
    this.context.beginPath();
    this.context.moveTo(centerX + Math.cos(angle) * size, centerY + Math.sin(angle) * size);
    this.context.lineTo(
      centerX + Math.cos(angle + 2.45) * size,
      centerY + Math.sin(angle + 2.45) * size,
    );
    this.context.lineTo(
      centerX + Math.cos(angle - 2.45) * size,
      centerY + Math.sin(angle - 2.45) * size,
    );
    this.context.closePath();
    this.context.fill();
  }
}

const MINIMAP_DEFAULT_COLUMNS = 44;
const MINIMAP_DEFAULT_ROWS = 44;

function setFillStyle(context: CanvasRenderingContext2D, color: number, alpha: number): void {
  context.fillStyle = colorToRgba(color, alpha);
}

function setStrokeStyle(
  context: CanvasRenderingContext2D,
  color: number,
  alpha: number,
  width: number,
): void {
  context.lineWidth = width;
  context.strokeStyle = colorToRgba(color, alpha);
}

function colorToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fillCircle(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function strokeLine(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
}

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
