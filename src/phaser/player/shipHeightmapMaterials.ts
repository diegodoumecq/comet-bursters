export type PlayerShipMaterial =
  | 'beacon'
  | 'canopy'
  | 'engine'
  | 'hull'
  | 'shadow'
  | 'turretBase'
  | 'wing';

export const PLAYER_SHIP_MATERIAL_DEBUG_COLORS: Record<
  PlayerShipMaterial,
  [number, number, number]
> = {
  beacon: [252, 244, 178],
  canopy: [86, 198, 232],
  engine: [237, 129, 63],
  hull: [177, 190, 211],
  shadow: [35, 44, 63],
  turretBase: [150, 172, 202],
  wing: [138, 151, 170],
};
