const tileAssetModules = import.meta.glob('../../assets/tiles/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const generalAssetModules = import.meta.glob('../../assets/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export type ShipInteriorTileAssetEntry = {
  fileName: string;
  imageSrc: string;
  levelImageSrc: string;
  url: string;
};

export const shipInteriorTileAssets: ShipInteriorTileAssetEntry[] = Object.entries(
  tileAssetModules,
)
  .map(([assetPath, url]) => {
    const fileName = assetPath.split('/').pop() ?? assetPath;
    return {
      fileName,
      imageSrc: `./${fileName}`,
      levelImageSrc: `../tiles/${fileName}`,
      url,
    };
  })
  .sort((left, right) => left.fileName.localeCompare(right.fileName));

export function resolveShipInteriorTileAssetUrl(path: string): string | null {
  return (
    shipInteriorTileAssets.find(
      (asset) => asset.imageSrc === path || asset.levelImageSrc === path,
    )?.url ?? null
  );
}

export function resolveShipInteriorAssetUrl(path: string): string | null {
  const tileAssetUrl = resolveShipInteriorTileAssetUrl(path);
  if (tileAssetUrl) {
    return tileAssetUrl;
  }

  const fileName = path.split('/').pop();
  if (!fileName) {
    return null;
  }

  return (
    Object.entries(generalAssetModules).find(([assetPath]) => assetPath.endsWith(`/${fileName}`))?.[1] ??
    null
  );
}
