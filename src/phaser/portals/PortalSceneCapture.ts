import Phaser from 'phaser';

import type { WorldSize } from '../core/types';
import type { ScreenCaptureFrame } from '../world/screenProjection';

const CAPTURE_EXCLUDE_KEY = 'portalCaptureExclude';
let nextCaptureId = 0;

type PortalSceneCaptureOptions = {
  getCaptureFrame?: () => ScreenCaptureFrame;
};

type CaptureRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export class PortalSceneCapture {
  private readonly textureKey = `portal-scene-capture-${nextCaptureId++}`;
  private readonly backgroundTextureKey = `portal-scene-capture-background-${nextCaptureId++}`;
  private readonly backgroundCopyCanvas = document.createElement('canvas');
  private captureEntries: Phaser.GameObjects.GameObject[] = [];
  private captureEntryChildren: Phaser.GameObjects.GameObject[] = [];
  private renderTexture: Phaser.GameObjects.RenderTexture;

  constructor(
    private readonly scene: Phaser.Scene,
    world: WorldSize,
    private readonly getBackgroundCanvases: () => HTMLCanvasElement[] = () => [],
    private readonly getOverlayCanvases: () => HTMLCanvasElement[] = () => [],
    private readonly options: PortalSceneCaptureOptions = {},
  ) {
    const initialSize = options.getCaptureFrame?.().size ?? world;
    this.renderTexture = scene.add
      .renderTexture(-100000, -100000, initialSize.width, initialSize.height)
      .setVisible(false);
    markPortalCaptureExcluded(this.renderTexture);
    this.renderTexture.saveTexture(this.textureKey);
  }

  capture(captureFrame?: ScreenCaptureFrame): string {
    const frame = captureFrame ?? this.getCaptureFrame();
    this.resize(frame.size);
    this.renderTexture.clear();
    this.drawBackgroundCanvases(frame);
    this.drawCaptureEntries(frame);
    this.drawOverlayCanvases(frame);
    return this.textureKey;
  }

  resize(world: WorldSize): void {
    if (this.renderTexture.width !== world.width || this.renderTexture.height !== world.height) {
      this.renderTexture.resize(world.width, world.height);
    }
  }

  destroy(): void {
    this.renderTexture.destroy();
    this.scene.textures.remove(this.backgroundTextureKey);
    this.scene.textures.remove(this.textureKey);
  }

  private drawBackgroundCanvases(frame: ScreenCaptureFrame): void {
    this.drawCanvasLayer(this.getBackgroundCanvases(), frame);
  }

  private drawOverlayCanvases(frame: ScreenCaptureFrame): void {
    this.drawCanvasLayer(this.getOverlayCanvases(), frame);
  }

  private drawCaptureEntries(frame: ScreenCaptureFrame): void {
    const entries = this.getCaptureEntries(frame);
    if (entries.length === 0) return;

    const camera = this.renderTexture.camera;
    const previousScroll = { x: camera.scrollX, y: camera.scrollY };
    const previousZoom = camera.zoom;
    camera.setScroll(frame.origin.x, frame.origin.y);
    camera.setZoom(frame.zoom);
    this.renderTexture.draw(entries);
    camera.setScroll(previousScroll.x, previousScroll.y);
    camera.setZoom(previousZoom);
  }

  private drawCanvasLayer(canvases: HTMLCanvasElement[], frame: ScreenCaptureFrame): void {
    if (canvases.length === 0) return;
    const copyContext = this.backgroundCopyCanvas.getContext('2d');
    if (!copyContext) return;
    if (
      this.backgroundCopyCanvas.width !== frame.size.width ||
      this.backgroundCopyCanvas.height !== frame.size.height
    ) {
      this.backgroundCopyCanvas.width = frame.size.width;
      this.backgroundCopyCanvas.height = frame.size.height;
    }
    copyContext.clearRect(0, 0, this.backgroundCopyCanvas.width, this.backgroundCopyCanvas.height);
    for (const canvas of canvases) {
      if (canvas.width === frame.size.width && canvas.height === frame.size.height) {
        copyContext.drawImage(canvas, 0, 0, frame.size.width, frame.size.height);
      } else {
        copyContext.drawImage(
          canvas,
          frame.padding,
          frame.padding,
          frame.visibleSize.width,
          frame.visibleSize.height,
        );
      }
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

  private getCaptureFrame(): ScreenCaptureFrame {
    return (
      this.options.getCaptureFrame?.() ?? {
        origin: { x: 0, y: 0 },
        padding: 0,
        size: {
          height: this.renderTexture.height,
          width: this.renderTexture.width,
        },
        visibleOrigin: { x: 0, y: 0 },
        visibleSize: {
          height: this.renderTexture.height,
          width: this.renderTexture.width,
        },
        zoom: 1,
      }
    );
  }

  private getCaptureEntries(frame: ScreenCaptureFrame): Phaser.GameObjects.GameObject[] {
    const children = this.scene.children.getChildren();
    if (captureEntryChildrenChanged(this.captureEntryChildren, children)) {
      this.captureEntries = children.filter(
        (entry): entry is Phaser.GameObjects.GameObject =>
          entry instanceof Phaser.GameObjects.GameObject &&
          entry !== this.renderTexture &&
          entry.getData(CAPTURE_EXCLUDE_KEY) !== true,
      );
      this.captureEntryChildren = [...children];
    }

    const captureRect = getCaptureRect(frame);
    return this.captureEntries.filter((entry) => this.isCaptureEntryVisible(entry, captureRect));
  }

  private isCaptureEntryVisible(
    entry: Phaser.GameObjects.GameObject,
    captureRect: CaptureRect,
  ): boolean {
    const visible = (entry as Phaser.GameObjects.GameObject & { visible?: boolean }).visible;
    if (visible === false) return false;
    return captureEntryIntersectsRect(entry, captureRect);
  }
}

function captureEntryChildrenChanged(
  previous: Phaser.GameObjects.GameObject[],
  current: Phaser.GameObjects.GameObject[],
): boolean {
  if (previous.length !== current.length) return true;
  for (let index = 0; index < current.length; index += 1) {
    if (previous[index] !== current[index]) return true;
  }
  return false;
}

export function markPortalCaptureExcluded(gameObject: Phaser.GameObjects.GameObject): void {
  gameObject.setData(CAPTURE_EXCLUDE_KEY, true);
}

function getCaptureRect(frame: ScreenCaptureFrame): CaptureRect {
  const zoom = Math.max(frame.zoom, 0.000001);
  return {
    bottom: frame.origin.y + frame.size.height / zoom,
    left: frame.origin.x,
    right: frame.origin.x + frame.size.width / zoom,
    top: frame.origin.y,
  };
}

function captureEntryIntersectsRect(
  entry: Phaser.GameObjects.GameObject,
  rect: CaptureRect,
): boolean {
  const scrollFactorX = readNumberProperty(entry, 'scrollFactorX');
  const scrollFactorY = readNumberProperty(entry, 'scrollFactorY');
  if (scrollFactorX === 0 || scrollFactorY === 0) return true;

  const bounds = getCaptureEntryBounds(entry);
  if (!bounds) return true;
  return (
    bounds.right >= rect.left &&
    bounds.left <= rect.right &&
    bounds.bottom >= rect.top &&
    bounds.top <= rect.bottom
  );
}

function getCaptureEntryBounds(entry: Phaser.GameObjects.GameObject): CaptureRect | null {
  const getBounds = (
    entry as Phaser.GameObjects.GameObject & {
      getBounds?: () => { bottom: number; left: number; right: number; top: number };
    }
  ).getBounds;
  if (typeof getBounds !== 'function') return null;

  const bounds = getBounds.call(entry);
  const finite =
    Number.isFinite(bounds.left) &&
    Number.isFinite(bounds.right) &&
    Number.isFinite(bounds.top) &&
    Number.isFinite(bounds.bottom);
  const hasArea = bounds.right > bounds.left && bounds.bottom > bounds.top;
  return finite && hasArea ? bounds : null;
}

function readNumberProperty(entry: Phaser.GameObjects.GameObject, key: string): number | null {
  const value = (entry as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
