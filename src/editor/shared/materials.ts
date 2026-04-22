import type {
  RawShipInteriorLevel,
  ShipInteriorTilesetDefinition,
  ShipInteriorTilesetTileDefinition,
} from '../../scenes/ShipInteriorScene/level';

export type EditorTileAdjacencyDirection = 'up' | 'right' | 'down' | 'left';
export type EditorTilesetTileDefinition = ShipInteriorTilesetTileDefinition & {
  adjacency?: Partial<Record<EditorTileAdjacencyDirection, string>>;
  material?: string;
};
export type EditorTilesetDefinition = Omit<ShipInteriorTilesetDefinition, 'tiles'> & {
  defaultMatchingGroup?: string;
  materials?: string[];
  tiles: EditorTilesetTileDefinition[];
};
export type MaterialPlacementMap = Record<string, Record<string, string>>;

export const materialColorByName: Record<string, string> = {
  door: '#facc15',
  floor: '#22c55e',
  hazard: '#fb7185',
  wall: '#38bdf8',
};

const fallbackMaterialColors = ['#a78bfa', '#fb923c', '#2dd4bf', '#f472b6', '#c4b5fd'];
const adjacencyDirections: Array<{
  direction: EditorTileAdjacencyDirection;
  dx: number;
  dy: number;
  opposite: EditorTileAdjacencyDirection;
}> = [
  { direction: 'up', dx: 0, dy: -1, opposite: 'down' },
  { direction: 'right', dx: 1, dy: 0, opposite: 'left' },
  { direction: 'down', dx: 0, dy: 1, opposite: 'up' },
  { direction: 'left', dx: -1, dy: 0, opposite: 'right' },
];
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

