import Phaser from 'phaser';

import type { AsteroidBodies } from '../../asteroids/bodies';
import type { AsteroidEntity } from '../../asteroids/types';
import { withPerformanceMeasure } from '../../core/performance';
import type { MatterImage, WorldSize } from '../../core/types';
import type { PortalEntity } from '../../dimensions/types';
import { Minimap } from '../../minimap/Minimap';
import type { PlanetEntity } from '../../planets/types';
import { renderPlayerFuel } from '../../player/rendering';
import type { ShipState } from '../../player/shipState';
import type { PlayerState } from '../../player/state';
import { getPortalShaderWorldBounds } from '../../portals/PortalMetaballRenderer';
import { PortalSceneCapture } from '../../portals/PortalSceneCapture';
import { getPortalVisualScale } from '../../portals/portalVisualScale';
import { PortalWindowRenderer } from '../../portals/PortalWindowRenderer';
import { renderBlackHoleCaptureCanvas } from '../../projectiles/blackHoleCaptureCanvas';
import { buildBlackHoleScreenSamples } from '../../projectiles/blackHoleSamples';
import {
  BlackHoleShaderRenderer,
  type BlackHoleScreenSample,
} from '../../projectiles/blackHoleShader';
import type { ProjectileEntity } from '../../projectiles/types';
import { getSandboxPerfToggles } from '../../runtime/startup';
import type { EntityBodies } from '../../entities/bodies';
import type { GameEntity } from '../../entities/types';
import {
  createBoundedScreenProjector,
  getCameraCaptureFrame,
  type ScreenCaptureFrame,
} from '../../world/screenProjection';

const DEMO_PORTAL_CAPTURE_INTERVAL_MS = 250;
const DEMO_PORTAL_CAPTURE_PADDING = 96;

