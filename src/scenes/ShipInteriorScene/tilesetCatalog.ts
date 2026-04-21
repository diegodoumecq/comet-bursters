import type { ShipInteriorTilesetDefinition } from './level';

const bundledTilesetModules = import.meta.glob('../../assets/tiles/*.tileset.json', {
  eager: true,
  import: 'default',
}) as Record<string, ShipInteriorTilesetDefinition>;

export type BundledTilesetEntry = {
  fileName: string;
  tileset: ShipInteriorTilesetDefinition;
};

export const bundledTilesets: BundledTilesetEntry[] = Object.entries(bundledTilesetModules)
  .map(([assetPath, tileset]) => ({
    fileName: assetPath.split('/').pop() ?? assetPath,
    tileset,
  }))
  .sort((left, right) => left.tileset.id.localeCompare(right.tileset.id));

export function getBundledTilesetDefinitions(): ShipInteriorTilesetDefinition[] {
  return bundledTilesets.map((entry) => ({
    ...entry.tileset,
    grid: { ...entry.tileset.grid },
    tiles: { ...entry.tileset.tiles },
  }));
}
