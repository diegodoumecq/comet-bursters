import type { SpriteSheetGridConfig } from '@/spritesheet';

const spriteAssetModules = import.meta.glob('../assets/**/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const tilesetModules = import.meta.glob('../assets/**/*.tileset.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export type SpriteAssetEntry = {
  assetPath: string;
  category: string;
  fileName: string;
  label: string;
  url: string;
};

export type SpriteAssetGridSource = {
  assetPath: string;
  grid: SpriteSheetGridConfig;
  id: string;
  imageSrc: string;
  sourcePath: string;
};

function toAssetRelativePath(modulePath: string): string {
  return modulePath.replace('../assets/', '');
}

function normalizePathSegments(path: string): string {
  const segments = path.split('/');
  const normalizedSegments: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      normalizedSegments.pop();
      continue;
    }
    normalizedSegments.push(segment);
  }
  return normalizedSegments.join('/');
}

function resolveTilesetImageAssetPath(tilesetModulePath: string, imageSrc: string): string {
  const tilesetPath = toAssetRelativePath(tilesetModulePath);
  const tilesetSegments = tilesetPath.split('/');
  tilesetSegments.pop();
  return normalizePathSegments([...tilesetSegments, imageSrc].join('/'));
}

function isGridConfig(value: unknown): value is SpriteSheetGridConfig {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export const spriteAssets: SpriteAssetEntry[] = Object.entries(spriteAssetModules)
  .map(([assetPath, url]) => {
    const relativePath = toAssetRelativePath(assetPath);
    const segments = relativePath.split('/');
    const fileName = segments.at(-1) ?? relativePath;
    const category = segments.length > 1 ? segments.slice(0, -1).join('/') : 'root';
    return {
      assetPath: relativePath,
      category,
      fileName,
      label: relativePath,
      url,
    };
  })
  .sort(
    (left, right) =>
      left.category.localeCompare(right.category) || left.fileName.localeCompare(right.fileName),
  );

export const spriteAssetsByCategory = spriteAssets.reduce(
  (groups, asset) => {
    groups[asset.category] = [...(groups[asset.category] ?? []), asset];
    return groups;
  },
  {} as Record<string, SpriteAssetEntry[]>,
);

export const spriteAssetGridSources: SpriteAssetGridSource[] = Object.entries(tilesetModules)
  .flatMap(([modulePath, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }

    const tileset = value as {
      grid?: unknown;
      id?: unknown;
      imageSrc?: unknown;
    };
    if (
      typeof tileset.id !== 'string' ||
      typeof tileset.imageSrc !== 'string' ||
      !isGridConfig(tileset.grid)
    ) {
      return [];
    }

    return [
      {
        assetPath: resolveTilesetImageAssetPath(modulePath, tileset.imageSrc),
        grid: tileset.grid,
        id: tileset.id,
        imageSrc: tileset.imageSrc,
        sourcePath: toAssetRelativePath(modulePath),
      },
    ];
  })
  .sort(
    (left, right) =>
      left.assetPath.localeCompare(right.assetPath) || left.sourcePath.localeCompare(right.sourcePath),
  );

export function getGridSourcesForSpriteAsset(assetPath: string): SpriteAssetGridSource[] {
  return spriteAssetGridSources.filter((source) => source.assetPath === assetPath);
}
