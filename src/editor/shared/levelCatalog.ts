import type { RawShipInteriorLevel } from '../../scenes/ShipInteriorScene/level';
import { bundledTilesets } from '../../scenes/ShipInteriorScene/tilesetCatalog';
import type { EditorTilesetDefinition } from './editorTileset';

const bundledLevelModules = import.meta.glob('../../assets/levels/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, RawShipInteriorLevel>;

export type BundledLevelEntry = {
  assetPath: string;
  fileName: string;
  level: RawShipInteriorLevel;
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
    })),
    tilesets: bundledTilesets,
  };
}

export const bundledLevels: BundledLevelEntry[] = Object.entries(bundledLevelModules)
  .map(([assetPath, level]) => ({
    assetPath,
    fileName: assetPath.split('/').pop() ?? assetPath,
    level: hydrateLevelTilesets(level),
  }))
  .sort((left, right) => left.fileName.localeCompare(right.fileName));
