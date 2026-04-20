import shipInteriorLevelUrl from './shipInterior.level.json?url';

import { computeAlphaMask } from '@/assets';
import type { AlphaMask } from '@/constants';
import { loadSpriteSheet } from '@/spritesheet';
import type { SpriteSheet, SpriteSheetGridConfig, TilemapLayer } from '@/spritesheet';

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type TileGridPoint = { x: number; y: number };
export type TileCoordinateTuple = [number, number];
export type TileSelector = { column: number; row: number };

export type ShipInteriorTilesetDefinition = {
  id: string;
  imageSrc: string;
  grid: SpriteSheetGridConfig;
  tiles: Record<string, TileCoordinateTuple>;
};

export type ShipInteriorLayerTileDefinition = {
  tile: string;
  x: number;
  y: number;
};

export type ShipInteriorLayerDefinition = {
  id: string;
  hasCollision: boolean;
  tilesetId: string;
  tiles: ShipInteriorLayerTileDefinition[];
};

export type ShipInteriorPathPoint = Point & {
  wait?: number;
};

export type ShipInteriorPathDefinition = {
  id: string;
  patrol: ShipInteriorPathPoint[];
};

export type ShipInteriorEntityDefinition = {
  id: string;
  type: string;
  x: number;
  y: number;
  pathId?: string;
};

export type RawShipInteriorLevel = {
  formatVersion: number;
  name: string;
  width: number;
  height: number;
  tilesets: ShipInteriorTilesetDefinition[];
  layers: ShipInteriorLayerDefinition[];
  paths: ShipInteriorPathDefinition[];
  entities: ShipInteriorEntityDefinition[];
};

export type LoadedShipInteriorTileset = {
  id: string;
  sheet: SpriteSheet;
  alphaMask: AlphaMask;
  grid: Readonly<Required<Omit<SpriteSheetGridConfig, 'namedFrames'>>>;
  tiles: Record<string, TileSelector>;
};

export type LoadedShipInteriorTile = {
  tileId: string;
  frame: TileSelector;
  tileX: number;
  tileY: number;
};

export type LoadedShipInteriorLayer = {
  id: string;
  hasCollision: boolean;
  tilesetId: string;
  sheet: SpriteSheet;
  alphaMask: AlphaMask;
  tilemap: TilemapLayer;
  tiles: LoadedShipInteriorTile[];
};

export type LoadedShipInteriorPath = {
  id: string;
  patrol: ShipInteriorPathPoint[];
};

export type LoadedShipInteriorEntity = ShipInteriorEntityDefinition;

export type LoadedShipInteriorPatroller = {
  id: string;
  x: number;
  y: number;
  pathId?: string;
  patrol: ShipInteriorPathPoint[];
};

export type ShipInteriorLevel = {
  formatVersion: number;
  name: string;
  width: number;
  height: number;
  tilesets: LoadedShipInteriorTileset[];
  layers: LoadedShipInteriorLayer[];
  paths: LoadedShipInteriorPath[];
  entities: LoadedShipInteriorEntity[];
  playerSpawn: Point | null;
  patrollers: LoadedShipInteriorPatroller[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function validatePoint(value: unknown, label: string): Point {
  if (
    !value ||
    typeof value !== 'object' ||
    !isFiniteNumber((value as Point).x) ||
    !isFiniteNumber((value as Point).y)
  ) {
    throw new Error(`${label} must contain numeric x/y coordinates.`);
  }

  return value as Point;
}

function validateTileTuple(value: unknown, label: string): TileCoordinateTuple {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !isInteger(value[0]) ||
    !isInteger(value[1]) ||
    value[0] < 0 ||
    value[1] < 0
  ) {
    throw new Error(`${label} must be a [column, row] tuple with non-negative integers.`);
  }

  return value as TileCoordinateTuple;
}

function validateTileset(value: unknown, label: string): ShipInteriorTilesetDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  const tileset = value as ShipInteriorTilesetDefinition;
  if (!tileset.id || typeof tileset.id !== 'string') {
    throw new Error(`${label}.id must be a string.`);
  }
  if (!tileset.imageSrc || typeof tileset.imageSrc !== 'string') {
    throw new Error(`${label}.imageSrc must be a string.`);
  }
  if (!tileset.grid || typeof tileset.grid !== 'object') {
    throw new Error(`${label}.grid must be an object.`);
  }
  if (!tileset.tiles || typeof tileset.tiles !== 'object') {
    throw new Error(`${label}.tiles must be an object.`);
  }

  for (const [tileId, tuple] of Object.entries(tileset.tiles)) {
    validateTileTuple(tuple, `${label}.tiles.${tileId}`);
  }

  return tileset;
}

