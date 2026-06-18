import rawShipHeightmapConfig from '../../assets/player/shipHeightmap.json';

export type PlayerShipHeightmapPoint = {
  x: number;
  y: number;
};

export type PlayerShipHeightmapDomeConfig = {
  baseHeight: number;
  height: number;
  radiusX: number;
  radiusY: number;
};

export type PlayerShipHeightmapConfig = {
  beacon: PlayerShipHeightmapDomeConfig & {
    center: PlayerShipHeightmapPoint;
  };
  body: PlayerShipHeightmapDomeConfig & {
    center: PlayerShipHeightmapPoint;
  };
  canopy: PlayerShipHeightmapDomeConfig & {
    center: PlayerShipHeightmapPoint;
    maxX: number;
    minX: number;
  };
  edge: {
    alphaFade: number;
    baseHeight: number;
    edgeFade: number;
    edgeLift: number;
  };
  formatVersion: 1;
  nose: PlayerShipHeightmapDomeConfig & {
    center: PlayerShipHeightmapPoint;
  };
  tail: {
    height: number;
  };
  turretBase: {
    center: PlayerShipHeightmapPoint;
    core: PlayerShipHeightmapDomeConfig;
    plate: PlayerShipHeightmapDomeConfig;
  };
  vent: {
    halfHeight: number;
    height: number;
    maxX: number;
    minX: number;
  };
  wing: {
    baseHeight: number;
    ridgeInnerDistance: number;
    ridgeLift: number;
    ridgeOuterDistance: number;
  };
};

export const PLAYER_SHIP_HEIGHTMAP_FILE_NAME = 'shipHeightmap.json';

export const PLAYER_SHIP_HEIGHTMAP_CONFIG =
  rawShipHeightmapConfig as PlayerShipHeightmapConfig;

export function clonePlayerShipHeightmapConfig(
  config: PlayerShipHeightmapConfig,
): PlayerShipHeightmapConfig {
  return structuredClone(config);
}

export function getPlayerShipHeightmapConfigVersion(config: PlayerShipHeightmapConfig): string {
  return JSON.stringify(config);
}
