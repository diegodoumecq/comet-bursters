import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';
import type { SandboxBiomeRegion } from './biomeGeneration';
import type { NebulaRegionColor } from './nebulaRegions';

const BIOME_DEBUG_DEPTH = 29;
const WRAP_OFFSETS = [-1, 0, 1] as const;

export class SandboxBiomeDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add
      .graphics()
      .setName('sandbox-biome-debug-overlay')
      .setDepth(BIOME_DEBUG_DEPTH)
      .setScrollFactor(1);
  }

  render(input: {
    biomes: SandboxBiomeRegion[];
    camera: Phaser.Cameras.Scene2D.Camera;
    enabled: boolean;
    world: WorldSize;
  }): void {
    this.graphics.clear();
    this.graphics.setVisible(input.enabled);
    if (!input.enabled) return;

    const generatedBiomes = input.biomes.filter((biome) => biome.source === 'generated');
    for (const biome of generatedBiomes) {
      this.graphics.lineStyle(2, rgbToNumber(biome.profile.color), 0.82);
      this.drawWrappedBiome(biome, input.world, input.camera);
    }
  }

  private drawWrappedBiome(
    biome: SandboxBiomeRegion,
    world: WorldSize,
    camera: Phaser.Cameras.Scene2D.Camera,
  ): void {
    for (const offsetX of WRAP_OFFSETS) {
      for (const offsetY of WRAP_OFFSETS) {
        const x = offsetX * world.width;
        const y = offsetY * world.height;
        if (biomeVisibleInCamera(biome, x, y, camera)) this.drawBiome(biome, x, y);
      }
    }
  }

  private drawBiome(biome: SandboxBiomeRegion, offsetX: number, offsetY: number): void {
    const [firstPoint] = biome.points;
    this.graphics.beginPath();
    this.graphics.moveTo(firstPoint.x + offsetX, firstPoint.y + offsetY);
    for (let index = 1; index < biome.points.length; index += 1) {
      const point = biome.points[index];
      this.graphics.lineTo(point.x + offsetX, point.y + offsetY);
    }
    this.graphics.closePath();
    this.graphics.strokePath();
  }
}

function biomeVisibleInCamera(
  biome: SandboxBiomeRegion,
  offsetX: number,
  offsetY: number,
  camera: Phaser.Cameras.Scene2D.Camera,
): boolean {
  const bounds = biome.points.reduce(
    (current, point) => ({
      maxX: Math.max(current.maxX, point.x + offsetX),
      maxY: Math.max(current.maxY, point.y + offsetY),
      minX: Math.min(current.minX, point.x + offsetX),
      minY: Math.min(current.minY, point.y + offsetY),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
    },
  );
  return (
    bounds.maxX >= camera.worldView.x &&
    bounds.minX <= camera.worldView.x + camera.worldView.width &&
    bounds.maxY >= camera.worldView.y &&
    bounds.minY <= camera.worldView.y + camera.worldView.height
  );
}

function rgbToNumber(color: NebulaRegionColor): number {
  const r = Phaser.Math.Clamp(Math.round(color.r * 255), 0, 255);
  const g = Phaser.Math.Clamp(Math.round(color.g * 255), 0, 255);
  const b = Phaser.Math.Clamp(Math.round(color.b * 255), 0, 255);
  return (r << 16) | (g << 8) | b;
}
