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
      { x: 1200, y: 2400 },
      { x: 3600, y: 1400 },
      { x: 6800, y: 2800 },
      { x: 7600, y: 5600 },
      { x: 5200, y: 7200 },
      { x: 1900, y: 6100 },
    ],
  },
  {
    alpha: 0.9,
    effects: [],
    featherPx: 320,
    id: 'northern-shelf',
    points: [
      { x: 9400, y: 2200 },
      { x: 12400, y: 1100 },
      { x: 15400, y: 2700 },
      { x: 16100, y: 5700 },
      { x: 13200, y: 7200 },
      { x: 10100, y: 6100 },
    ],
  },
  {
    alpha: 0.98,
    effects: [],
    featherPx: 320,
    id: 'southern-drift',
    points: [
      { x: 6800, y: 12400 },
      { x: 10000, y: 10400 },
      { x: 13000, y: 11800 },
      { x: 13800, y: 15200 },
      { x: 10800, y: 17400 },
      { x: 7600, y: 16000 },
    ],
  },
  {
    alpha: 0.92,
    effects: [],
    featherPx: 320,
    id: 'central-rift',
    points: [
      { x: 19000, y: 16600 },
      { x: 22400, y: 15000 },
      { x: 26200, y: 16800 },
      { x: 27000, y: 20200 },
      { x: 23800, y: 22500 },
      { x: 19800, y: 21000 },
    ],
  },
  {
    alpha: 0.96,
    effects: [],
    featherPx: 320,
    id: 'eastern-crown',
    points: [
      { x: 30000, y: 4600 },
      { x: 33800, y: 3200 },
      { x: 37600, y: 4800 },
      { x: 38500, y: 8200 },
      { x: 35200, y: 10300 },
      { x: 31200, y: 9100 },
    ],
  },
  {
    alpha: 0.93,
    effects: [],
    featherPx: 320,
    id: 'deep-east-drift',
    points: [
      { x: 38800, y: 17600 },
      { x: 42400, y: 16000 },
      { x: 45600, y: 18200 },
      { x: 46200, y: 22000 },
      { x: 43000, y: 24000 },
      { x: 39600, y: 22200 },
    ],
  },
  {
    alpha: 0.91,
    effects: [],
    featherPx: 320,
    id: 'southwestern-haze',
    points: [
      { x: 2200, y: 32200 },
      { x: 5600, y: 30000 },
      { x: 8900, y: 31600 },
      { x: 9600, y: 35600 },
      { x: 6500, y: 39000 },
      { x: 3000, y: 37400 },
    ],
  },
  {
    alpha: 0.97,
    effects: [],
    featherPx: 320,
    id: 'far-southern-bloom',
    points: [
      { x: 33000, y: 31400 },
      { x: 37400, y: 30000 },
      { x: 41800, y: 32600 },
      { x: 43000, y: 36600 },
      { x: 38800, y: 39000 },
      { x: 34400, y: 37400 },
    ],
  },
];
