import {
  cardinalTopologyDirections,
  getTileTopologyRelation,
  getTileTopologySpecificityForDirections,
  getTileVariantWeight,
  topologyDirectionOffsets,
  topologyDirections,
  type TileTopologyDirection,
} from './autotile';
import type { RawShipInteriorLevel, ShipInteriorTileId } from '../../scenes/ShipInteriorScene/level';
import type { EditorTilesetDefinition, EditorTilesetTileDefinition } from './editorTileset';
export type MaterialPlacementMap = Record<string, Record<string, string>>;
export type ResolvedMaterialTilePreview = {
  material: string;
  tileId: ShipInteriorTileId;
  x: number;
  y: number;
};

export function cloneMaterialPlacementMap(
  materialPlacements: MaterialPlacementMap,
): MaterialPlacementMap {
  return Object.fromEntries(
    Object.entries(materialPlacements).map(([layerId, placements]) => [layerId, { ...placements }]),
  );
}

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

export function getMaterialPlacementKey(x: number, y: number): string {
  return `${x},${y}`;
}

function parseMaterialPlacementCell(key: string, material: string): MaterialCell | null {
  const [x, y] = key.split(',').map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { key, material, x, y };
}

function tileMatchesTopologyForPlacements(
  tile: EditorTilesetTileDefinition,
  cell: MaterialCell,
  placementsByCellKey: Record<string, string>,
  directions: readonly TileTopologyDirection[],
): boolean {
  if (tile.topology === undefined) {
    return false;
  }

  return directions.every((direction) => {
    const expectedRelation = getTileTopologyRelation(tile.topology, direction);
    const offset = topologyDirectionOffsets[direction];
    const neighborMaterial =
      placementsByCellKey[getMaterialPlacementKey(cell.x + offset.dx, cell.y + offset.dy)];
    return (
      expectedRelation === 'any' ||
      expectedRelation === (neighborMaterial === cell.material ? 'same' : 'different')
    );
  });
}

