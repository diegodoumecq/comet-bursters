import type {
  RawShipInteriorLevel,
  ShipInteriorEntityDefinition,
  ShipInteriorLayerDefinition,
  ShipInteriorLayerTileDefinition,
  ShipInteriorPathDefinition,
  ShipInteriorTileId,
} from '../../scenes/ShipInteriorScene/level';
import { cloneLevel } from '../shared/levelEditing';
import type { MaterialPlacementMap } from '../shared/materials';
import { cloneMaterialPlacementMap } from '../shared/materials';

export type EditorDocument = {
  level: RawShipInteriorLevel;
  materialPlacements: MaterialPlacementMap;
};

type LayerTileChange = {
  x: number;
  y: number;
  beforeTileId: ShipInteriorTileId | null;
  afterTileId: ShipInteriorTileId | null;
};

type MaterialPlacementChange = {
  key: string;
  beforeMaterial: string | null;
  afterMaterial: string | null;
};

type LayerHistoryPatch = {
  layerId: string;
  materialChanges: MaterialPlacementChange[];
  tileChanges: LayerTileChange[];
};

export type EditorHistoryEntry =
  | {
      type: 'document';
      before: EditorDocument;
      after: EditorDocument;
    }
  | {
      type: 'layers';
      layers: LayerHistoryPatch[];
    }
  | {
      type: 'entities';
      before: ShipInteriorEntityDefinition[];
      after: ShipInteriorEntityDefinition[];
    }
  | {
      type: 'paths';
      before: ShipInteriorPathDefinition[];
      after: ShipInteriorPathDefinition[];
    };

function layerTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function equalByJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function equalLevelMetadata(left: RawShipInteriorLevel, right: RawShipInteriorLevel): boolean {
  return (
    left.formatVersion === right.formatVersion &&
    left.name === right.name &&
    left.width === right.width &&
    left.height === right.height &&
    equalByJson(left.grid, right.grid) &&
    equalByJson(left.tilesets, right.tilesets)
  );
}

function equalLayerMetadata(
  left: ShipInteriorLayerDefinition,
  right: ShipInteriorLayerDefinition,
): boolean {
  return (
    left.id === right.id &&
    left.hasCollision === right.hasCollision &&
    left.overhead === right.overhead &&
    left.opacity === right.opacity &&
    left.scaleToGrid === right.scaleToGrid &&
    left.tilesetId === right.tilesetId
  );
}

function toLayerTileMap(tiles: ShipInteriorLayerTileDefinition[]): Map<string, ShipInteriorTileId> {
  return new Map(
    tiles.flatMap((tile) =>
      typeof tile.tile === 'number' ? [[layerTileKey(tile.x, tile.y), tile.tile] as const] : [],
    ),
  );
}

function diffLayerTiles(
  beforeTiles: ShipInteriorLayerTileDefinition[],
  afterTiles: ShipInteriorLayerTileDefinition[],
): LayerTileChange[] {
  const beforeMap = toLayerTileMap(beforeTiles);
  const afterMap = toLayerTileMap(afterTiles);
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  return Array.from(keys)
    .map((key) => {
      const [x, y] = key.split(',').map(Number);
      const beforeTileId = beforeMap.get(key) ?? null;
      const afterTileId = afterMap.get(key) ?? null;
      return beforeTileId === afterTileId
        ? null
        : {
            x,
            y,
            beforeTileId,
            afterTileId,
          };
    })
    .filter((change): change is LayerTileChange => change !== null);
}

function diffMaterialPlacements(
  beforePlacements: Record<string, string> | undefined,
  afterPlacements: Record<string, string> | undefined,
): MaterialPlacementChange[] {
  const beforeEntries = beforePlacements ?? {};
  const afterEntries = afterPlacements ?? {};
  const keys = new Set([...Object.keys(beforeEntries), ...Object.keys(afterEntries)]);

  return Array.from(keys)
    .map((key) => {
      const beforeMaterial = beforeEntries[key] ?? null;
      const afterMaterial = afterEntries[key] ?? null;
      const change: MaterialPlacementChange | null =
        beforeMaterial === afterMaterial
          ? null
          : {
              key,
              beforeMaterial,
              afterMaterial,
            };

      return change;
    })
    .filter((change): change is MaterialPlacementChange => change !== null);
}

export function cloneMaterialPlacements(
  materialPlacements: MaterialPlacementMap,
): MaterialPlacementMap {
  return cloneMaterialPlacementMap(materialPlacements);
}

export function cloneEditorDocument(document: EditorDocument): EditorDocument {
  return {
    level: cloneLevel(document.level),
    materialPlacements: cloneMaterialPlacements(document.materialPlacements),
  };
}

function createLayerHistoryEntry(
  before: EditorDocument,
  after: EditorDocument,
): EditorHistoryEntry | null {
  if (!equalLevelMetadata(before.level, after.level)) {
    return null;
  }
  if (!equalByJson(before.level.entities, after.level.entities)) {
    return null;
  }
  if (!equalByJson(before.level.paths, after.level.paths)) {
    return null;
  }
  if (before.level.layers.length !== after.level.layers.length) {
    return null;
  }

  const layers: LayerHistoryPatch[] = [];
  for (let index = 0; index < before.level.layers.length; index += 1) {
    const beforeLayer = before.level.layers[index];
    const afterLayer = after.level.layers[index];
    if (!beforeLayer || !afterLayer || !equalLayerMetadata(beforeLayer, afterLayer)) {
      return null;
    }

    const tileChanges = diffLayerTiles(beforeLayer.tiles, afterLayer.tiles);
    const materialChanges = diffMaterialPlacements(
      before.materialPlacements[beforeLayer.id],
      after.materialPlacements[afterLayer.id],
    );
    if (tileChanges.length > 0 || materialChanges.length > 0) {
      layers.push({
        layerId: beforeLayer.id,
        materialChanges,
        tileChanges,
      });
    }
  }

  return layers.length > 0 ? { type: 'layers', layers } : null;
}