function validateLayer(value: unknown, label: string): ShipInteriorLayerDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  const layer = value as ShipInteriorLayerDefinition;
  if (!layer.id || typeof layer.id !== 'string') {
    throw new Error(`${label}.id must be a string.`);
  }
  if (typeof layer.hasCollision !== 'boolean') {
    throw new Error(`${label}.hasCollision must be a boolean.`);
  }
  if (!layer.tilesetId || typeof layer.tilesetId !== 'string') {
    throw new Error(`${label}.tilesetId must be a string.`);
  }
  if (!Array.isArray(layer.tiles)) {
    throw new Error(`${label}.tiles must be an array.`);
  }

  for (let index = 0; index < layer.tiles.length; index++) {
    const tile = layer.tiles[index] as ShipInteriorLayerTileDefinition;
    if (
      !tile ||
      typeof tile !== 'object' ||
      typeof tile.tile !== 'string' ||
      !isInteger(tile.x) ||
      !isInteger(tile.y)
    ) {
      throw new Error(
        `${label}.tiles[${index}] must contain a tile id and integer grid x/y coordinates.`,
      );
    }
  }

  return layer;
}

function validatePath(value: unknown, label: string): ShipInteriorPathDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  const path = value as ShipInteriorPathDefinition;
  if (!path.id || typeof path.id !== 'string') {
    throw new Error(`${label}.id must be a string.`);
  }
  if (!Array.isArray(path.patrol) || path.patrol.length === 0) {
    throw new Error(`${label}.patrol must be a non-empty array.`);
  }

  for (let index = 0; index < path.patrol.length; index++) {
    const point = path.patrol[index];
    validatePoint(point, `${label}.patrol[${index}]`);
    if (point.wait !== undefined && (!isInteger(point.wait) || point.wait < 0)) {
      throw new Error(`${label}.patrol[${index}].wait must be a non-negative integer.`);
    }
  }

  return path;
}

function validateEntity(value: unknown, label: string): ShipInteriorEntityDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  const entity = value as ShipInteriorEntityDefinition;
  if (!entity.id || typeof entity.id !== 'string') {
    throw new Error(`${label}.id must be a string.`);
  }
  if (!entity.type || typeof entity.type !== 'string') {
    throw new Error(`${label}.type must be a string.`);
  }
  if (!isFiniteNumber(entity.x) || !isFiniteNumber(entity.y)) {
    throw new Error(`${label}.x and ${label}.y must be numeric pixel coordinates.`);
  }
  if (entity.pathId !== undefined && typeof entity.pathId !== 'string') {
    throw new Error(`${label}.pathId must be a string when provided.`);
  }

  return entity;
}

function resolveLevelAssetUrl(path: string): string {
  return new URL(path, shipInteriorLevelUrl).href;
}

function tupleToSelector(tuple: TileCoordinateTuple): TileSelector {
  return { column: tuple[0], row: tuple[1] };
}

function buildLoadedTileset(
  definition: ShipInteriorTilesetDefinition,
  sheet: SpriteSheet,
): LoadedShipInteriorTileset {
  const tiles: Record<string, TileSelector> = {};
  for (const [tileId, tuple] of Object.entries(definition.tiles)) {
    tiles[tileId] = tupleToSelector(tuple);
  }

  return {
    id: definition.id,
    sheet,
    alphaMask: computeAlphaMask(sheet.image),
    grid: sheet.config,
    tiles,
  };
}

export function getShipInteriorLevelUrl(): string {
  return shipInteriorLevelUrl;
}

