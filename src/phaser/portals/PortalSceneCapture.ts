import Phaser from 'phaser';

import type { WorldSize } from '../core/types';

const CAPTURE_EXCLUDE_KEY = 'portalCaptureExclude';
let nextCaptureId = 0;

export class PortalSceneCapture {
  private readonly textureKey = `portal-scene-capture-${nextCaptureId++}`;
  private renderTexture: Phaser.GameObjects.RenderTexture;

  constructor(
    private readonly scene: Phaser.Scene,
    world: WorldSize,
  ) {
    this.renderTexture = scene.add
      .renderTexture(-100000, -100000, world.width, world.height)
      .setVisible(false);
    markPortalCaptureExcluded(this.renderTexture);
    this.renderTexture.saveTexture(this.textureKey);
  }

  capture(): string {
    this.renderTexture.clear();
    this.renderTexture.draw(this.getCaptureEntries());
    return this.textureKey;
  }

  resize(world: WorldSize): void {
    this.renderTexture.resize(world.width, world.height);
  }

  destroy(): void {
    this.renderTexture.destroy();
    this.scene.textures.remove(this.textureKey);
  }

  private getCaptureEntries(): Phaser.GameObjects.GameObject[] {
    return this.scene.children
      .getChildren()
      .filter(
        (entry): entry is Phaser.GameObjects.GameObject =>
          entry instanceof Phaser.GameObjects.GameObject &&
          entry !== this.renderTexture &&
          (entry as Phaser.GameObjects.GameObject & { visible?: boolean }).visible !== false &&
          entry.getData(CAPTURE_EXCLUDE_KEY) !== true,
      );
  }
}

export function markPortalCaptureExcluded(gameObject: Phaser.GameObjects.GameObject): void {
  gameObject.setData(CAPTURE_EXCLUDE_KEY, true);
}
