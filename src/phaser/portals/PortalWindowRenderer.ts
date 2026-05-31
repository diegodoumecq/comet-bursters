import Phaser from 'phaser';

import type { PortalEntity } from '../dimensions/types';
import { markPortalCaptureExcluded } from './PortalSceneCapture';

const PORTAL_DEPTH = 1.2;
const PORTAL_EDGE_DEPTH = 1.3;
const ELLIPSE_SEGMENTS = 48;

export class PortalWindowRenderer {
  private destinationTextureKeyProvider: () => string | null = () => null;
  private maskGraphics: Phaser.GameObjects.Graphics;
  private portalImage: Phaser.GameObjects.Image;
  private rimGraphics: Phaser.GameObjects.Graphics;
  private readonly portals: PortalEntity[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly screen: { height: number; width: number },
  ) {
    this.portalImage = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(PORTAL_DEPTH);
    this.maskGraphics = scene.add.graphics().setVisible(false);
    this.rimGraphics = scene.add.graphics().setDepth(PORTAL_EDGE_DEPTH);
    this.portalImage.setMask(this.maskGraphics.createGeometryMask());
    this.portalImage.setVisible(false);
    markPortalCaptureExcluded(this.portalImage);
    markPortalCaptureExcluded(this.maskGraphics);
    markPortalCaptureExcluded(this.rimGraphics);
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
      this.portalImage.setVisible(false);
      this.rimGraphics.clear();
      this.maskGraphics.clear();
      return;
    }

    const fade = getPortalFade(portal, now);
    if (fade <= 0) {
      this.portalImage.setVisible(false);
      this.rimGraphics.clear();
      this.maskGraphics.clear();
      return;
    }

    const angle = Math.atan2(portal.normal.y, portal.normal.x);
    this.maskGraphics.clear();
    drawPortalEllipse(this.maskGraphics, portal, angle, 0xffffff, 1, true);
    this.rimGraphics.clear();
    drawPortalFill(this.rimGraphics, portal, angle, fade);
    drawPortalEllipse(this.rimGraphics, portal, angle, 0x67e8f9, 0.9 * fade, false);

    const destinationTextureKey = this.destinationTextureKeyProvider();
    if (destinationTextureKey === null) {
      this.portalImage.setVisible(false);
      return;
    }
    this.portalImage
      .setTexture(destinationTextureKey)
      .setPosition(0, 0)
      .setDisplaySize(this.screen.width, this.screen.height)
      .setAlpha(fade)
      .setVisible(true);
  }

  resize(screen: { height: number; width: number }): void {
    this.screen.width = screen.width;
    this.screen.height = screen.height;
    this.portalImage.setDisplaySize(screen.width, screen.height);
  }

  destroy(): void {
    this.portalImage.destroy();
    this.maskGraphics.destroy();
    this.rimGraphics.destroy();
  }
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

function drawPortalEllipse(
  graphics: Phaser.GameObjects.Graphics,
  portal: PortalEntity,
  angle: number,
  color: number,
  alpha: number,
  fill: boolean,
): void {
  const tangent = { x: -Math.sin(angle), y: Math.cos(angle) };
  const normal = { x: Math.cos(angle), y: Math.sin(angle) };
  const points = [];
  for (let index = 0; index < ELLIPSE_SEGMENTS; index += 1) {
    const theta = (index / ELLIPSE_SEGMENTS) * Math.PI * 2;
    const along = Math.cos(theta) * portal.aperture.radiusX;
    const across = Math.sin(theta) * portal.aperture.radiusY;
    points.push({
      x: portal.position.x + tangent.x * along + normal.x * across,
      y: portal.position.y + tangent.y * along + normal.y * across,
    });
  }

  if (fill) graphics.fillStyle(color, alpha);
  else graphics.lineStyle(3, color, alpha);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1)
    graphics.lineTo(points[index].x, points[index].y);
  graphics.closePath();
  if (fill) graphics.fillPath();
  else graphics.strokePath();
}

function drawPortalFill(
  graphics: Phaser.GameObjects.Graphics,
  portal: PortalEntity,
  angle: number,
  fade: number,
): void {
  drawPortalEllipse(graphics, portal, angle, 0x06101f, 0.42 * fade, true);
}
