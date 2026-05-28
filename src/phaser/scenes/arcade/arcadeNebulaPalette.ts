import type { SpaceNebulaPalette } from '../../world/SpaceBackgroundRenderer';

const ARCADE_NEBULA_PALETTES: SpaceNebulaPalette[] = [
  {
    base: { r: 0.045, g: 0.12, b: 0.32 },
    secondary: { r: 0.13, g: 0.075, b: 0.24 },
    accent: { r: 0.08, g: 0.28, b: 0.38 },
    thread: { r: 0.08, g: 0.28, b: 0.38 },
  },
  {
    base: { r: 0.035, g: 0.1, b: 0.22 },
    secondary: { r: 0.06, g: 0.2, b: 0.18 },
    accent: { r: 0.12, g: 0.34, b: 0.26 },
    thread: { r: 0.18, g: 0.42, b: 0.34 },
  },
  {
    base: { r: 0.085, g: 0.045, b: 0.18 },
    secondary: { r: 0.18, g: 0.055, b: 0.22 },
    accent: { r: 0.26, g: 0.1, b: 0.3 },
    thread: { r: 0.32, g: 0.16, b: 0.36 },
  },
  {
    base: { r: 0.09, g: 0.055, b: 0.04 },
    secondary: { r: 0.19, g: 0.095, b: 0.045 },
    accent: { r: 0.3, g: 0.18, b: 0.07 },
    thread: { r: 0.34, g: 0.24, b: 0.12 },
  },
  {
    base: { r: 0.035, g: 0.07, b: 0.16 },
    secondary: { r: 0.075, g: 0.14, b: 0.27 },
    accent: { r: 0.11, g: 0.2, b: 0.42 },
    thread: { r: 0.18, g: 0.28, b: 0.48 },
  },
];

export function getArcadeNebulaPalette(burstCount: number): SpaceNebulaPalette {
  const index = positiveModulo(Math.floor(burstCount) - 1, ARCADE_NEBULA_PALETTES.length);
  return ARCADE_NEBULA_PALETTES[index];
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
