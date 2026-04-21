const tileAssetModules = import.meta.glob('../../assets/tiles/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export type ShipInteriorTileAssetEntry = {
  fileName: string;
  imageSrc: string;
  url: string;
};

export const shipInteriorTileAssets: ShipInteriorTileAssetEntry[] = Object.entries(
  tileAssetModules,
)
  .map(([assetPath, url]) => {
    const fileName = assetPath.split('/').pop() ?? assetPath;
    return {
      fileName,
      imageSrc: `../tiles/${fileName}`,
      url,
    };
  })
  .sort((left, right) => left.fileName.localeCompare(right.fileName));

export function resolveShipInteriorTileAssetUrl(path: string): string | null {
  return shipInteriorTileAssets.find((asset) => asset.imageSrc === path)?.url ?? null;
}
