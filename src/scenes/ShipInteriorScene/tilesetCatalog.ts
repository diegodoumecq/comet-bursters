import type { ShipInteriorTilesetDefinition } from './level';

const bundledTilesetModules = import.meta.glob('../../assets/tiles/*.tileset.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export type BundledTilesetEntry = {
  fileName: string;
  tileset: unknown;
};

export const bundledTilesets: BundledTilesetEntry[] = Object.entries(bundledTilesetModules)
  .map(([assetPath, tileset]) => ({
    fileName: assetPath.split('/').pop() ?? assetPath,
    tileset,
  }))
  .sort((left, right) =>
    (left.tileset as ShipInteriorTilesetDefinition).id.localeCompare(
      (right.tileset as ShipInteriorTilesetDefinition).id,
    ),
  );

export function getBundledTilesetDefinitions(): ShipInteriorTilesetDefinition[] {
  return bundledTilesets.map((entry) => ({
    id: (entry.tileset as ShipInteriorTilesetDefinition).id,
    imageSrc: (entry.tileset as ShipInteriorTilesetDefinition).imageSrc,
    grid: { ...(entry.tileset as ShipInteriorTilesetDefinition).grid },
    tiles: (entry.tileset as ShipInteriorTilesetDefinition).tiles.map((tile) => ({
      id: tile.id,
      position: [...tile.position],
    })),
  }));
}