export class DemoRenderer {
  private readonly blackHoleCaptureCanvas = document.createElement('canvas');
  private readonly blackHoleCaptureSamples: BlackHoleScreenSample[] = [];
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly collisionMasks: Phaser.GameObjects.Graphics;
  private readonly portalCapture: PortalSceneCapture;
  private readonly portalRenderer: PortalWindowRenderer;
  private readonly perfToggles = getSandboxPerfToggles();
  private blackHoleCaptureVisible = false;
  private minimap: Minimap | null = null;
  private portalCapturedAt = Number.NEGATIVE_INFINITY;
  private portalCaptureFrame: ScreenCaptureFrame | null = null;
  private portalDestinationTextureKey: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Matter.Image,
    private readonly asteroidBodies: AsteroidBodies,
    private readonly entityBodies: EntityBodies,
    private readonly world: WorldSize,
  ) {
    this.playerFuelBase = scene.add.graphics().setDepth(2);
    this.playerFuelFill = scene.add.graphics().setDepth(2);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.collisionMasks = scene.add.graphics().setDepth(20);
    this.blackHoleShader = new BlackHoleShaderRenderer(scene.game.canvas);
    this.portalCapture = new PortalSceneCapture(
      scene,
      world,
      undefined,
      () => this.getPortalCaptureOverlayCanvases(),
      {
        getCaptureFrame: () => this.getCaptureFrame(),
      },
    );
    this.portalRenderer = new PortalWindowRenderer(scene, this.getScreenSize());
    this.portalRenderer.setDestinationTextureKeyProvider(() => this.portalDestinationTextureKey);
  }

  render(input: {
    asteroids: AsteroidEntity[];
    blackHoles: ProjectileEntity[];
    now: number;
    player: PlayerState;
    planets: PlanetEntity[];
    portals: PortalEntity[];
    ship: ShipState;
    entities: GameEntity[];
  }): void {
    renderPlayerFuel(
      this.playerFuelBase,
      this.playerFuelFill,
      this.playerFuelMask,
      this.player,
      input.ship.fuel,
      input.now,
      true,
    );
    withPerformanceMeasure('demo.render.collisionMasks', this.perfToggles.markers, () => {
      this.renderCollisionMasks(input);
    });
    withPerformanceMeasure('demo.render.blackHoles.total', this.perfToggles.markers, () => {
      this.renderBlackHoles(input.blackHoles);
    });
    this.renderPortals(input.portals, input.blackHoles, input.now);
    withPerformanceMeasure('demo.render.minimap', this.perfToggles.markers, () => {
      this.getMinimap().render({
        asteroids: input.asteroids,
        camera: this.scene.cameras.main,
        planets: input.planets,
        player: input.player.position,
        playerRotation: input.player.rotation,
        playerVelocity: input.player.velocity,
        entities: input.entities,
        viewportMode: 'bounded',
        world: this.world,
      });
    });
  }

  private getMinimap(): Minimap {
    this.minimap ??= new Minimap(this.scene);
    return this.minimap;
  }

  destroy(): void {
    this.blackHoleShader.dispose();
    this.portalRenderer.destroy();
    this.portalCapture.destroy();
    this.minimap?.destroy();
    this.minimap = null;
  }

  private renderCollisionMasks(input: {
    asteroids: AsteroidEntity[];
    planets: PlanetEntity[];
    entities: GameEntity[];
  }): void {
    this.collisionMasks.clear();
    this.collisionMasks.lineStyle(2, 0xffffff, 0.9);
    this.strokeMatterBody(this.player as MatterImage);
    for (const asteroid of input.asteroids) {
      this.strokeMatterBody(this.asteroidBodies.get(asteroid));
    }
    for (const entity of input.entities) {
      this.strokeMatterBody(this.entityBodies.get(entity));
    }
    for (const planet of input.planets) {
      this.collisionMasks.strokeCircle(planet.position.x, planet.position.y, planet.radius);
    }
  }

  private strokeMatterBody(target: MatterImage): void {
    const vertices = target.body.vertices;
    if (!vertices || vertices.length < 2) return;
    this.collisionMasks.beginPath();
    this.collisionMasks.moveTo(vertices[0].x, vertices[0].y);
    for (let index = 1; index < vertices.length; index += 1) {
      this.collisionMasks.lineTo(vertices[index].x, vertices[index].y);
    }
    this.collisionMasks.closePath();
    this.collisionMasks.strokePath();
  }

  private renderBlackHoles(blackHoles: ProjectileEntity[]): void {
    const screen = this.getScreenSize();
    const project = createBoundedScreenProjector({
      camera: this.scene.cameras.main,
      screen,
    });
    const screenSamples = buildBlackHoleScreenSamples({
      project,
      projectiles: blackHoles,
    });
    const zoom = this.scene.cameras.main.zoom;
    for (const sample of screenSamples) {
      sample.radius *= zoom;
    }
    withPerformanceMeasure('demo.render.blackHoles.shader', this.perfToggles.markers, () => {
      this.blackHoleShader.render(screenSamples);
    });
  }

  private renderPortals(
    portals: PortalEntity[],
    blackHoles: ProjectileEntity[],
    now: number,
  ): void {
    const visibleFrame = this.getCaptureFrame();
    this.portalRenderer.resize(visibleFrame);
    this.portalRenderer.setPortals(portals);
    this.updatePortalCapture(portals, blackHoles, now, visibleFrame);
    this.portalRenderer.setCaptureFrame(this.portalCaptureFrame ?? visibleFrame);
    withPerformanceMeasure('demo.render.portals.window', this.perfToggles.markers, () => {
      this.portalRenderer.render(now);
    });
  }

  private updatePortalCapture(
    portals: PortalEntity[],
    blackHoles: ProjectileEntity[],
    now: number,
    visibleFrame: ScreenCaptureFrame,
  ): void {
    if (portals.length === 0) {
      this.portalDestinationTextureKey = null;
      this.portalCaptureFrame = null;
      return;
    }
    const captureFrame = getPortalSourceCaptureFrame(portals, now, visibleFrame);
    if (!captureFrame) {
      this.portalDestinationTextureKey = null;
      this.portalCaptureFrame = null;
      return;
    }
    if (
      this.portalDestinationTextureKey === null ||
      this.portalCaptureFrame === null ||
      !isPortalCaptureFrameReusable(this.portalCaptureFrame, captureFrame) ||
      now - this.portalCapturedAt >= DEMO_PORTAL_CAPTURE_INTERVAL_MS
    ) {
      this.portalDestinationTextureKey = withPerformanceMeasure(
        'demo.render.portals.capture',
        this.perfToggles.markers,
        () => {
          this.preparePortalCaptureOverlay(blackHoles, captureFrame);
          return this.portalCapture.capture(captureFrame);
        },
      );
      this.portalCapturedAt = now;
      this.portalCaptureFrame = captureFrame;
    }
  }

  private getPortalCaptureOverlayCanvases(): HTMLCanvasElement[] {
    return this.blackHoleCaptureVisible ? [this.blackHoleCaptureCanvas] : [];
  }

  private preparePortalCaptureOverlay(
    blackHoles: ProjectileEntity[],
    captureFrame: ScreenCaptureFrame,
  ): void {
    const project = createCaptureFrameProjector(captureFrame);
    const screenSamples = buildBlackHoleScreenSamples({
      project,
      projectiles: blackHoles,
    });
    this.blackHoleCaptureSamples.length = 0;
    for (const sample of screenSamples) {
      this.blackHoleCaptureSamples.push({
        radius: sample.radius * captureFrame.zoom,
        x: sample.x,
        y: sample.y,
      });
    }
    withPerformanceMeasure('demo.render.blackHoles.capture', this.perfToggles.markers, () => {
      this.blackHoleCaptureVisible = renderBlackHoleCaptureCanvas({
        blackHoles: this.blackHoleCaptureSamples,
        canvas: this.blackHoleCaptureCanvas,
        height: captureFrame.size.height,
        width: captureFrame.size.width,
      });
    });
  }

  private getCaptureFrame(): ScreenCaptureFrame {
    return getCameraCaptureFrame(
      this.scene.cameras.main,
      this.getScreenSize(),
      DEMO_PORTAL_CAPTURE_PADDING,
    );
  }

  private getScreenSize(): WorldSize {
    return {
      height: this.scene.scale.height,
      width: this.scene.scale.width,
    };
  }
}

