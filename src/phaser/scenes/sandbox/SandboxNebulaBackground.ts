import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';
import { createSandboxNebulaTexture, SANDBOX_NEBULA_TEXTURE_SIZE } from './sandboxNebulaTexture';

const NEBULA_DEPTH = -120;
const TEXTURE_KEY_PREFIX = 'sandbox-nebula-background';
const BASE_WRAP_CYCLES = 32;

type NebulaLayerConfig = {
  alpha: number;
  cyclesX: number;
  cyclesY: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  tint: number;
};

const LAYERS: NebulaLayerConfig[] = [
  {
    alpha: 0.55,
    cyclesX: BASE_WRAP_CYCLES,
    cyclesY: BASE_WRAP_CYCLES,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    tint: 0x9ab8ff,
  },
  {
    alpha: 0.32,
    cyclesX: BASE_WRAP_CYCLES / 2,
    cyclesY: BASE_WRAP_CYCLES / 2,
    offsetX: 431,
    offsetY: 173,
    scale: 2,
    tint: 0x8ff2ff,
  },
  {
    alpha: 0.2,
    cyclesX: BASE_WRAP_CYCLES / 4,
    cyclesY: BASE_WRAP_CYCLES / 4,
    offsetX: 947,
    offsetY: 661,
    scale: 4,
    tint: 0xd1a6ff,
  },
];

export class SandboxNebulaBackground {
  private readonly layers: Phaser.GameObjects.TileSprite[];
  private readonly textureKey = `${TEXTURE_KEY_PREFIX}-${Phaser.Math.RND.uuid()}`;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    createSandboxNebulaTexture(scene, this.textureKey);
    this.layers = LAYERS.map((layer, index) =>
      scene.add
        .tileSprite(0, 0, scene.scale.width, scene.scale.height, this.textureKey)
        .setName(`sandbox-nebula-background-layer-${index}`)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(NEBULA_DEPTH + index)
        .setAlpha(layer.alpha)
        .setTint(layer.tint)
        .setTileScale(layer.scale, layer.scale)
        .setVisible(false),
    );
  }

  render(camera: Phaser.Cameras.Scene2D.Camera, world: WorldSize, visible: boolean): void {
    if (!visible) {
      this.setVisible(false);
      return;
    }

    this.setVisible(true);
    const cameraX = positiveModulo(camera.worldView.x, world.width);
    const cameraY = positiveModulo(camera.worldView.y, world.height);
    for (let index = 0; index < this.layers.length; index += 1) {
      const layer = this.layers[index];
      const config = LAYERS[index];
      layer.setSize(this.scene.scale.width, this.scene.scale.height);
      layer.tilePositionX = getTilePosition(cameraX, world.width, config.cyclesX, config.offsetX);
      layer.tilePositionY = getTilePosition(cameraY, world.height, config.cyclesY, config.offsetY);
    }
  }

  destroy(): void {
    for (const layer of this.layers) layer.destroy();
    if (this.scene.textures.exists(this.textureKey)) this.scene.textures.remove(this.textureKey);
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const layer of this.layers) layer.setVisible(visible);
  }
}

function getTilePosition(
  camera: number,
  worldSize: number,
  cycles: number,
  offset: number,
): number {
  if (worldSize <= 0) return offset;
  return positiveModulo(
    (camera / worldSize) * SANDBOX_NEBULA_TEXTURE_SIZE * cycles + offset,
    SANDBOX_NEBULA_TEXTURE_SIZE,
  );
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
