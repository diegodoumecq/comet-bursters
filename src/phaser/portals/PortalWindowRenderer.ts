import type { PortalEntity } from '../dimensions/types';
import { PortalMetaballRenderer } from './PortalMetaballRenderer';
import { getPortalVisualScale } from './portalVisualScale';

const PORTAL_CAPTURE_DEPTH = -1.9;
const CAMERA_TRANSFER_PORTAL_TINT = { b: 0.22, g: 0.42, r: 1 };
const WINDOW_PORTAL_TINT = { b: 1, g: 0.72, r: 0.12 };

export class PortalWindowRenderer {
  private destinationTextureKeyProvider: () => string | null = () => null;
  private metaballRenderer: PortalMetaballRenderer;
  private readonly portals: PortalEntity[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly screen: { height: number; width: number },
  ) {
    this.metaballRenderer = new PortalMetaballRenderer(scene);
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

  render(now: number): void {
    const portal = this.portals[0] ?? null;
    if (!portal) {
      this.hidePortal();
      return;
    }

    const scale = getPortalVisualScale(portal, now);
    if (scale <= 0) {
      this.hidePortal();
      return;
    }

    const destinationTextureKey = this.destinationTextureKeyProvider();
    if (destinationTextureKey === null) {
      this.metaballRenderer.setVisible(false);
      return;
    }
    this.metaballRenderer.render({
      alpha: 1,
      depth: PORTAL_CAPTURE_DEPTH,
      destinationTextureKey,
      now,
      portal,
      scale,
      screen: this.screen,
      tint: getPortalTint(portal),
    });
  }

  resize(screen: { height: number; width: number }): void {
    this.screen.width = screen.width;
    this.screen.height = screen.height;
  }

  setVisible(visible: boolean): void {
    this.metaballRenderer.setVisible(visible);
  }

  destroy(): void {
    this.metaballRenderer.destroy();
  }

  private hidePortal(): void {
    this.metaballRenderer.setVisible(false);
  }
}

function getPortalTint(portal: PortalEntity): { b: number; g: number; r: number } {
  return portal.viewPolicy === 'cameraTransfer' ? CAMERA_TRANSFER_PORTAL_TINT : WINDOW_PORTAL_TINT;
}
