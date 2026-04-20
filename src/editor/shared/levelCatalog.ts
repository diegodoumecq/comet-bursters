import type { RawShipInteriorLevel } from '../../scenes/ShipInteriorScene/level';

const bundledLevelModules = import.meta.glob('../../assets/levels/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, RawShipInteriorLevel>;

export type BundledLevelEntry = {
  assetPath: string;
  fileName: string;
  level: RawShipInteriorLevel;
};

export const bundledLevels: BundledLevelEntry[] = Object.entries(bundledLevelModules)
  .map(([assetPath, level]) => ({
    assetPath,
    fileName: assetPath.split('/').pop() ?? assetPath,
    level,
  }))
  .sort((left, right) => left.fileName.localeCompare(right.fileName));