function isPortalCaptureFrameReusable(
  capturedFrame: ScreenCaptureFrame,
  currentFrame: ScreenCaptureFrame,
): boolean {
  const sameSize =
    Math.round(capturedFrame.size.width) === Math.round(currentFrame.size.width) &&
    Math.round(capturedFrame.size.height) === Math.round(currentFrame.size.height);
  const sameZoom = Math.round(capturedFrame.zoom * 1000) === Math.round(currentFrame.zoom * 1000);
  return sameSize && sameZoom && captureFrameContainsVisibleFrame(capturedFrame, currentFrame);
}

function captureFrameContainsVisibleFrame(
  capturedFrame: ScreenCaptureFrame,
  currentFrame: ScreenCaptureFrame,
): boolean {
  const capturedRight = capturedFrame.origin.x + capturedFrame.size.width / capturedFrame.zoom;
  const capturedBottom = capturedFrame.origin.y + capturedFrame.size.height / capturedFrame.zoom;
  const currentRight = currentFrame.visibleOrigin.x + currentFrame.visibleSize.width;
  const currentBottom = currentFrame.visibleOrigin.y + currentFrame.visibleSize.height;
  return (
    currentFrame.visibleOrigin.x >= capturedFrame.origin.x &&
    currentFrame.visibleOrigin.y >= capturedFrame.origin.y &&
    currentRight <= capturedRight &&
    currentBottom <= capturedBottom
  );
}

function getPortalSourceCaptureFrame(
  portals: PortalEntity[],
  now: number,
  visibleFrame: ScreenCaptureFrame,
): ScreenCaptureFrame | null {
  const zoom = Math.max(visibleFrame.zoom, 0.000001);
  const visibleBounds = {
    bottom: visibleFrame.visibleOrigin.y + visibleFrame.visibleSize.height,
    left: visibleFrame.visibleOrigin.x,
    right: visibleFrame.visibleOrigin.x + visibleFrame.visibleSize.width,
    top: visibleFrame.visibleOrigin.y,
  };
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;

  for (const portal of portals) {
    const scale = getPortalVisualScale(portal, now);
    if (scale > 0) {
      const bounds = getPortalShaderWorldBounds(portal, scale);
      left = Math.min(left, Math.max(bounds.left, visibleBounds.left));
      right = Math.max(right, Math.min(bounds.right, visibleBounds.right));
      top = Math.min(top, Math.max(bounds.top, visibleBounds.top));
      bottom = Math.max(bottom, Math.min(bounds.bottom, visibleBounds.bottom));
    }
  }

  const hasBounds = Number.isFinite(left) && Number.isFinite(right) && right > left && bottom > top;
  if (!hasBounds) return null;

  const pixelPadding = 2 / zoom;
  const paddedLeft = Math.max(visibleBounds.left, left - pixelPadding);
  const paddedTop = Math.max(visibleBounds.top, top - pixelPadding);
  const paddedRight = Math.min(visibleBounds.right, right + pixelPadding);
  const paddedBottom = Math.min(visibleBounds.bottom, bottom + pixelPadding);
  return {
    origin: { x: paddedLeft, y: paddedTop },
    padding: 0,
    size: {
      height: Math.max(1, Math.ceil((paddedBottom - paddedTop) * zoom)),
      width: Math.max(1, Math.ceil((paddedRight - paddedLeft) * zoom)),
    },
    visibleOrigin: { x: paddedLeft, y: paddedTop },
    visibleSize: {
      height: paddedBottom - paddedTop,
      width: paddedRight - paddedLeft,
    },
    zoom,
  };
}

function createCaptureFrameProjector(
  frame: ScreenCaptureFrame,
): (position: { x: number; y: number }, radius: number) => Array<{ x: number; y: number }> {
  return (position, radius) => {
    const zoom = Math.max(frame.zoom, 0.000001);
    const scaledRadius = radius * zoom;
    const x = (position.x - frame.origin.x) * zoom;
    const y = (position.y - frame.origin.y) * zoom;
    if (
      x + scaledRadius >= 0 &&
      x - scaledRadius <= frame.size.width &&
      y + scaledRadius >= 0 &&
      y - scaledRadius <= frame.size.height
    ) {
      return [{ x, y }];
    }
    return [];
  };
}
