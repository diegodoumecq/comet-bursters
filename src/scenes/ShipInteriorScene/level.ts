import { computeAlphaMask } from '@/assets';
import type { AlphaMask } from '@/constants';
import { loadSpriteSheet } from '@/spritesheet';
import type { SpriteSheet, SpriteSheetGridConfig, TilemapLayer } from '@/spritesheet';
import shipInteriorLevelUrl from '../../assets/levels/shipInterior.level.json?url';
import { resolveShipInteriorTileAssetUrl } from './tileAssets';
import { getBundledTilesetDefinitions } from './tilesetCatalog';

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type TileGridPoint = { x: number; y: number };
export type TileCoordinateTuple = [number, number];
export type TileSelector = { column: number; row: number };
export type ShipInteriorLevelGridDefinition = {
  cellWidth: number;
  cellHeight: number;
};

export type ShipInteriorTilesetTileDefinition = {
  id: string;
  position: TileCoordinateTuple;
};

export type ShipInteriorTilesetDefinition = {
  id: string;
  imageSrc: string;
  grid: SpriteSheetGridConfig;
  tiles: ShipInteriorTilesetTileDefinition[];
};

export type ShipInteriorLayerTileDefinition = {
  tile: string;
  x: number;
  y: number;
};

export type ShipInteriorLayerDefinition = {
  id: string;
  hasCollision: boolean;
  overhead?: boolean;
  opacity?: number;
  scaleToGrid?: boolean;
  tilesetId: string;
  tiles: ShipInteriorLayerTileDefinition[];
};

export type ShipInteriorPathPoint = Point & {
  wait?: number;
};

export type ShipInteriorPathDefinition = {
  id: string;
  closed?: boolean;
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
  grid?: ShipInteriorLevelGridDefinition;
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
  overhead: boolean;
  opacity: number;
  scaleToGrid: boolean;
  tilesetId: string;
  sheet: SpriteSheet;
  alphaMask: AlphaMask;
  tilemap: TilemapLayer;
  tiles: LoadedShipInteriorTile[];
};

export type LoadedShipInteriorPath = {
  id: string;
  closed: boolean;
  patrol: ShipInteriorPathPoint[];
};

export type LoadedShipInteriorEntity = ShipInteriorEntityDefinition;

export type LoadedShipInteriorPatroller = {
  id: string;
  x: number;
  y: number;
  pathId?: string;
  closedPath: boolean;
  patrol: ShipInteriorPathPoint[];
};