function compareTileVariants(
  left: EditorTilesetTileDefinition,
  right: EditorTilesetTileDefinition,
): number {
  return (
    (left.variantGroup ?? left.name).localeCompare(right.variantGroup ?? right.name) ||
    left.name.localeCompare(right.name) ||
    left.id - right.id
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
  specificityDirections: readonly TileTopologyDirection[],
): EditorTilesetTileDefinition | null {
  if (candidates.length === 0) {
    return null;
  }

  const highestSpecificity = Math.max(
    ...candidates.map((candidate) =>
      getTileTopologySpecificityForDirections(candidate.topology, specificityDirections),
    ),
  );

  for (let specificity = highestSpecificity; specificity >= 0; specificity -= 1) {
    const exactCandidates = candidates
      .filter(
        (candidate) =>
          getTileTopologySpecificityForDirections(candidate.topology, specificityDirections) ===
          specificity,
      )
      .sort(compareTileVariants);
    const weightedCandidates = exactCandidates.flatMap((candidate) => {
      const weight = getTileVariantWeight(candidate.variantWeight);
      return weight > 0 ? [[candidate, weight] as const] : [];
    });

    if (weightedCandidates.length === 0) {
      continue;
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

  return null;
}

export function resolveMaterialTilesForCells(
  level: RawShipInteriorLevel,
  layerId: string,
  materialPlacements: MaterialPlacementMap,
  cells: Array<{ x: number; y: number }>,
): ResolvedMaterialTilePreview[] {
  const layer = level.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return [];
  }

  const tileset = level.tilesets.find((candidate) => candidate.id === layer.tilesetId);
  if (!tileset) {
    return [];
  }

  const editorTileset = tileset as EditorTilesetDefinition;
  const placementsByCellKey = materialPlacements[layerId] ?? {};
  const uniqueKeys = new Set(cells.map((cell) => getMaterialPlacementKey(cell.x, cell.y)));

  return Array.from(uniqueKeys).flatMap((key) => {
    const material = placementsByCellKey[key];
    if (!material) {
      return [];
    }

    const cell = parseMaterialPlacementCell(key, material);
    if (!cell) {
      return [];
    }

    const materialTiles = editorTileset.tiles.filter(
      (tile) => tile.material === cell.material && tile.topology !== undefined,
    );
    const exactCandidates = materialTiles.filter((tile) =>
      tileMatchesTopologyForPlacements(tile, cell, placementsByCellKey, topologyDirections),
    );
    const resolvedTile =
      chooseAutotileVariant(layerId, cell, exactCandidates, topologyDirections) ??
      chooseAutotileVariant(
        layerId,
        cell,
        materialTiles.filter((tile) =>
          tileMatchesTopologyForPlacements(
            tile,
            cell,
            placementsByCellKey,
            cardinalTopologyDirections,
          ),
        ),
        cardinalTopologyDirections,
      );

    return resolvedTile
      ? [
          {
            material: cell.material,
            tileId: resolvedTile.id,
            x: cell.x,
            y: cell.y,
          } satisfies ResolvedMaterialTilePreview,
        ]
      : [];
  });
}

function paintConcreteTile(
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

function clearConcreteTilesAtCellKeys(
  level: RawShipInteriorLevel,
  layerId: string,
  cellKeys: Set<string>,
): RawShipInteriorLevel {
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

function getExpandedMaterialCells(cells: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const expandedCells = new Map<string, { x: number; y: number }>();

  for (const cell of cells) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const expandedCell = { x: cell.x + dx, y: cell.y + dy };
        expandedCells.set(getMaterialPlacementKey(expandedCell.x, expandedCell.y), expandedCell);
      }
    }
  }

  return Array.from(expandedCells.values());
}

function applyResolvedMaterialTilesForCells(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string,
  cells: Array<{ x: number; y: number }>,
): RawShipInteriorLevel {
  if (cells.length === 0) {
    return level;
  }

  const affectedCells = getExpandedMaterialCells(cells);
  const affectedCellKeys = new Set(
    affectedCells.map((cell) => getMaterialPlacementKey(cell.x, cell.y)),
  );
  const assignments = resolveMaterialTilesForCells(level, layerId, materialPlacements, affectedCells);
  const clearedLevel = clearConcreteTilesAtCellKeys(level, layerId, affectedCellKeys);

  return assignments.reduce(
    (nextLevel, tile) => paintConcreteTile(nextLevel, layerId, tile.tileId, tile.x, tile.y),
    clearedLevel,
  );
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

export function clearMaterialPlacements(
  materialPlacements: MaterialPlacementMap,
  layerId: string | null,
  cells: Array<{ x: number; y: number }>,
): MaterialPlacementMap {
  if (!layerId || !materialPlacements[layerId] || cells.length === 0) {
    return materialPlacements;
  }

  const nextLayerPlacements = { ...materialPlacements[layerId] };
  for (const cell of cells) {
    delete nextLayerPlacements[getMaterialPlacementKey(cell.x, cell.y)];
  }

  return {
    ...materialPlacements,
    [layerId]: nextLayerPlacements,
  };
}

export function refreshMaterialPlacementTilesAround(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string | null,
  x: number,
  y: number,
): RawShipInteriorLevel {
  if (!layerId) {
    return level;
  }

  return applyResolvedMaterialTilesForCells(level, materialPlacements, layerId, [{ x, y }]);
}

export function refreshMaterialPlacementTilesForCells(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string | null,
  cells: Array<{ x: number; y: number }>,
): RawShipInteriorLevel {
  if (!layerId) {
    return level;
  }

  return applyResolvedMaterialTilesForCells(level, materialPlacements, layerId, cells);
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
    level: applyResolvedMaterialTilesForCells(level, nextMaterialPlacements, layerId, [{ x, y }]),
    materialPlacements: nextMaterialPlacements,
  };
}

export function applyMaterialPlacements(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string | null,
  materialName: string | null,
  cells: Array<{ x: number; y: number }>,
): { level: RawShipInteriorLevel; materialPlacements: MaterialPlacementMap } {
  if (!layerId || !materialName || cells.length === 0) {
    return { level, materialPlacements };
  }

  const nextMaterialPlacements = {
    ...materialPlacements,
    [layerId]: {
      ...(materialPlacements[layerId] ?? {}),
      ...Object.fromEntries(
        cells.map((cell) => [getMaterialPlacementKey(cell.x, cell.y), materialName]),
      ),
    },
  };

  return {
    level: applyResolvedMaterialTilesForCells(level, nextMaterialPlacements, layerId, cells),
    materialPlacements: nextMaterialPlacements,
  };
}