export function getTilesetMaterials(tileset: ShipInteriorTilesetDefinition | null): string[] {
  if (!tileset) {
    return [];
  }

  const editorTileset = tileset as EditorTilesetDefinition;
  return Array.from(
    new Set([
      ...(editorTileset.materials ?? []),
      ...editorTileset.tiles.map((tile) => tile.material).filter((material): material is string =>
        Boolean(material),
      ),
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

function tileMatchesDefaultBorders(
  tile: EditorTilesetTileDefinition,
  tileset: EditorTilesetDefinition,
  materialCellKeys: Set<string>,
  cell: MaterialCell,
): boolean {
  return adjacencyDirections.every(({ direction, dx, dy }) => {
    const neighborKey = getMaterialPlacementKey(cell.x + dx, cell.y + dy);
    if (materialCellKeys.has(neighborKey) || !tileset.defaultMatchingGroup) {
      return true;
    }

    return tile.adjacency?.[direction] === tileset.defaultMatchingGroup;
  });
}

function tileSidesMatch(
  tile: EditorTilesetTileDefinition,
  direction: EditorTileAdjacencyDirection,
  neighbor: EditorTilesetTileDefinition,
  opposite: EditorTileAdjacencyDirection,
): boolean {
  const tileGroup = tile.adjacency?.[direction];
  const neighborGroup = neighbor.adjacency?.[opposite];
  return Boolean(tileGroup && neighborGroup && tileGroup === neighborGroup);
}

function getConnectedMaterialComponents(cells: MaterialCell[]): MaterialCell[][] {
  const cellsByKey = new Map(cells.map((cell) => [cell.key, cell]));
  const visited = new Set<string>();
  const components: MaterialCell[][] = [];

  for (const cell of cells) {
    if (visited.has(cell.key)) {
      continue;
    }

    const component: MaterialCell[] = [];
    const queue = [cell];
    visited.add(cell.key);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      component.push(current);
      for (const { dx, dy } of adjacencyDirections) {
        const neighborKey = getMaterialPlacementKey(current.x + dx, current.y + dy);
        const neighbor = cellsByKey.get(neighborKey);
        if (!neighbor || visited.has(neighborKey)) {
          continue;
        }

        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

function solveMaterialComponent(
  component: MaterialCell[],
  candidatesByCellKey: Map<string, EditorTilesetTileDefinition[]>,
): Map<string, EditorTilesetTileDefinition> {
  const assignments = new Map<string, EditorTilesetTileDefinition>();

  const tileCanFit = (cell: MaterialCell, tile: EditorTilesetTileDefinition): boolean =>
    adjacencyDirections.every(({ direction, dx, dy, opposite }) => {
      const neighborKey = getMaterialPlacementKey(cell.x + dx, cell.y + dy);
      const neighbor = assignments.get(neighborKey);
      return neighbor ? tileSidesMatch(tile, direction, neighbor, opposite) : true;
    });

  const hasFutureCandidate = (cell: MaterialCell): boolean => {
    const candidates = candidatesByCellKey.get(cell.key) ?? [];
    return candidates.some((candidate) => tileCanFit(cell, candidate));
  };

  const chooseNextCell = (): MaterialCell | null => {
    const unassignedCells = component.filter((cell) => !assignments.has(cell.key));
    if (unassignedCells.length === 0) {
      return null;
    }

    return unassignedCells
      .map((cell) => ({
        cell,
        candidateCount: (candidatesByCellKey.get(cell.key) ?? []).filter((candidate) =>
          tileCanFit(cell, candidate),
        ).length,
      }))
      .sort(
        (left, right) =>
          left.candidateCount - right.candidateCount ||
          left.cell.y - right.cell.y ||
          left.cell.x - right.cell.x,
      )[0].cell;
  };

  const solve = (): boolean => {
    const cell = chooseNextCell();
    if (!cell) {
      return true;
    }

    const candidates = candidatesByCellKey.get(cell.key) ?? [];
    for (const candidate of candidates) {
      if (!tileCanFit(cell, candidate)) {
        continue;
      }

      assignments.set(cell.key, candidate);
      const canStillSolve = component
        .filter((futureCell) => !assignments.has(futureCell.key))
        .every(hasFutureCandidate);
      if (canStillSolve && solve()) {
        return true;
      }
      assignments.delete(cell.key);
    }

    return false;
  };

  if (solve()) {
    return assignments;
  }

  return new Map(
    component.flatMap((cell) => {
      const [fallback] = candidatesByCellKey.get(cell.key) ?? [];
      return fallback ? [[cell.key, fallback] as const] : [];
    }),
  );
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
  const cells = Object.entries(materialPlacements[layerId] ?? {})
    .map(([key, material]) => parseMaterialPlacementCell(key, material))
    .filter((cell): cell is MaterialCell => Boolean(cell));
  const materialCellKeys = new Set(cells.map((cell) => cell.key));
  const candidatesByCellKey = new Map(
    cells.map((cell) => [
      cell.key,
      editorTileset.tiles.filter(
        (tile) =>
          tile.material === cell.material &&
          tileMatchesDefaultBorders(tile, editorTileset, materialCellKeys, cell),
      ),
    ]),
  );

  return getConnectedMaterialComponents(cells).reduce((assignments, component) => {
    const componentAssignments = solveMaterialComponent(component, candidatesByCellKey);
    for (const [key, tile] of componentAssignments) {
      assignments.set(key, tile);
    }
    return assignments;
  }, new Map<string, EditorTilesetTileDefinition>());
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

function applyResolvedMaterialTiles(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  layerId: string,
): RawShipInteriorLevel {
  const assignments = resolveMaterialTilesForLayer(level, layerId, materialPlacements);

  return Array.from(assignments.entries()).reduce((nextLevel, [key, tile]) => {
    const materialCell = parseMaterialPlacementCell(key, tile.material ?? '');
    return materialCell
      ? paintConcreteTile(nextLevel, layerId, tile.id, materialCell.x, materialCell.y)
      : nextLevel;
  }, level);
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
