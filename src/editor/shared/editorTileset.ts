import type {
  ShipInteriorTilesetDefinition,
  ShipInteriorTilesetTileDefinition,
} from '../../scenes/ShipInteriorScene/level';
import {
  cloneTileTopology,
  normalizeTileTopologyRelation,
  topologyDirections,
  type TileTopology,
} from './autotile';

export type EditorTilesetTileDefinition = ShipInteriorTilesetTileDefinition & {
  material?: string;
  topology?: TileTopology;
  variantGroup?: string;
  variantWeight?: number;
};

export type EditorTilesetDefinition = Omit<ShipInteriorTilesetDefinition, 'tiles'> & {
  materials?: string[];
  tiles: EditorTilesetTileDefinition[];
};

export function normalizeEditorTilesetMaterials(
  value: unknown,
  label: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array when provided.`);
  }

  const materialNames = Array.from(
    new Set(
      value
        .map((materialName, index) => {
          if (typeof materialName !== 'string') {
            throw new Error(`${label}[${index}] must be a string.`);
          }

          return materialName.trim();
        })
        .filter(Boolean),
    ),
  );

  return materialNames.length > 0 ? materialNames : undefined;
}

export function normalizeTileTopology(value: unknown, label: string): TileTopology | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object when provided.`);
  }

  const topology = value as Record<string, unknown>;
  const nextTopology: TileTopology = {};
  for (const direction of topologyDirections) {
    const relation = normalizeTileTopologyRelation(topology[direction]);
    if (relation && relation !== 'any') {
      nextTopology[direction] = relation;
    }
  }

  return nextTopology;
}

export function cloneEditorTilesetTile(
  tile: EditorTilesetTileDefinition,
): EditorTilesetTileDefinition {
  return {
    id: tile.id,
    ...(tile.material ? { material: tile.material } : {}),
    position: [...tile.position],
    ...(tile.topology ? { topology: cloneTileTopology(tile.topology) } : {}),
    ...(tile.variantGroup ? { variantGroup: tile.variantGroup } : {}),
    ...(tile.variantWeight !== undefined ? { variantWeight: tile.variantWeight } : {}),
  };
}

export function cloneEditorTileset(tileset: EditorTilesetDefinition): EditorTilesetDefinition {
  return {
    id: tileset.id,
    imageSrc: tileset.imageSrc,
    grid: { ...tileset.grid },
    ...(tileset.materials ? { materials: [...tileset.materials] } : {}),
    tiles: tileset.tiles.map(cloneEditorTilesetTile),
  };
}