function createEntitiesHistoryEntry(
  before: EditorDocument,
  after: EditorDocument,
): EditorHistoryEntry | null {
  if (!equalLevelMetadata(before.level, after.level)) {
    return null;
  }
  if (!equalByJson(before.level.layers, after.level.layers)) {
    return null;
  }
  if (!equalByJson(before.level.paths, after.level.paths)) {
    return null;
  }
  if (!equalByJson(before.materialPlacements, after.materialPlacements)) {
    return null;
  }
  if (equalByJson(before.level.entities, after.level.entities)) {
    return null;
  }

  return {
    type: 'entities',
    before: structuredClone(before.level.entities),
    after: structuredClone(after.level.entities),
  };
}

function createPathsHistoryEntry(
  before: EditorDocument,
  after: EditorDocument,
): EditorHistoryEntry | null {
  if (!equalLevelMetadata(before.level, after.level)) {
    return null;
  }
  if (!equalByJson(before.level.layers, after.level.layers)) {
    return null;
  }
  if (!equalByJson(before.level.entities, after.level.entities)) {
    return null;
  }
  if (!equalByJson(before.materialPlacements, after.materialPlacements)) {
    return null;
  }
  if (equalByJson(before.level.paths, after.level.paths)) {
    return null;
  }

  return {
    type: 'paths',
    before: structuredClone(before.level.paths),
    after: structuredClone(after.level.paths),
  };
}

export function createEditorHistoryEntry(
  before: EditorDocument,
  after: EditorDocument,
): EditorHistoryEntry | null {
  return (
    createLayerHistoryEntry(before, after) ??
    createEntitiesHistoryEntry(before, after) ??
    createPathsHistoryEntry(before, after) ??
    (equalByJson(before, after)
      ? null
      : {
          type: 'document',
          before: cloneEditorDocument(before),
          after: cloneEditorDocument(after),
        })
  );
}

function applyLayerChanges(
  tiles: ShipInteriorLayerTileDefinition[],
  changes: LayerTileChange[],
  direction: 'before' | 'after',
): ShipInteriorLayerTileDefinition[] {
  const nextTiles = new Map<string, ShipInteriorLayerTileDefinition>(
    tiles.map((tile) => [layerTileKey(tile.x, tile.y), tile]),
  );

  for (const change of changes) {
    const key = layerTileKey(change.x, change.y);
    const tileId = direction === 'before' ? change.beforeTileId : change.afterTileId;
    if (tileId) {
      nextTiles.set(key, { tile: tileId, x: change.x, y: change.y });
    } else {
      nextTiles.delete(key);
    }
  }

  return Array.from(nextTiles.values());
}

function applyMaterialChanges(
  placements: Record<string, string> | undefined,
  changes: MaterialPlacementChange[],
  direction: 'before' | 'after',
): Record<string, string> | undefined {
  const nextPlacements = { ...(placements ?? {}) };

  for (const change of changes) {
    const material = direction === 'before' ? change.beforeMaterial : change.afterMaterial;
    if (material) {
      nextPlacements[change.key] = material;
    } else {
      delete nextPlacements[change.key];
    }
  }

  return Object.keys(nextPlacements).length > 0 ? nextPlacements : undefined;
}

export function applyEditorHistoryEntry(
  document: EditorDocument,
  entry: EditorHistoryEntry,
  direction: 'before' | 'after',
): EditorDocument {
  if (entry.type === 'document') {
    return cloneEditorDocument(entry[direction]);
  }

  if (entry.type === 'entities') {
    return {
      level: {
        ...document.level,
        entities: structuredClone(entry[direction]),
      },
      materialPlacements: cloneMaterialPlacements(document.materialPlacements),
    };
  }

  if (entry.type === 'paths') {
    return {
      level: {
        ...document.level,
        paths: structuredClone(entry[direction]),
      },
      materialPlacements: cloneMaterialPlacements(document.materialPlacements),
    };
  }

  const nextPlacements = cloneMaterialPlacements(document.materialPlacements);
  return {
    level: {
      ...document.level,
      layers: document.level.layers.map((layer) => {
        const patch = entry.layers.find((candidate) => candidate.layerId === layer.id);
        if (!patch) {
          return layer;
        }

        const nextLayerPlacements = applyMaterialChanges(
          nextPlacements[layer.id],
          patch.materialChanges,
          direction,
        );
        if (nextLayerPlacements) {
          nextPlacements[layer.id] = nextLayerPlacements;
        } else {
          delete nextPlacements[layer.id];
        }

        return {
          ...layer,
          tiles: applyLayerChanges(layer.tiles, patch.tileChanges, direction),
        };
      }),
    },
    materialPlacements: nextPlacements,
  };
}
