import Phaser from 'phaser';

import type { WorldSize } from '../core/types';

const CAPTURE_EXCLUDE_KEY = 'portalCaptureExclude';
let nextCaptureId = 0;

export class PortalSceneCapture {
  private readonly textureKey = `portal-scene-capture-${nextCaptureId++}`;
  private readonly backgroundTextureKey = `portal-scene-capture-background-${nextCaptureId++}`;
  private readonly backgroundCopyCanvas = document.createElement('canvas');
  private captureSize: WorldSize;
  private renderTexture: Phaser.GameObjects.RenderTexture;

  constructor(
    private readonly scene: Phaser.Scene,
    world: WorldSize,
    private readonly getBackgroundCanvases: () => HTMLCanvasElement[] = () => [],
    private readonly getOverlayCanvases: () => HTMLCanvasElement[] = () => [],
  ) {
    this.captureSize = { width: world.width, height: world.height };
    this.renderTexture = scene.add
      .renderTexture(-100000, -100000, world.width, world.height)
      .setVisible(false);
    markPortalCaptureExcluded(this.renderTexture);
    this.renderTexture.saveTexture(this.textureKey);
  }

  capture(): string {
    this.renderTexture.clear();
    this.drawBackgroundCanvases();
    this.renderTexture.draw(this.getCaptureEntries());
    this.drawOverlayCanvases();
    return this.textureKey;
  }

  resize(world: WorldSize): void {
    this.captureSize = { width: world.width, height: world.height };
    this.renderTexture.resize(world.width, world.height);
  }

  destroy(): void {
    this.renderTexture.destroy();
    this.scene.textures.remove(this.backgroundTextureKey);
    this.scene.textures.remove(this.textureKey);
  }

  private drawBackgroundCanvases(): void {
    this.drawCanvasLayer(this.getBackgroundCanvases());
  }

  private drawOverlayCanvases(): void {
    this.drawCanvasLayer(this.getOverlayCanvases());
  }

  private drawCanvasLayer(canvases: HTMLCanvasElement[]): void {
    if (canvases.length === 0) return;
    const copyContext = this.backgroundCopyCanvas.getContext('2d');
    if (!copyContext) return;
    if (
      this.backgroundCopyCanvas.width !== this.captureSize.width ||
      this.backgroundCopyCanvas.height !== this.captureSize.height
    ) {
      this.backgroundCopyCanvas.width = this.captureSize.width;
      this.backgroundCopyCanvas.height = this.captureSize.height;
    }
    copyContext.clearRect(0, 0, this.backgroundCopyCanvas.width, this.backgroundCopyCanvas.height);
    for (const canvas of canvases) {
      copyContext.drawImage(canvas, 0, 0, this.captureSize.width, this.captureSize.height);
    }
    let texture = this.scene.textures.exists(this.backgroundTextureKey)
      ? this.scene.textures.get(this.backgroundTextureKey)
      : this.scene.textures.addCanvas(this.backgroundTextureKey, this.backgroundCopyCanvas);
    if (!texture) return;
    const source = texture.getSourceImage() as HTMLCanvasElement;
    if (source !== this.backgroundCopyCanvas) {
      this.scene.textures.remove(this.backgroundTextureKey);
      texture = this.scene.textures.addCanvas(this.backgroundTextureKey, this.backgroundCopyCanvas);
    } else if ('refresh' in texture && typeof texture.refresh === 'function') {
      texture.refresh();
    }
    this.renderTexture.draw(this.backgroundTextureKey, 0, 0);
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
