import type {
  RawShipInteriorLevel,
  ShipInteriorEntityDefinition,
  ShipInteriorTileId,
  ShipInteriorTilesetDefinition,
} from '../../scenes/ShipInteriorScene/level';
import { resolveShipInteriorAssetUrl } from '../../scenes/ShipInteriorScene/level';

import type { AssetUrlMap } from './editorTypes';

export function cloneLevel(level: RawShipInteriorLevel): RawShipInteriorLevel {
  return JSON.parse(JSON.stringify(level)) as RawShipInteriorLevel;
}

export function serializeShipInteriorLevel(level: RawShipInteriorLevel): string {
  const serializedLevel = { ...level } as Partial<RawShipInteriorLevel>;
  delete serializedLevel.tilesets;
  return JSON.stringify(serializedLevel, null, 2);
}

export function placeTile(
  level: RawShipInteriorLevel,
  layerId: string,
  tileId: ShipInteriorTileId,
  x: number,
  y: number,
): RawShipInteriorLevel {
  return {
    ...level,
    layers: level.layers.map((layer) =>
      layer.id !== layerId
        ? layer
        : {
            ...layer,
            tiles: [
              ...layer.tiles.filter((tile) => tile.x !== x || tile.y !== y),
              { tile: tileId, x, y },
            ],
          },
    ),
  };
}

export function placeTiles(
  level: RawShipInteriorLevel,
  layerId: string,
  tileId: ShipInteriorTileId,
  cells: Array<{ x: number; y: number }>,
): RawShipInteriorLevel {
  const cellKeys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  return {
    ...level,
    layers: level.layers.map((layer) =>
      layer.id !== layerId
        ? layer
        : {
            ...layer,
            tiles: [
              ...layer.tiles.filter((tile) => !cellKeys.has(`${tile.x},${tile.y}`)),
              ...cells.map((cell) => ({ tile: tileId, x: cell.x, y: cell.y })),
            ],
          },
    ),
  };
}

export function eraseTile(
  level: RawShipInteriorLevel,
  layerId: string,
  x: number,
  y: number,
): RawShipInteriorLevel {
  return {
    ...level,
    layers: level.layers.map((layer) =>
      layer.id !== layerId
        ? layer
        : {
            ...layer,
            tiles: layer.tiles.filter((tile) => tile.x !== x || tile.y !== y),
          },
    ),
  };
}

export function upsertEntity(
  level: RawShipInteriorLevel,
  entity: ShipInteriorEntityDefinition,
): RawShipInteriorLevel {
  const existingIndex = level.entities.findIndex((candidate) => candidate.id === entity.id);
  if (existingIndex === -1) {
    return {
      ...level,
      entities: [...level.entities, entity],
    };
  }

  const entities = level.entities.slice();
  entities[existingIndex] = entity;
  return {
    ...level,
    entities,
  };
}

export function removeEntity(level: RawShipInteriorLevel, entityId: string): RawShipInteriorLevel {
  return {
    ...level,
    entities: level.entities.filter((entity) => entity.id !== entityId),
  };
}

export function makeEntityId(level: RawShipInteriorLevel, prefix: string): string {
  let nextId = level.entities.length + 1;
  while (level.entities.some((entity) => entity.id === `${prefix}-${nextId}`)) {
    nextId++;
  }
  return `${prefix}-${nextId}`;
}

export function findNearestEntity(
  level: RawShipInteriorLevel,
  x: number,
  y: number,
  maxDistance = 26,
): ShipInteriorEntityDefinition | null {
  let nearest: ShipInteriorEntityDefinition | null = null;
  let nearestDistance = maxDistance;

  for (const entity of level.entities) {
    const distance = Math.hypot(entity.x - x, entity.y - y);
    if (distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function findPathPointAtPosition(
  level: RawShipInteriorLevel,
  pathId: string,
  x: number,
  y: number,
  maxDistance = 16,
): { index: number; x: number; y: number } | null {
  const path = level.paths.find((candidate) => candidate.id === pathId);
  if (!path) {
    return null;
  }

  let nearestPoint: { index: number; x: number; y: number } | null = null;
  let nearestDistance = maxDistance;

  path.patrol.forEach((point, index) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= nearestDistance) {
      nearestPoint = { index, x: point.x, y: point.y };
      nearestDistance = distance;
    }
  });

  return nearestPoint;
}

export function appendPointToPath(
  level: RawShipInteriorLevel,
  pathId: string,
  x: number,
  y: number,
): RawShipInteriorLevel {
  return {
    ...level,
    paths: level.paths.map((path) =>
      path.id !== pathId
        ? path
        : {
            ...path,
            patrol: [...path.patrol, { x, y }],
          },
    ),
  };
}

export function updatePathPoint(
  level: RawShipInteriorLevel,
  pathId: string,
  pointIndex: number,
  x: number,
  y: number,
): RawShipInteriorLevel {
  return {
    ...level,
    paths: level.paths.map((path) =>
      path.id !== pathId
        ? path
        : {
            ...path,
            patrol: path.patrol.map((point, index) =>
              index !== pointIndex ? point : { ...point, x, y },
            ),
          },
    ),
  };
}

export function removePathPoint(
  level: RawShipInteriorLevel,
  pathId: string,
  pointIndex: number,
): RawShipInteriorLevel {
  return {
    ...level,
    paths: level.paths.map((path) =>
      path.id !== pathId
        ? path
        : {
            ...path,
            patrol: path.patrol.filter((_, index) => index !== pointIndex),
          },
    ),
  };
}

export function getTilesetForLayer(
  level: RawShipInteriorLevel,
  layerId: string | null,
): ShipInteriorTilesetDefinition | null {
  if (!layerId) {
    return null;
  }

  const layer = level.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return null;
  }

  return level.tilesets.find((candidate) => candidate.id === layer.tilesetId) ?? null;
}

export function getEffectiveTilesetImageSrc(
  tileset: ShipInteriorTilesetDefinition,
  assetUrls: AssetUrlMap,
): string {
  return assetUrls[tileset.id] ?? resolveShipInteriorAssetUrl(tileset.imageSrc);
}
