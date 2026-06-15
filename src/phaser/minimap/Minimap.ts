import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/config';
import type { AsteroidTier } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import { getActiveCanvasOverscan } from '../runtime/canvasOverscan';
import { ENTITIES, type EntityKind } from '../entities/config';
import {
  getBoundedViewportRect,
  getMinimapPlayerHeading,
  getMinimapScale,
  getWrappedViewportRects,
  isVisibleOnMinimap,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  projectWorldPoint,
  type MinimapRect,
  type MinimapScale,
} from './MinimapProjection';
import type {
  MinimapBiomeRegion,
  MinimapFog,
  MinimapNebulaRegion,
  MinimapRenderInput,
} from './types';

export type { MinimapBiomeRegion, MinimapFog, MinimapNebulaRegion, MinimapRenderInput };
export { getMinimapPlayerHeading };

const PADDING = 20;
const DEPTH = 200;
const NEBULA_SAMPLE_SCALE = 2;
const MINIMAP_DEFAULT_COLUMNS = 44;
const MINIMAP_DEFAULT_ROWS = 44;
const MARKER_LAYER_UPDATE_MS = 100;
const DIRTY_FOG_FULL_REDRAW_RATIO = 0.35;

type MinimapOrigin = {
  x: number;
  y: number;
};

type MinimapNebulaCoverageCell = {
  alpha: number;
  color: number;
  col: number;
  fogIndex: number;
  row: number;
};

type MinimapNebulaCoverage = {
  columns: number;
  key: string;
  rows: number;
  cells: MinimapNebulaCoverageCell[];
};

type StaticLayerState = {
  biomeRegions?: MinimapBiomeRegion[];
  fogEnabled: boolean;
  nebulaRegions?: MinimapNebulaRegion[];
  worldHeight: number;
  worldWidth: number;
};

type FogLayerState = {
  fogCellVersion: string;
  nebulaRegions?: MinimapNebulaRegion[];
  worldHeight: number;
  worldWidth: number;
};

type AsteroidMarkerLayerState = {
  asteroidCount: number;
  fogCellVersion: string;
  nextUpdateAt: number;
  entityCount: number;
  worldHeight: number;
  worldWidth: number;
};

type PlanetMarkerLayerState = {
  planetCount: number;
  planetDiscoveryVersion: number;
  worldHeight: number;
  worldWidth: number;
};

const VIEWPORT_CLIP = { bottom: MINIMAP_HEIGHT, left: 0, right: MINIMAP_WIDTH, top: 0 };

