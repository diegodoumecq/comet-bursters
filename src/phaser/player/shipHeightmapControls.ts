import type { PlayerShipMaterial } from './shipHeightmapMaterials';

export type PlayerShipHeightmapControl = {
  label: string;
  max: number;
  min: number;
  path: readonly string[];
  step: number;
};

export type PlayerShipHeightmapControlSection = {
  controls: readonly PlayerShipHeightmapControl[];
  materials: readonly PlayerShipMaterial[];
  title: string;
};

export const PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS: readonly PlayerShipHeightmapControlSection[] = [
  {
    title: 'Hull Mass',
    materials: ['hull'],
    controls: [
      { label: 'Edge Base', path: ['edge', 'baseHeight'], min: 0, max: 0.5, step: 0.01 },
      { label: 'Edge Lift', path: ['edge', 'edgeLift'], min: 0, max: 0.4, step: 0.01 },
      { label: 'Edge Fade', path: ['edge', 'edgeFade'], min: 0.04, max: 0.45, step: 0.01 },
      { label: 'Body X', path: ['body', 'center', 'x'], min: -0.2, max: 0.35, step: 0.01 },
      { label: 'Body Width', path: ['body', 'radiusX'], min: 0.35, max: 1.2, step: 0.01 },
      { label: 'Body Height', path: ['body', 'radiusY'], min: 0.08, max: 0.45, step: 0.01 },
      { label: 'Body Base', path: ['body', 'baseHeight'], min: 0, max: 0.8, step: 0.01 },
      { label: 'Body Lift', path: ['body', 'height'], min: 0, max: 1, step: 0.01 },
      { label: 'Nose X', path: ['nose', 'center', 'x'], min: 0.25, max: 0.85, step: 0.01 },
      { label: 'Nose Length', path: ['nose', 'radiusX'], min: 0.12, max: 0.7, step: 0.01 },
      { label: 'Nose Width', path: ['nose', 'radiusY'], min: 0.04, max: 0.28, step: 0.01 },
      { label: 'Nose Lift', path: ['nose', 'height'], min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Canopy',
    materials: ['canopy'],
    controls: [
      { label: 'Canopy X', path: ['canopy', 'center', 'x'], min: -0.1, max: 0.48, step: 0.01 },
      { label: 'Canopy Width', path: ['canopy', 'radiusX'], min: 0.08, max: 0.52, step: 0.01 },
      { label: 'Canopy Height', path: ['canopy', 'radiusY'], min: 0.04, max: 0.3, step: 0.01 },
      { label: 'Canopy Base', path: ['canopy', 'baseHeight'], min: 0, max: 1, step: 0.01 },
      { label: 'Canopy Lift', path: ['canopy', 'height'], min: 0, max: 0.7, step: 0.01 },
    ],
  },
  {
    title: 'Wings And Cuts',
    materials: ['wing', 'engine', 'shadow'],
    controls: [
      { label: 'Wing Base', path: ['wing', 'baseHeight'], min: 0, max: 0.6, step: 0.01 },
      { label: 'Wing Ridge', path: ['wing', 'ridgeLift'], min: 0, max: 0.7, step: 0.01 },
      {
        label: 'Ridge Outer',
        path: ['wing', 'ridgeOuterDistance'],
        min: 0.08,
        max: 0.55,
        step: 0.01,
      },
      {
        label: 'Ridge Inner',
        path: ['wing', 'ridgeInnerDistance'],
        min: 0.01,
        max: 0.18,
        step: 0.01,
      },
      { label: 'Tail Height', path: ['tail', 'height'], min: 0, max: 0.8, step: 0.01 },
      { label: 'Vent Max X', path: ['vent', 'maxX'], min: -0.6, max: -0.15, step: 0.01 },
      { label: 'Vent Width', path: ['vent', 'halfHeight'], min: 0.02, max: 0.28, step: 0.01 },
      { label: 'Vent Height', path: ['vent', 'height'], min: 0, max: 0.5, step: 0.01 },
    ],
  },
  {
    title: 'Details',
    materials: ['beacon', 'turretBase'],
    controls: [
      { label: 'Beacon X', path: ['beacon', 'center', 'x'], min: 0.5, max: 0.9, step: 0.01 },
      { label: 'Beacon Width', path: ['beacon', 'radiusX'], min: 0.02, max: 0.16, step: 0.005 },
      { label: 'Beacon Height', path: ['beacon', 'radiusY'], min: 0.02, max: 0.14, step: 0.005 },
      { label: 'Beacon Lift', path: ['beacon', 'height'], min: 0, max: 0.4, step: 0.01 },
      { label: 'Mount X', path: ['turretBase', 'center', 'x'], min: -0.5, max: 0.5, step: 0.01 },
      { label: 'Mount Y', path: ['turretBase', 'center', 'y'], min: -0.4, max: 0.4, step: 0.01 },
      { label: 'Plate Width', path: ['turretBase', 'plate', 'radiusX'], min: 0.04, max: 0.5, step: 0.01 },
      { label: 'Plate Height', path: ['turretBase', 'plate', 'radiusY'], min: 0.04, max: 0.4, step: 0.01 },
      { label: 'Plate Base', path: ['turretBase', 'plate', 'baseHeight'], min: 0, max: 1, step: 0.01 },
      { label: 'Plate Lift', path: ['turretBase', 'plate', 'height'], min: 0, max: 0.6, step: 0.01 },
      { label: 'Core Width', path: ['turretBase', 'core', 'radiusX'], min: 0.03, max: 0.4, step: 0.01 },
      { label: 'Core Height', path: ['turretBase', 'core', 'radiusY'], min: 0.03, max: 0.3, step: 0.01 },
      { label: 'Core Base', path: ['turretBase', 'core', 'baseHeight'], min: 0, max: 1, step: 0.01 },
      { label: 'Core Lift', path: ['turretBase', 'core', 'height'], min: 0, max: 0.6, step: 0.01 },
    ],
  },
];
