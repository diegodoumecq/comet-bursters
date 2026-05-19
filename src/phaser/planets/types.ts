import type { Vector } from '../core/types';

export type PlanetKind = 'lush' | 'desert' | 'ice' | 'lava' | 'gas' | 'toxic' | 'crystal';

export type PlanetEntity = {
  color: number;
  colorHex: string;
  gravityStrength: number;
  id: number;
  kind: PlanetKind;
  altitudeVariations: number[];
  position: Vector;
  radius: number;
  rotation: number;
  rotationSpeed: number;
};

export type PlanetSpriteSource = {
  altitudeVariations: number[];
  color: string;
  getRadius: () => number;
  kind: PlanetKind;
  rotation: number;
  x: number;
  y: number;
};
