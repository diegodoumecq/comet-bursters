import type { PortalEntity } from '../dimensions/types';
import { getStaticCaptureFrame, type ScreenCaptureFrame } from '../world/screenProjection';
import { PortalMetaballRenderer } from './PortalMetaballRenderer';
import { getPortalVisualScale } from './portalVisualScale';

const PORTAL_CAPTURE_DEPTH = -1.9;
const CAMERA_TRANSFER_PORTAL_TINT = { b: 0.22, g: 0.42, r: 1 };
const WINDOW_PORTAL_TINT = { b: 1, g: 0.72, r: 0.12 };

export class PortalWindowRenderer {
  private destinationTextureKeyProvider: () => string | null = () => null;
  private captureFrame: ScreenCaptureFrame;
  private readonly metaballRenderers: PortalMetaballRenderer[] = [];
  private readonly portals: PortalEntity[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    screen: ScreenCaptureFrame['size'],
    private frame: ScreenCaptureFrame = getStaticCaptureFrame(screen),
  ) {
    this.captureFrame = this.frame;
  }

  setDestinationTextureKeyProvider(provider: () => string | null): void {
    this.destinationTextureKeyProvider = provider;
  }

  add(portal: PortalEntity): void {
    this.portals.push(portal);
  }

  setPortals(portals: PortalEntity[]): void {
    this.portals.length = 0;
    this.portals.push(...portals);
  }

  setCaptureFrame(frame: ScreenCaptureFrame): void {
    this.captureFrame = frame;
  }

  render(now: number): void {
    if (this.portals.length === 0) {
      this.hidePortals();
      return;
    }

    const destinationTextureKey = this.destinationTextureKeyProvider();
    if (destinationTextureKey === null) {
      this.hidePortals();
      return;
    }

    for (let index = 0; index < this.portals.length; index += 1) {
      const portal = this.portals[index];
      const scale = getPortalVisualScale(portal, now);
      const renderer = this.getRenderer(index);
      if (scale > 0) {
        renderer.render({
          alpha: 1,
          captureFrame: this.captureFrame,
          depth: PORTAL_CAPTURE_DEPTH + index * 0.001,
          destinationTextureKey,
          now,
          portal,
          scale,
          tint: getPortalTint(portal),
          visibleFrame: this.frame,
        });
      } else {
        renderer.setVisible(false);
      }
    }

    for (let index = this.portals.length; index < this.metaballRenderers.length; index += 1) {
      this.metaballRenderers[index].setVisible(false);
    }
  }

  resize(frame: ScreenCaptureFrame): void;
  resize(screen: { height: number; width: number }, origin?: ScreenCaptureFrame['origin']): void;
  resize(
    frameOrScreen: ScreenCaptureFrame | { height: number; width: number },
    origin?: ScreenCaptureFrame['origin'],
  ): void {
    if ('visibleOrigin' in frameOrScreen) {
      this.frame = frameOrScreen;
      this.captureFrame = frameOrScreen;
      return;
    }
    this.frame = {
      ...getStaticCaptureFrame(frameOrScreen),
      origin: origin ?? { x: 0, y: 0 },
      visibleOrigin: origin ?? { x: 0, y: 0 },
    };
    this.captureFrame = this.frame;
  }

  setVisible(visible: boolean): void {
    for (const renderer of this.metaballRenderers) renderer.setVisible(visible);
  }

  destroy(): void {
    for (const renderer of this.metaballRenderers) renderer.destroy();
    this.metaballRenderers.length = 0;
  }

  private getRenderer(index: number): PortalMetaballRenderer {
    let renderer = this.metaballRenderers[index];
    if (!renderer) {
      renderer = new PortalMetaballRenderer(this.scene);
      this.metaballRenderers[index] = renderer;
    }
    return renderer;
  }

  private hidePortals(): void {
    for (const renderer of this.metaballRenderers) renderer.setVisible(false);
  }
}

function getPortalTint(portal: PortalEntity): { b: number; g: number; r: number } {
  return portal.viewPolicy === 'cameraTransfer' ? CAMERA_TRANSFER_PORTAL_TINT : WINDOW_PORTAL_TINT;
}