export async function fetchRawShipInteriorLevel(): Promise<RawShipInteriorLevel> {
  const response = await fetch(shipInteriorLevelUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ship interior level JSON: ${response.status}`);
  }

  return (await response.json()) as RawShipInteriorLevel;
}

export async function parseShipInteriorLevel(raw: RawShipInteriorLevel): Promise<ShipInteriorLevel> {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !isInteger(raw.formatVersion) ||
    raw.formatVersion < 1 ||
    typeof raw.name !== 'string' ||
    !isFiniteNumber(raw.width) ||
    !isFiniteNumber(raw.height)
  ) {
    throw new Error('Ship interior level JSON is missing valid metadata.');
  }

  const tilesetDefinitions = Array.isArray(raw.tilesets)
    ? raw.tilesets.map((tileset, index) => validateTileset(tileset, `tilesets[${index}]`))
    : [];
  const layerDefinitions = Array.isArray(raw.layers)
    ? raw.layers.map((layer, index) => validateLayer(layer, `layers[${index}]`))
    : [];
  const paths = Array.isArray(raw.paths)
    ? raw.paths.map((path, index) => validatePath(path, `paths[${index}]`))
    : [];
  const entities = Array.isArray(raw.entities)
    ? raw.entities.map((entity, index) => validateEntity(entity, `entities[${index}]`))
    : [];

  const loadedTilesets: LoadedShipInteriorTileset[] = [];
  const tilesetMap = new Map<string, LoadedShipInteriorTileset>();

  for (const definition of tilesetDefinitions) {
    if (tilesetMap.has(definition.id)) {
      throw new Error(`Duplicate tileset id: ${definition.id}`);
    }

    const sheet = await loadSpriteSheet(resolveLevelAssetUrl(definition.imageSrc), definition.grid);
    const loadedTileset = buildLoadedTileset(definition, sheet);
    loadedTilesets.push(loadedTileset);
    tilesetMap.set(loadedTileset.id, loadedTileset);
  }

  const loadedLayers: LoadedShipInteriorLayer[] = layerDefinitions.map((layer) => {
    const tileset = tilesetMap.get(layer.tilesetId);
    if (!tileset) {
      throw new Error(`Layer "${layer.id}" references unknown tileset "${layer.tilesetId}".`);
    }

    const tiles: LoadedShipInteriorTile[] = layer.tiles.map((tile, index) => {
      const selector = tileset.tiles[tile.tile];
      if (!selector) {
        throw new Error(
          `Layer "${layer.id}" references unknown tile "${tile.tile}" at index ${index}.`,
        );
      }

      return {
        tileId: tile.tile,
        frame: selector,
        tileX: tile.x,
        tileY: tile.y,
      };
    });

    return {
      id: layer.id,
      hasCollision: layer.hasCollision,
      tilesetId: layer.tilesetId,
      sheet: tileset.sheet,
      alphaMask: tileset.alphaMask,
      tilemap: {
        tileWidth: tileset.grid.frameWidth,
        tileHeight: tileset.grid.frameHeight,
        tiles: tiles.map((tile) => ({
          frame: tile.frame,
          tileX: tile.tileX,
          tileY: tile.tileY,
        })),
      },
      tiles,
    };
  });

  const pathMap = new Map(paths.map((path) => [path.id, path] as const));
  const playerEntity = entities.find((entity) => entity.type === 'player') ?? null;
  const patrollers: LoadedShipInteriorPatroller[] = entities
    .filter((entity) => entity.type === 'enemy-patroller')
    .map((entity) => ({
      id: entity.id,
      x: entity.x,
      y: entity.y,
      pathId: entity.pathId,
      patrol: entity.pathId ? (pathMap.get(entity.pathId)?.patrol ?? []) : [],
    }));

  return {
    formatVersion: raw.formatVersion,
    name: raw.name,
    width: raw.width,
    height: raw.height,
    tilesets: loadedTilesets,
    layers: loadedLayers,
    paths,
    entities,
    playerSpawn: playerEntity ? { x: playerEntity.x, y: playerEntity.y } : null,
    patrollers,
  };
}

export async function loadShipInteriorLevel(): Promise<ShipInteriorLevel> {
  return parseShipInteriorLevel(await fetchRawShipInteriorLevel());
}