export class Minimap {
  private readonly baseDrawGraphics: Phaser.GameObjects.Graphics;
  private readonly baseGraphics: Phaser.GameObjects.Graphics;
  private readonly baseTexture: Phaser.GameObjects.RenderTexture;
  private readonly asteroidMarkerTexture: Phaser.GameObjects.RenderTexture;
  private readonly fogDrawGraphics: Phaser.GameObjects.Graphics;
  private readonly fogGraphics: Phaser.GameObjects.Graphics;
  private readonly fogTexture: Phaser.GameObjects.RenderTexture;
  private readonly asteroidMarkerDrawGraphics: Phaser.GameObjects.Graphics;
  private readonly asteroidMarkerGraphics: Phaser.GameObjects.Graphics;
  private readonly planetMarkerDrawGraphics: Phaser.GameObjects.Graphics;
  private readonly planetMarkerGraphics: Phaser.GameObjects.Graphics;
  private readonly planetMarkerTexture: Phaser.GameObjects.RenderTexture;
  private readonly playerGraphics: Phaser.GameObjects.Graphics;
  private readonly staticDrawGraphics: Phaser.GameObjects.Graphics;
  private readonly staticGraphics: Phaser.GameObjects.Graphics;
  private readonly staticTexture: Phaser.GameObjects.RenderTexture;
  private readonly viewportGraphics: Phaser.GameObjects.Graphics;
  private asteroidMarkerLayerState: AsteroidMarkerLayerState | null = null;
  private fogLayerState: FogLayerState | null = null;
  private nebulaCoverage: MinimapNebulaCoverage | null = null;
  private origin: MinimapOrigin = { x: 0, y: 0 };
  private planetMarkerLayerState: PlanetMarkerLayerState | null = null;
  private staticLayerState: StaticLayerState | null = null;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.baseTexture = this.createRenderLayer('minimap-base-texture', DEPTH);
    this.fogTexture = this.createRenderLayer('minimap-fog-texture', DEPTH + 1);
    this.staticTexture = this.createRenderLayer('minimap-static-texture', DEPTH + 2);
    this.planetMarkerTexture = this.createRenderLayer('minimap-planet-marker-texture', DEPTH + 3);
    this.asteroidMarkerTexture = this.createRenderLayer(
      'minimap-asteroid-marker-texture',
      DEPTH + 4,
    );
    this.baseGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    this.asteroidMarkerGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    this.fogGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    this.planetMarkerGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    this.staticGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    this.asteroidMarkerDrawGraphics = this.asteroidMarkerGraphics;
    this.baseDrawGraphics = this.baseGraphics;
    this.fogDrawGraphics = this.fogGraphics;
    this.planetMarkerDrawGraphics = this.planetMarkerGraphics;
    this.staticDrawGraphics = this.staticGraphics;
    this.viewportGraphics = this.createLayer('minimap-viewport', DEPTH + 5);
    this.playerGraphics = this.createLayer('minimap-player', DEPTH + 6);
    this.drawFrame();
    this.scene.events.once('shutdown', this.destroy, this);
  }

  setVisible(visible: boolean): void {
    this.baseTexture.setVisible(visible);
    this.staticTexture.setVisible(visible);
    this.fogTexture.setVisible(visible);
    this.planetMarkerTexture.setVisible(visible);
    this.asteroidMarkerTexture.setVisible(visible);
    this.viewportGraphics.setVisible(visible);
    this.playerGraphics.setVisible(visible);
  }

  render(input: MinimapRenderInput): void {
    if (this.destroyed) return;
    this.updateOrigin();
    const scale = getMinimapScale(input.world);
    this.updateStaticLayer(input, scale);
    this.updateFogLayer(input);
    this.updatePlanetMarkerLayer(input, scale);
    this.updateAsteroidMarkerLayer(input, scale);
    this.drawViewport(input, scale);
    this.drawPlayer(input, scale);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    this.baseTexture.destroy();
    this.fogTexture.destroy();
    this.staticTexture.destroy();
    this.planetMarkerTexture.destroy();
    this.asteroidMarkerTexture.destroy();
    this.viewportGraphics.destroy();
    this.playerGraphics.destroy();
    this.baseDrawGraphics.destroy();
    this.fogDrawGraphics.destroy();
    this.staticDrawGraphics.destroy();
    this.planetMarkerDrawGraphics.destroy();
    this.asteroidMarkerDrawGraphics.destroy();
  }

  private createLayer(name: string, depth: number): Phaser.GameObjects.Graphics {
    return this.scene.add.graphics().setName(name).setDepth(depth).setScrollFactor(0);
  }

  private createRenderLayer(name: string, depth: number): Phaser.GameObjects.RenderTexture {
    return this.scene.add
      .renderTexture(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)
      .setName(name)
      .setOrigin(0)
      .setDepth(depth)
      .setScrollFactor(0);
  }

  private updateOrigin(): void {
    const overscan = getActiveCanvasOverscan();
    const x = this.scene.scale.width - overscan - MINIMAP_WIDTH - PADDING;
    const y = overscan + PADDING;
    if (this.origin.x === x && this.origin.y === y) return;
    this.origin = { x, y };
    this.baseTexture.setPosition(x, y);
    this.staticTexture.setPosition(x, y);
    this.fogTexture.setPosition(x, y);
    this.planetMarkerTexture.setPosition(x, y);
    this.asteroidMarkerTexture.setPosition(x, y);
    this.viewportGraphics.setPosition(x, y);
    this.playerGraphics.setPosition(x, y);
  }

  private drawFrame(): void {
    this.baseDrawGraphics.clear();
    this.baseDrawGraphics.fillStyle(0x020617, 0.96);
    this.baseDrawGraphics.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    this.baseDrawGraphics.lineStyle(2, 0xffffff, 0.18);
    this.baseDrawGraphics.strokeRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    this.baseTexture.clear();
    this.baseTexture.draw(this.baseDrawGraphics);
    this.baseDrawGraphics.clear();
  }

  private drawGrid(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(1, 0xffffff, 0.08);
    for (let index = 1; index < 4; index += 1) {
      const gridX = (MINIMAP_WIDTH / 4) * index;
      const gridY = (MINIMAP_HEIGHT / 4) * index;
      graphics.lineBetween(gridX, 0, gridX, MINIMAP_HEIGHT);
      graphics.lineBetween(0, gridY, MINIMAP_WIDTH, gridY);
    }
  }

  private updateStaticLayer(input: MinimapRenderInput, scale: MinimapScale): void {
    if (!this.isStaticLayerDirty(input)) return;
    this.staticDrawGraphics.clear();
    if (!input.fog)
      this.drawNebulaRegions(this.staticDrawGraphics, input.nebulaRegions ?? [], input.world);
    this.drawBiomeRegions(this.staticDrawGraphics, input.biomeRegions ?? [], input.world, scale);
    this.drawGrid(this.staticDrawGraphics);
    this.staticTexture.clear();
    this.staticTexture.draw(this.staticDrawGraphics);
    this.staticDrawGraphics.clear();
    this.staticLayerState = {
      biomeRegions: input.biomeRegions,
      fogEnabled: Boolean(input.fog),
      nebulaRegions: input.nebulaRegions,
      worldHeight: input.world.height,
      worldWidth: input.world.width,
    };
  }

  private isStaticLayerDirty(input: MinimapRenderInput): boolean {
    return (
      !this.staticLayerState ||
      this.staticLayerState.worldWidth !== input.world.width ||
      this.staticLayerState.worldHeight !== input.world.height ||
      this.staticLayerState.fogEnabled !== Boolean(input.fog) ||
      this.staticLayerState.nebulaRegions !== input.nebulaRegions ||
      this.staticLayerState.biomeRegions !== input.biomeRegions
    );
  }

  private updateFogLayer(input: MinimapRenderInput): void {
    const fullRedraw = this.isFogLayerFullRedrawDirty(input);
    if (!fullRedraw && !this.hasDirtyFogCells(input.fog)) return;
    this.fogDrawGraphics.clear();
    if (!input.fog) {
      this.fogTexture.clear();
    } else if (fullRedraw) {
      this.drawFog(this.fogDrawGraphics, input.fog);
      this.drawNebulaFogCells(
        this.fogDrawGraphics,
        input.nebulaRegions ?? [],
        input.fog,
        input.world,
      );
      this.fogTexture.clear();
      this.fogTexture.draw(this.fogDrawGraphics);
    } else {
      this.eraseFogCells(input.fog);
      this.drawFogCells(this.fogDrawGraphics, input.fog, input.fog.dirtyCellIndices ?? []);
      this.drawNebulaFogCells(
        this.fogDrawGraphics,
        input.nebulaRegions ?? [],
        input.fog,
        input.world,
        input.fog.dirtyCellIndices,
      );
      this.fogTexture.draw(this.fogDrawGraphics);
    }
    this.fogDrawGraphics.clear();
    this.fogLayerState = {
      fogCellVersion: getFogCellVersion(input.fog),
      nebulaRegions: input.nebulaRegions,
      worldHeight: input.world.height,
      worldWidth: input.world.width,
    };
  }

  private isFogLayerFullRedrawDirty(input: MinimapRenderInput): boolean {
    const fogCellCount = (input.fog?.columns ?? 0) * (input.fog?.rows ?? 0);
    const dirtyCellCount = input.fog?.dirtyCellIndices?.length ?? 0;
    const missingDirtyCells =
      Boolean(input.fog) &&
      !input.fog?.dirtyCellIndices &&
      this.fogLayerState?.fogCellVersion !== getFogCellVersion(input.fog);
    const manyDirtyCells =
      fogCellCount > 0 && dirtyCellCount / fogCellCount >= DIRTY_FOG_FULL_REDRAW_RATIO;
    return (
      !this.fogLayerState ||
      this.fogLayerState.worldWidth !== input.world.width ||
      this.fogLayerState.worldHeight !== input.world.height ||
      (this.fogLayerState.fogCellVersion === 'none') !== !input.fog ||
      this.fogLayerState.nebulaRegions !== input.nebulaRegions ||
      missingDirtyCells ||
      manyDirtyCells
    );
  }

  private hasDirtyFogCells(fog: MinimapFog | undefined): boolean {
    return Boolean(fog && this.fogLayerState?.fogCellVersion !== getFogCellVersion(fog));
  }

  private drawFog(graphics: Phaser.GameObjects.Graphics, fog: MinimapFog): void {
    this.drawFogCells(
      graphics,
      fog,
      Array.from({ length: fog.columns * fog.rows }, (_, index) => index),
    );
  }

  private drawFogCells(
    graphics: Phaser.GameObjects.Graphics,
    fog: MinimapFog,
    cellIndices: readonly number[],
  ): void {
    const cellWidth = MINIMAP_WIDTH / fog.columns;
    const cellHeight = MINIMAP_HEIGHT / fog.rows;
    graphics.fillStyle(0x0a1322, 0.42);
    for (const index of cellIndices) {
      if (fog.exploredCells[index] && !fog.visibleCells[index]) {
        const col = index % fog.columns;
        const row = Math.floor(index / fog.columns);
        graphics.fillRect(col * cellWidth, row * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
      }
    }
    graphics.fillStyle(0x102338, 0.9);
    for (const index of cellIndices) {
      if (fog.exploredCells[index] && fog.visibleCells[index]) {
        const col = index % fog.columns;
        const row = Math.floor(index / fog.columns);
        graphics.fillRect(col * cellWidth, row * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
      }
    }
  }

  private eraseFogCells(fog: MinimapFog): void {
    const cellWidth = MINIMAP_WIDTH / fog.columns;
    const cellHeight = MINIMAP_HEIGHT / fog.rows;
    this.fogDrawGraphics.clear();
    this.fogDrawGraphics.fillStyle(0xffffff, 1);
    for (const index of fog.dirtyCellIndices ?? []) {
      const col = index % fog.columns;
      const row = Math.floor(index / fog.columns);
      this.fogDrawGraphics.fillRect(
        col * cellWidth,
        row * cellHeight,
        cellWidth + 0.75,
        cellHeight + 0.75,
      );
    }
    this.fogTexture.erase(this.fogDrawGraphics);
    this.fogDrawGraphics.clear();
  }

  private drawBiomeRegions(
    graphics: Phaser.GameObjects.Graphics,
    regions: MinimapBiomeRegion[],
    world: WorldSize,
    scale: MinimapScale,
  ): void {
    for (const region of regions) {
      graphics.lineStyle(1, rgbToNumber(region.color), 0.78);
      for (const offsetX of [-world.width, 0, world.width]) {
        for (const offsetY of [-world.height, 0, world.height]) {
          this.drawBiomeRegionCopy(graphics, region, offsetX, offsetY, scale);
        }
      }
    }
  }

  private drawBiomeRegionCopy(
    graphics: Phaser.GameObjects.Graphics,
    region: MinimapBiomeRegion,
    offsetX: number,
    offsetY: number,
    scale: MinimapScale,
  ): void {
    for (let index = 0; index < region.points.length; index += 1) {
      const start = region.points[index];
      const end = region.points[(index + 1) % region.points.length];
      const clipped = clipLineToRect(
        {
          x: (start.x + offsetX) * scale.x,
          y: (start.y + offsetY) * scale.y,
        },
        {
          x: (end.x + offsetX) * scale.x,
          y: (end.y + offsetY) * scale.y,
        },
        VIEWPORT_CLIP,
      );
      if (clipped) {
        graphics.lineBetween(clipped.start.x, clipped.start.y, clipped.end.x, clipped.end.y);
      }
    }
  }

  private drawNebulaRegions(
    graphics: Phaser.GameObjects.Graphics,
    regions: MinimapNebulaRegion[],
    world: WorldSize,
  ): void {
    const columns = MINIMAP_DEFAULT_COLUMNS;
    const rows = MINIMAP_DEFAULT_ROWS;
    const coverage = this.getNebulaCoverage(regions, world, columns, rows);
    const sampleColumns = columns * NEBULA_SAMPLE_SCALE;
    const sampleRows = rows * NEBULA_SAMPLE_SCALE;
    const cellWidth = MINIMAP_WIDTH / sampleColumns;
    const cellHeight = MINIMAP_HEIGHT / sampleRows;
    for (const cell of coverage.cells) {
      graphics.fillStyle(cell.color, 0.38 * cell.alpha);
      graphics.fillRect(
        cell.col * cellWidth,
        cell.row * cellHeight,
        cellWidth + 0.5,
        cellHeight + 0.5,
      );
    }
  }

  private drawNebulaFogCells(
    graphics: Phaser.GameObjects.Graphics,
    regions: MinimapNebulaRegion[],
    fog: MinimapFog,
    world: WorldSize,
    dirtyFogCells?: readonly number[],
  ): void {
    const coverage = this.getNebulaCoverage(regions, world, fog.columns, fog.rows);
    const dirtyFogCellSet = dirtyFogCells ? new Set(dirtyFogCells) : null;
    const sampleColumns = fog.columns * NEBULA_SAMPLE_SCALE;
    const sampleRows = fog.rows * NEBULA_SAMPLE_SCALE;
    const cellWidth = MINIMAP_WIDTH / sampleColumns;
    const cellHeight = MINIMAP_HEIGHT / sampleRows;
    for (const cell of coverage.cells) {
      const discovered = fog.exploredCells[cell.fogIndex];
      const dirty = !dirtyFogCellSet || dirtyFogCellSet.has(cell.fogIndex);
      if (discovered && dirty) {
        const visible = fog.visibleCells[cell.fogIndex];
        graphics.fillStyle(cell.color, (visible ? 0.46 : 0.26) * cell.alpha);
        graphics.fillRect(
          cell.col * cellWidth,
          cell.row * cellHeight,
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
    const key = `${world.width}:${world.height}:${columns}:${rows}:${regions.length}:${regions
      .map((region) => `${region.alpha}:${region.points.length}:${getNebulaMinimapColor(region)}`)
      .join('|')}`;
    if (this.nebulaCoverage?.key === key) return this.nebulaCoverage;

    const cells: MinimapNebulaCoverageCell[] = [];
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
          cells.push({
            alpha: region.alpha,
            color: getNebulaMinimapColor(region),
            col,
            fogIndex: fogRow * columns + fogCol,
            row,
          });
        }
      }
    }
    this.nebulaCoverage = { cells, columns: sampleColumns, key, rows: sampleRows };
    return this.nebulaCoverage;
  }

  private updatePlanetMarkerLayer(input: MinimapRenderInput, scale: MinimapScale): void {
    if (!this.isPlanetMarkerLayerDirty(input)) return;

    this.planetMarkerDrawGraphics.clear();
    for (const planet of input.planets) {
      const discovered = !input.fog || input.fog.discoveredPlanetIds.has(planet.id);
      if (discovered) {
        const point = projectWorldPoint(planet.position, input.world, scale);
        this.planetMarkerDrawGraphics.fillStyle(planet.color, 0.9);
        this.planetMarkerDrawGraphics.fillCircle(
          point.x,
          point.y,
          Math.max(3, planet.radius * scale.x),
        );
      }
    }
    this.planetMarkerTexture.clear();
    this.planetMarkerTexture.draw(this.planetMarkerDrawGraphics);
    this.planetMarkerDrawGraphics.clear();
    this.planetMarkerLayerState = {
      planetCount: input.planets.length,
      planetDiscoveryVersion: getPlanetDiscoveryVersion(input.fog),
      worldHeight: input.world.height,
      worldWidth: input.world.width,
    };
  }

  private isPlanetMarkerLayerDirty(input: MinimapRenderInput): boolean {
    return (
      !this.planetMarkerLayerState ||
      this.planetMarkerLayerState.worldWidth !== input.world.width ||
      this.planetMarkerLayerState.worldHeight !== input.world.height ||
      this.planetMarkerLayerState.planetCount !== input.planets.length ||
      this.planetMarkerLayerState.planetDiscoveryVersion !== getPlanetDiscoveryVersion(input.fog)
    );
  }

  private updateAsteroidMarkerLayer(input: MinimapRenderInput, scale: MinimapScale): void {
    const now = this.scene.time.now;
    if (!this.isAsteroidMarkerLayerDirty(input, now)) return;

    this.asteroidMarkerDrawGraphics.clear();
    for (const asteroid of input.asteroids ?? []) {
      const visible = isVisibleOnMinimap(asteroid.position, input.fog, input.world);
      if (visible) {
        const point = projectWorldPoint(asteroid.position, input.world, scale);
        this.asteroidMarkerDrawGraphics.fillStyle(ASTEROIDS[asteroid.tier].color, 0.82);
        this.asteroidMarkerDrawGraphics.fillCircle(
          point.x,
          point.y,
          getAsteroidMarkerRadius(asteroid.tier, scale),
        );
      }
    }
    for (const entity of input.entities ?? []) {
      const visible = isVisibleOnMinimap(entity.position, input.fog, input.world);
      if (visible) {
        const point = projectWorldPoint(entity.position, input.world, scale);
        const radius = getEntityMarkerRadius(entity.kind, scale);
        this.asteroidMarkerDrawGraphics.fillStyle(ENTITIES[entity.kind].lineColor, 0.9);
        this.asteroidMarkerDrawGraphics.fillRect(
          point.x - radius,
          point.y - radius,
          radius * 2,
          radius * 2,
        );
      }
    }
    this.asteroidMarkerTexture.clear();
    this.asteroidMarkerTexture.draw(this.asteroidMarkerDrawGraphics);
    this.asteroidMarkerDrawGraphics.clear();
    this.asteroidMarkerLayerState = {
      asteroidCount: input.asteroids?.length ?? 0,
      fogCellVersion: getFogCellVersion(input.fog),
      nextUpdateAt: now + MARKER_LAYER_UPDATE_MS,
      entityCount: input.entities?.length ?? 0,
      worldHeight: input.world.height,
      worldWidth: input.world.width,
    };
  }

  private isAsteroidMarkerLayerDirty(input: MinimapRenderInput, now: number): boolean {
    return (
      !this.asteroidMarkerLayerState ||
      this.asteroidMarkerLayerState.worldWidth !== input.world.width ||
      this.asteroidMarkerLayerState.worldHeight !== input.world.height ||
      this.asteroidMarkerLayerState.fogCellVersion !== getFogCellVersion(input.fog) ||
      this.asteroidMarkerLayerState.asteroidCount !== (input.asteroids?.length ?? 0) ||
      this.asteroidMarkerLayerState.entityCount !== (input.entities?.length ?? 0) ||
      now >= this.asteroidMarkerLayerState.nextUpdateAt
    );
  }

  private drawViewport(input: MinimapRenderInput, scale: MinimapScale): void {
    this.viewportGraphics.clear();
    this.viewportGraphics.lineStyle(1.5, 0xffffff, 0.72);
    if (input.viewportMode === 'wrapped') {
      for (const rect of getWrappedViewportRects(input.camera, input.world, scale)) {
        this.strokeClippedRect(rect);
      }
    } else {
      this.strokeClippedRect(getBoundedViewportRect(input.camera, scale));
    }
  }

  private strokeClippedRect(rect: MinimapRect): void {
    const left = Math.max(rect.x, 0);
    const right = Math.min(rect.x + rect.width, MINIMAP_WIDTH);
    const top = Math.max(rect.y, 0);
    const bottom = Math.min(rect.y + rect.height, MINIMAP_HEIGHT);

    if (rect.y >= 0 && rect.y <= MINIMAP_HEIGHT) {
      this.viewportGraphics.lineBetween(left, rect.y, right, rect.y);
    }
    if (rect.y + rect.height >= 0 && rect.y + rect.height <= MINIMAP_HEIGHT) {
      this.viewportGraphics.lineBetween(left, rect.y + rect.height, right, rect.y + rect.height);
    }
    if (rect.x >= 0 && rect.x <= MINIMAP_WIDTH) {
      this.viewportGraphics.lineBetween(rect.x, top, rect.x, bottom);
    }
    if (rect.x + rect.width >= 0 && rect.x + rect.width <= MINIMAP_WIDTH) {
      this.viewportGraphics.lineBetween(rect.x + rect.width, top, rect.x + rect.width, bottom);
    }
  }

  private drawPlayer(input: MinimapRenderInput, scale: MinimapScale): void {
    const center = projectWorldPoint(input.player, input.world, scale);
    const angle = getMinimapPlayerHeading(input.playerVelocity, input.playerRotation);
    const size = 6;
    this.playerGraphics.clear();
    this.playerGraphics.fillStyle(0xe0f2fe, 1);
    this.playerGraphics.beginPath();
    this.playerGraphics.moveTo(
      center.x + Math.cos(angle) * size,
      center.y + Math.sin(angle) * size,
    );
    this.playerGraphics.lineTo(
      center.x + Math.cos(angle + 2.45) * size,
      center.y + Math.sin(angle + 2.45) * size,
    );
    this.playerGraphics.lineTo(
      center.x + Math.cos(angle - 2.45) * size,
      center.y + Math.sin(angle - 2.45) * size,
    );
    this.playerGraphics.closePath();
    this.playerGraphics.fillPath();
  }
}

function getAsteroidMarkerRadius(tier: AsteroidTier, scale: MinimapScale): number {
  return Math.max(2, ASTEROIDS[tier].collisionRadius * scale.x);
}

function getEntityMarkerRadius(kind: EntityKind, scale: MinimapScale): number {
  return Math.max(2, ENTITIES[kind].collisionRadius * scale.x);
}

function getFogCellVersion(fog: MinimapFog | undefined): string {
  if (!fog) return 'none';
  return `${fog.exploredVersion ?? fog.version}:${fog.visibleVersion ?? fog.version}`;
}

function getPlanetDiscoveryVersion(fog: MinimapFog | undefined): number {
  return fog?.planetDiscoveryVersion ?? fog?.version ?? -1;
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

function rgbToNumber(color: { b: number; g: number; r: number }): number {
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
