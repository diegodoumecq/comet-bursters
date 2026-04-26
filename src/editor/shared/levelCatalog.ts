import type { RawShipInteriorLevel } from '../../scenes/ShipInteriorScene/level';
import { bundledTilesets } from '../../scenes/ShipInteriorScene/tilesetCatalog';
import type { EditorTilesetDefinition } from './editorTileset';
import {
  cloneMaterialPlacementMap,
  type MaterialPlacementMap,
} from './materials';

const bundledLevelModules = import.meta.glob('../../assets/levels/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

type EditorLevelFile = RawShipInteriorLevel & {
  editor?: {
    materialPlacements?: MaterialPlacementMap;
  };
};

export type BundledLevelEntry = {
  assetPath: string;
  fileName: string;
  level: RawShipInteriorLevel;
  materialPlacements: MaterialPlacementMap;
};

function getTilesetImageFileName(imageSrc: string): string {
  return imageSrc.split('/').pop() ?? imageSrc;
}

function getEditorBundledTilesetDefinitions(): EditorTilesetDefinition[] {
  return bundledTilesets.map((entry) => {
    const tileset = entry.tileset as EditorTilesetDefinition;
    return {
      id: tileset.id,
      imageSrc: tileset.imageSrc,
      grid: { ...tileset.grid },
      ...(tileset.materials ? { materials: [...tileset.materials] } : {}),
      tiles: tileset.tiles.map((tile) => ({
        id: tile.id,
        name: tile.name,
        ...(tile.material ? { material: tile.material } : {}),
        ...(tile.topology ? { topology: { ...tile.topology } } : {}),
        position: [...tile.position],
        ...(tile.variantGroup ? { variantGroup: tile.variantGroup } : {}),
        ...(tile.variantWeight !== undefined ? { variantWeight: tile.variantWeight } : {}),
      })),
    };
  });
}

export function hydrateLevelTilesets(level: RawShipInteriorLevel): RawShipInteriorLevel {
  const maybeTilesets = (level as Partial<RawShipInteriorLevel>).tilesets;
  const bundledTilesets = getEditorBundledTilesetDefinitions();
  const bundledIdByImageFileName = new Map(
    bundledTilesets.map((tileset) => [getTilesetImageFileName(tileset.imageSrc), tileset.id]),
  );
  const bundledTilesetById = new Map(bundledTilesets.map((tileset) => [tileset.id, tileset] as const));
  const legacyTilesetIdMap = new Map(
    (maybeTilesets ?? []).flatMap((tileset) => {
      const bundledId = bundledIdByImageFileName.get(getTilesetImageFileName(tileset.imageSrc));
      return bundledId && bundledId !== tileset.id ? [[tileset.id, bundledId] as const] : [];
    }),
  );

  return {
    ...level,
    layers: level.layers.map((layer) => ({
      ...layer,
      tilesetId: legacyTilesetIdMap.get(layer.tilesetId) ?? layer.tilesetId,
      tiles: layer.tiles.flatMap((tile) => {
        const nextTilesetId = legacyTilesetIdMap.get(layer.tilesetId) ?? layer.tilesetId;
        const bundledTileset = bundledTilesetById.get(nextTilesetId);
        const normalizedTileId =
          typeof tile.tile === 'number'
            ? tile.tile
            : bundledTileset?.tiles.find((candidate) => candidate.name === tile.tile)?.id ?? null;
        return normalizedTileId === null ? [] : [{ ...tile, tile: normalizedTileId }];
      }),
    })),
    tilesets: bundledTilesets,
  };
}

export function getLevelMaterialPlacements(level: unknown): MaterialPlacementMap {
  const maybeEditor = (level as EditorLevelFile | null | undefined)?.editor;
  const maybePlacements = maybeEditor?.materialPlacements;
  if (!maybePlacements || typeof maybePlacements !== 'object') {
    return {};
  }

  return cloneMaterialPlacementMap(maybePlacements);
}

export const bundledLevels: BundledLevelEntry[] = Object.entries(bundledLevelModules)
  .map(([assetPath, level]) => ({
    assetPath,
    fileName: assetPath.split('/').pop() ?? assetPath,
    level: hydrateLevelTilesets(level as RawShipInteriorLevel),
    materialPlacements: getLevelMaterialPlacements(level),
  }))
  .sort((left, right) => left.fileName.localeCompare(right.fileName));
