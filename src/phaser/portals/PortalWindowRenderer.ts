import Phaser from 'phaser';

import type { PortalEntity } from '../dimensions/types';
import { PortalMetaballRenderer } from './PortalMetaballRenderer';

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

    const fade = getPortalFade(portal, now);
    if (fade <= 0) {
      this.hidePortal();
      return;
    }

    const destinationTextureKey = this.destinationTextureKeyProvider();
    if (destinationTextureKey === null) {
      this.metaballRenderer.setVisible(false);
      return;
    }
    this.metaballRenderer.render({
      alpha: fade,
      depth: PORTAL_CAPTURE_DEPTH,
      destinationTextureKey,
      now,
      portal,
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

function getPortalFade(portal: PortalEntity, now: number): number {
  const age = Math.max(0, now - portal.openedAt);
  const opening = Phaser.Math.Clamp(age / Math.max(1, portal.openingDurationMs), 0, 1);
  const closing =
    portal.closeStartedAt === null
      ? 0
      : Phaser.Math.Clamp(
          (now - portal.closeStartedAt) / Math.max(1, portal.closingDurationMs),
          0,
          1,
        );
  return Phaser.Math.SmoothStep(opening, 0, 1) * (1 - Phaser.Math.SmoothStep(closing, 0, 1));
}
