import type {
  RawShipInteriorLevel,
  ShipInteriorEntityDefinition,
  ShipInteriorTilesetDefinition,
} from '../../scenes/ShipInteriorScene/level';
import { resolveShipInteriorAssetUrl } from '../../scenes/ShipInteriorScene/level';

import type { AssetUrlMap } from './editorTypes';

export function cloneLevel(level: RawShipInteriorLevel): RawShipInteriorLevel {
  return JSON.parse(JSON.stringify(level)) as RawShipInteriorLevel;
}

export function serializeShipInteriorLevel(level: RawShipInteriorLevel): string {
  return JSON.stringify(level, null, 2);
}

export function placeTile(
  level: RawShipInteriorLevel,
  layerId: string,
  tileId: string,
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
