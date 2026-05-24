import type { Vector } from '../../core/types';

export type NebulaRegionEffect = 'fuelReplenish' | 'fuelAbsorb' | 'damage';

export type NebulaRegion = {
  alpha: number;
  effects: NebulaRegionEffect[];
  featherPx: number;
  id: string;
  points: Vector[];
};

export const SANDBOX_NEBULA_REGIONS: NebulaRegion[] = [
  {
    alpha: 0.95,
    effects: [],
    featherPx: 320,
    id: 'western-veil',
    points: [
      { x: 960, y: 1960 },
      { x: 2780, y: 1160 },
      { x: 4860, y: 2140 },
      { x: 5420, y: 4320 },
      { x: 3560, y: 5480 },
      { x: 1440, y: 4680 },
    ],
  },
  {
    alpha: 0.9,
    effects: [],
    featherPx: 320,
    id: 'northern-shelf',
    points: [
      { x: 6180, y: 760 },
      { x: 8860, y: 580 },
      { x: 10380, y: 2360 },
      { x: 9620, y: 4180 },
      { x: 7260, y: 3820 },
      { x: 5740, y: 2140 },
    ],
  },
  {
    alpha: 0.98,
    effects: [],
    featherPx: 320,
    id: 'southern-drift',
    points: [
      { x: 7280, y: 7140 },
      { x: 10120, y: 6500 },
      { x: 11480, y: 8400 },
      { x: 10620, y: 10960 },
      { x: 8120, y: 11440 },
      { x: 6340, y: 9340 },
    ],
  },
];
