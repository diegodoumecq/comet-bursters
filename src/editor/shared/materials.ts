import {
  getTileTopologyRelation,
  getTileTopologySpecificity,
  getTileVariantWeight,
  topologyDirectionOffsets,
  topologyDirections,
  type TileTopologyDirection,
  type TileTopologyRelation,
} from './autotile';
import type { RawShipInteriorLevel } from '../../scenes/ShipInteriorScene/level';
import type { EditorTilesetDefinition, EditorTilesetTileDefinition } from './editorTileset';
export type MaterialPlacementMap = Record<string, Record<string, string>>;

export const materialColorByName: Record<string, string> = {
  door: '#facc15',
  floor: '#22c55e',
  hazard: '#fb7185',
  wall: '#38bdf8',
};

const fallbackMaterialColors = ['#a78bfa', '#fb923c', '#2dd4bf', '#f472b6', '#c4b5fd'];

type MaterialCell = {
  key: string;
  material: string;
  x: number;
  y: number;
};

export function getMaterialColor(materialName: string): string {
  const hardcodedColor = materialColorByName[materialName];
  if (hardcodedColor) {
    return hardcodedColor;
  }

  const colorIndex =
    Array.from(materialName).reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    fallbackMaterialColors.length;
  return fallbackMaterialColors[colorIndex];
}

export function getTilesetMaterials(tileset: EditorTilesetDefinition | null): string[] {
  if (!tileset) {
    return [];
  }

  return Array.from(
    new Set([
      ...(tileset.materials ?? []),
      ...tileset.tiles
        .map((tile) => tile.material)
        .filter((material): material is string => Boolean(material)),
    ]),
  ).sort((left, right) => left.localeCompare(right));
}

function getMaterialPlacementKey(x: number, y: number): string {
  return `${x},${y}`;
}

function parseMaterialPlacementCell(key: string, material: string): MaterialCell | null {
  const [x, y] = key.split(',').map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { key, material, x, y };
}

function getLayerMaterialCells(
  materialPlacements: MaterialPlacementMap,
  layerId: string,
): MaterialCell[] {
  return Object.entries(materialPlacements[layerId] ?? {})
    .map(([key, material]) => parseMaterialPlacementCell(key, material))
    .filter((cell): cell is MaterialCell => Boolean(cell));
}

function getTopologyRelationForDirection(
  cell: MaterialCell,
  direction: TileTopologyDirection,
  materialsByCellKey: Map<string, string>,
): TileTopologyRelation {
  const offset = topologyDirectionOffsets[direction];
  const neighborMaterial = materialsByCellKey.get(
    getMaterialPlacementKey(cell.x + offset.dx, cell.y + offset.dy),
  );
  return neighborMaterial === cell.material ? 'same' : 'different';
}

function tileMatchesTopology(
  tile: EditorTilesetTileDefinition,
  cell: MaterialCell,
  materialsByCellKey: Map<string, string>,
): boolean {
  if (tile.topology === undefined) {
    return false;
  }

  return topologyDirections.every((direction) => {
    const expectedRelation = getTileTopologyRelation(tile.topology, direction);
    return (
      expectedRelation === 'any' ||
      expectedRelation === getTopologyRelationForDirection(cell, direction, materialsByCellKey)
    );
  });
}

