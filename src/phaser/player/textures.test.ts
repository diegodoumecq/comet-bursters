import { describe, expect, it } from 'vitest';

import type { WeaponKind } from '../weapons/types';
import {
  clonePlayerShipHeightmapConfig,
  PLAYER_SHIP_HEIGHTMAP_CONFIG,
} from './shipHeightmapConfig';
import {
  getPlayerHullTextureBlend,
  getPlayerTurretTextureKey,
  PLAYER_HULL_DISPLAY_SCALE,
  PLAYER_HULL_ROTATION_FRAME_COUNT,
  PLAYER_HULL_TEXTURE_SIZE,
  PLAYER_TURRET_MUZZLE_OFFSET,
  PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
  PLAYER_TURRET_SPRITE_SPECS,
  PLAYER_TURRET_TEXTURE_SIZE,
  samplePlayerHullHeightMap,
  shadePlayerHullSample,
  texturePixelToShipPoint,
} from './textures';

const WEAPONS: WeaponKind[] = [
  'blackHole',
  'fuelGun',
  'inspectionProbe',
  'pusher',
  'shotgun',
  'small',
  'tractor',
];

describe('player textures', () => {
  it('provides a dedicated turret texture key for every weapon', () => {
    const textureKeys = WEAPONS.map((weapon) => getPlayerTurretTextureKey(weapon));

    expect(new Set(textureKeys).size).toBe(WEAPONS.length);
  });

  it('standardizes every turret sprite to the same size, orientation, and length', () => {
    for (const weapon of WEAPONS) {
      expect(PLAYER_TURRET_SPRITE_SPECS[weapon]).toEqual({
        length: PLAYER_TURRET_MUZZLE_OFFSET,
        orientationRadians: PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
        textureKey: getPlayerTurretTextureKey(weapon),
        textureSize: PLAYER_TURRET_TEXTURE_SIZE,
      });
    }
  });

  it('provides adjacent hull atlas frames for crossfaded rotation rendering', () => {
    const blend = getPlayerHullTextureBlend(Math.PI / PLAYER_HULL_ROTATION_FRAME_COUNT);

    expect(blend.current.frameKey).toBe('phaser-ship-hull-frame-0');
    expect(blend.next.frameKey).toBe('phaser-ship-hull-frame-1');
    expect(blend.nextAlpha).toBeGreaterThan(0);
    expect(blend.nextAlpha).toBeLessThan(1);
  });

  it('uses most of the hull texture while preserving the displayed ship size', () => {
    let minX = PLAYER_HULL_TEXTURE_SIZE;
    let minY = PLAYER_HULL_TEXTURE_SIZE;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < PLAYER_HULL_TEXTURE_SIZE; y += 1) {
      for (let x = 0; x < PLAYER_HULL_TEXTURE_SIZE; x += 1) {
        const sample = samplePlayerHullHeightMap(texturePixelToShipPoint(x, y));
        if (sample.alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const occupiedWidth = maxX - minX + 1;
    const occupiedHeight = maxY - minY + 1;

    expect(occupiedWidth).toBeGreaterThan(180);
    expect(occupiedHeight).toBeGreaterThan(110);
    expect(occupiedWidth * PLAYER_HULL_DISPLAY_SCALE).toBeGreaterThan(58);
    expect(occupiedWidth * PLAYER_HULL_DISPLAY_SCALE).toBeLessThan(62);
  });

  it('defines a bird-like ship heightmap with wings, canopy, and empty exterior', () => {
    const canopy = samplePlayerHullHeightMap({ x: 0.36, y: 0 });
    const turretBase = samplePlayerHullHeightMap({ x: 0.03, y: 0 });
    const topWing = samplePlayerHullHeightMap({ x: -0.44, y: -0.29 });
    const bottomWing = samplePlayerHullHeightMap({ x: -0.44, y: 0.29 });
    const outside = samplePlayerHullHeightMap({ x: 0.08, y: -0.86 });

    expect(canopy.material).toBe('canopy');
    expect(turretBase.material).toBe('turretBase');
    expect(turretBase.height).toBeGreaterThan(canopy.height);
    expect(canopy.height).toBeGreaterThan(topWing.height);
    expect(topWing.alpha).toBeGreaterThan(0);
    expect(bottomWing.alpha).toBeGreaterThan(0);
    expect(topWing.height).toBe(bottomWing.height);
    expect(outside.alpha).toBe(0);
  });

  it('uses the editable ship heightmap config for turret base sampling', () => {
    const config = clonePlayerShipHeightmapConfig(PLAYER_SHIP_HEIGHTMAP_CONFIG);
    config.turretBase.center.x = -0.24;
    config.turretBase.center.y = 0.18;
    config.turretBase.core.baseHeight = 0.95;
    config.turretBase.core.height = 0.04;
    config.turretBase.core.radiusX = 0.08;
    config.turretBase.core.radiusY = 0.07;
    config.turretBase.plate.radiusX = 0.18;
    config.turretBase.plate.radiusY = 0.12;

    const defaultCenter = samplePlayerHullHeightMap({ x: 0.03, y: 0 }, config);
    const editedCenter = samplePlayerHullHeightMap({ x: -0.24, y: 0.18 }, config);

    expect(defaultCenter.material).not.toBe('turretBase');
    expect(editedCenter.material).toBe('turretBase');
    expect(editedCenter.height).toBeGreaterThan(0.9);
  });

  it('shades heightmap samples with the final ship palette instead of material debug colors', () => {
    const point = { x: 0.36, y: 0 };
    const sample = samplePlayerHullHeightMap(point);
    const color = shadePlayerHullSample(point, sample, { x: -0.58, y: -0.82 });

    expect(sample.material).toBe('canopy');
    expect(color).not.toEqual({ r: 86, g: 198, b: 232 });
  });
});