export type ShipInteriorLevel = {
  formatVersion: number;
  name: string;
  width: number;
  height: number;
  grid: ShipInteriorLevelGridDefinition;
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

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getLevelGrid(level: {
  grid?: ShipInteriorLevelGridDefinition;
}): ShipInteriorLevelGridDefinition {
  return {
    cellWidth:
      level.grid && isFiniteNumber(level.grid.cellWidth) && level.grid.cellWidth > 0
        ? level.grid.cellWidth
        : 16,
    cellHeight:
      level.grid && isFiniteNumber(level.grid.cellHeight) && level.grid.cellHeight > 0
        ? level.grid.cellHeight
        : 16,
  };
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

function normalizeTilesetTiles(tiles: unknown, label: string): ShipInteriorTilesetTileDefinition[] {
  if (Array.isArray(tiles)) {
    return tiles.map((tile, index) => {
      if (!tile || typeof tile !== 'object') {
        throw new Error(`${label}.tiles[${index}] must be an object.`);
      }

      const tileDefinition = tile as ShipInteriorTilesetTileDefinition;
      if (!tileDefinition.id || typeof tileDefinition.id !== 'string') {
        throw new Error(`${label}.tiles[${index}].id must be a string.`);
      }

      validateTileTuple(tileDefinition.position, `${label}.tiles[${index}].position`);

      return {
        id: tileDefinition.id.trim(),
        position: tileDefinition.position,
      };
    });
  }

  if (tiles && typeof tiles === 'object') {
    return Object.entries(tiles as Record<string, unknown>).map(([tileId, tuple]) => ({
      id: tileId,
      position: validateTileTuple(tuple, `${label}.tiles.${tileId}`),
    }));
  }

  throw new Error(`${label}.tiles must be an array.`);
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
  if (!tileset.tiles) {
    throw new Error(`${label}.tiles must be provided.`);
  }

  return {
    id: tileset.id,
    imageSrc: tileset.imageSrc,
    grid: tileset.grid,
    tiles: normalizeTilesetTiles(tileset.tiles, label),
  };
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
  if (layer.overhead !== undefined && typeof layer.overhead !== 'boolean') {
    throw new Error(`${label}.overhead must be a boolean when provided.`);
  }
  if (layer.opacity !== undefined && !isFiniteNumber(layer.opacity)) {
    throw new Error(`${label}.opacity must be a number when provided.`);
  }
  if (layer.scaleToGrid !== undefined && typeof layer.scaleToGrid !== 'boolean') {
    throw new Error(`${label}.scaleToGrid must be a boolean when provided.`);
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

  return {
    ...layer,
    overhead: layer.overhead ?? false,
    opacity: layer.opacity === undefined ? 1 : clampOpacity(layer.opacity),
    scaleToGrid: layer.scaleToGrid ?? false,
  };
}

function validatePath(value: unknown, label: string): ShipInteriorPathDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  const path = value as ShipInteriorPathDefinition;
  if (!path.id || typeof path.id !== 'string') {
    throw new Error(`${label}.id must be a string.`);
  }
  if (path.closed !== undefined && typeof path.closed !== 'boolean') {
    throw new Error(`${label}.closed must be a boolean when provided.`);
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
  const tileAssetUrl = resolveShipInteriorTileAssetUrl(path);
  if (tileAssetUrl) {
    return tileAssetUrl;
  }
  return new URL(path, shipInteriorLevelUrl).href;
}

export function resolveShipInteriorAssetUrl(path: string): string {
  return resolveLevelAssetUrl(path);
}

function tupleToSelector(tuple: TileCoordinateTuple): TileSelector {
  return { column: tuple[0], row: tuple[1] };
}

export function getTilesetTilePositionMap(
  tileset: ShipInteriorTilesetDefinition,
): Record<string, TileCoordinateTuple> {
  return Object.fromEntries(tileset.tiles.map((tile) => [tile.id, tile.position]));
}

function buildLoadedTileset(
  definition: ShipInteriorTilesetDefinition,
  sheet: SpriteSheet,
): LoadedShipInteriorTileset {
  const tiles: Record<string, TileSelector> = {};
  for (const tile of definition.tiles) {
    tiles[tile.id] = tupleToSelector(tile.position);
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

export async function parseShipInteriorLevel(
  raw: RawShipInteriorLevel,
): Promise<ShipInteriorLevel> {
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

  const rawTilesets = Array.isArray((raw as Partial<RawShipInteriorLevel>).tilesets)
    ? raw.tilesets
    : getBundledTilesetDefinitions();
  const grid = getLevelGrid(raw);
  const tilesetDefinitions = rawTilesets.map((tileset, index) =>
    validateTileset(tileset, `tilesets[${index}]`),
  );
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

    const tiles: LoadedShipInteriorTile[] = layer.tiles.flatMap((tile) => {
      const selector = tileset.tiles[tile.tile];
      return selector
        ? [
            {
              tileId: tile.tile,
              frame: selector,
              tileX: tile.x,
              tileY: tile.y,
            },
          ]
        : [];
    });

    return {
      id: layer.id,
      hasCollision: layer.hasCollision,
      overhead: layer.overhead ?? false,
      opacity: layer.opacity ?? 1,
      scaleToGrid: layer.scaleToGrid ?? false,
      tilesetId: layer.tilesetId,
      sheet: tileset.sheet,
      alphaMask: tileset.alphaMask,
      tilemap: {
        tileWidth: grid.cellWidth,
        tileHeight: grid.cellHeight,
        tiles: tiles.map((tile) => ({
          frame: tile.frame,
          width: layer.scaleToGrid ? grid.cellWidth : tileset.grid.frameWidth,
          height: layer.scaleToGrid ? grid.cellHeight : tileset.grid.frameHeight,
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
      closedPath: entity.pathId ? (pathMap.get(entity.pathId)?.closed ?? false) : false,
      patrol: entity.pathId ? (pathMap.get(entity.pathId)?.patrol ?? []) : [],
    }));

  return {
    formatVersion: raw.formatVersion,
    name: raw.name,
    width: raw.width,
    height: raw.height,
    grid,
    tilesets: loadedTilesets,
    layers: loadedLayers,
    paths: paths.map((path) => ({ ...path, closed: path.closed ?? false })),
    entities,
    playerSpawn: playerEntity ? { x: playerEntity.x, y: playerEntity.y } : null,
    patrollers,
  };
}

export async function loadShipInteriorLevel(): Promise<ShipInteriorLevel> {
  return parseShipInteriorLevel(await fetchRawShipInteriorLevel());
}