function compareTileVariants(
  left: EditorTilesetTileDefinition,
  right: EditorTilesetTileDefinition,
): number {
  return (
    (left.variantGroup ?? left.id).localeCompare(right.variantGroup ?? right.id) ||
    left.id.localeCompare(right.id)
  );
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function chooseAutotileVariant(
  layerId: string,
  cell: MaterialCell,
  candidates: EditorTilesetTileDefinition[],
): EditorTilesetTileDefinition | null {
  if (candidates.length === 0) {
    return null;
  }

  const highestSpecificity = Math.max(
    ...candidates.map((candidate) => getTileTopologySpecificity(candidate.topology)),
  );
  const exactCandidates = candidates
    .filter((candidate) => getTileTopologySpecificity(candidate.topology) === highestSpecificity)
    .sort(compareTileVariants);
  const weightedCandidates = exactCandidates.flatMap((candidate) => {
    const weight = getTileVariantWeight(candidate.variantWeight);
    return weight > 0 ? [[candidate, weight] as const] : [];
  });

  if (weightedCandidates.length === 0) {
    return null;
  }

  const totalWeight = weightedCandidates.reduce((sum, [, weight]) => sum + weight, 0);
  const targetWeight = hashText(`${layerId}:${cell.material}:${cell.x},${cell.y}`) % totalWeight;

  let remainingWeight = targetWeight;
  for (const [candidate, weight] of weightedCandidates) {
    if (remainingWeight < weight) {
      return candidate;
    }
    remainingWeight -= weight;
  }

  return weightedCandidates[0]?.[0] ?? null;
}

function resolveMaterialTilesForLayer(
  level: RawShipInteriorLevel,
  layerId: string,
  materialPlacements: MaterialPlacementMap,
): Map<string, EditorTilesetTileDefinition> {
  const layer = level.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return new Map();
  }

  const tileset = level.tilesets.find((candidate) => candidate.id === layer.tilesetId);
  if (!tileset) {
    return new Map();
  }
  const editorTileset = tileset as EditorTilesetDefinition;

  const cells = getLayerMaterialCells(materialPlacements, layerId);
  const materialsByCellKey = new Map(cells.map((cell) => [cell.key, cell.material]));

  return new Map(
    cells.flatMap((cell) => {
      const candidates = editorTileset.tiles.filter(
        (tile) =>
          tile.material === cell.material &&
          tile.topology !== undefined &&
          tileMatchesTopology(tile, cell, materialsByCellKey),
      );
      const resolvedTile = chooseAutotileVariant(layerId, cell, candidates);
      return resolvedTile ? [[cell.key, resolvedTile] as const] : [];
    }),
  );
}

function paintConcreteTile(
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

function clearConcreteTilesAtMaterialCells(
  level: RawShipInteriorLevel,
  layerId: string,
  cells: MaterialCell[],
): RawShipInteriorLevel {
  const cellKeys = new Set(cells.map((cell) => cell.key));
  return {
    ...level,
    layers: level.layers.map((layer) =>
      layer.id !== layerId
        ? layer
        : {
            ...layer,
            tiles: layer.tiles.filter(
              (tile) => !cellKeys.has(getMaterialPlacementKey(tile.x, tile.y)),
            ),
          },
    ),
  };
}

function applyResolvedMaterialTiles(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string,
): RawShipInteriorLevel {
  const cells = getLayerMaterialCells(materialPlacements, layerId);
  const assignments = resolveMaterialTilesForLayer(level, layerId, materialPlacements);
  const clearedLevel = clearConcreteTilesAtMaterialCells(level, layerId, cells);

  return Array.from(assignments.entries()).reduce((nextLevel, [key, tile]) => {
    const materialCell = parseMaterialPlacementCell(key, tile.material ?? '');
    return materialCell
      ? paintConcreteTile(nextLevel, layerId, tile.id, materialCell.x, materialCell.y)
      : nextLevel;
  }, clearedLevel);
}

function setPlacedMaterial(
  materialPlacements: MaterialPlacementMap,
  layerId: string,
  x: number,
  y: number,
  materialName: string,
): MaterialPlacementMap {
  return {
    ...materialPlacements,
    [layerId]: {
      ...(materialPlacements[layerId] ?? {}),
      [getMaterialPlacementKey(x, y)]: materialName,
    },
  };
}

export function clearMaterialPlacement(
  materialPlacements: MaterialPlacementMap,
  layerId: string | null,
  x: number,
  y: number,
): MaterialPlacementMap {
  if (!layerId || !materialPlacements[layerId]) {
    return materialPlacements;
  }

  const nextLayerPlacements = { ...materialPlacements[layerId] };
  delete nextLayerPlacements[getMaterialPlacementKey(x, y)];

  return {
    ...materialPlacements,
    [layerId]: nextLayerPlacements,
  };
}

export function refreshMaterialPlacementTilesAround(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string | null,
  _x: number,
  _y: number,
): RawShipInteriorLevel {
  if (!layerId) {
    return level;
  }

  return applyResolvedMaterialTiles(level, materialPlacements, layerId);
}

export function applyMaterialPlacement(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string | null,
  materialName: string | null,
  x: number,
  y: number,
): { level: RawShipInteriorLevel; materialPlacements: MaterialPlacementMap } {
  if (!layerId || !materialName) {
    return { level, materialPlacements };
  }

  const nextMaterialPlacements = setPlacedMaterial(materialPlacements, layerId, x, y, materialName);

  return {
    level: applyResolvedMaterialTiles(level, nextMaterialPlacements, layerId),
    materialPlacements: nextMaterialPlacements,
  };
}
