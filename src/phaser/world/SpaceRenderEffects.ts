import { withPerformanceMeasure } from '../core/performance';
import type { WorldSize } from '../core/types';
import { FuelMetaballRenderer } from '../fuel/metaballs';
import { buildFuelBlobMetaballSamples } from '../fuel/metaballSamples';
import { renderBlackHoleCaptureCanvas } from '../projectiles/blackHoleCaptureCanvas';
import { buildBlackHoleScreenSamples } from '../projectiles/blackHoleSamples';
import {
  BlackHoleShaderRenderer,
  type BlackHoleScreenSample,
} from '../projectiles/blackHoleShader';
import { getSandboxPerfToggles } from '../runtime/startup';
import type { GameWorld } from './state';

export class SpaceRenderEffects {
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly blackHoleCaptureCanvas = document.createElement('canvas');
  private readonly fuelMetaballs: FuelMetaballRenderer | null;
  private readonly perfToggles = getSandboxPerfToggles();
  private blackHoleCaptureVisible = false;

  constructor(
    sourceCanvas: HTMLCanvasElement,
    parent: HTMLElement | null,
    getBackgroundCanvases: () => HTMLCanvasElement[],
  ) {
    this.fuelMetaballs = parent ? new FuelMetaballRenderer(parent) : null;
    this.blackHoleShader = new BlackHoleShaderRenderer(
      sourceCanvas,
      getBackgroundCanvases,
      () => {
        const canvas = this.fuelMetaballs?.getCanvas();
        return canvas ? [canvas] : [];
      },
      { wrapSourceSampling: true },
    );
  }

  render(world: GameWorld, now: number, screen: WorldSize): void {
    this.renderFuelMetaballs(world, now, screen);

    if (this.perfToggles.blackHoles) {
      const blackHoles = this.buildBlackHoleSamples(world);
      this.renderBlackHoleCapture(blackHoles, screen.width, screen.height);
      withPerformanceMeasure('space.render.blackHoles', this.perfToggles.markers, () => {
        this.blackHoleShader.render(blackHoles);
      });
    } else {
      this.clearBlackHoleCapture(screen.width, screen.height);
      this.blackHoleShader.setVisible(false);
    }
  }

  prepareCaptureCanvases(world: GameWorld, now: number, screen: WorldSize): void {
    this.renderFuelMetaballs(world, now, screen);
    if (this.perfToggles.blackHoles) {
      this.renderBlackHoleCapture(this.buildBlackHoleSamples(world), screen.width, screen.height);
    } else {
      this.clearBlackHoleCapture(screen.width, screen.height);
    }
  }

  getCaptureCanvases(): HTMLCanvasElement[] {
    const canvases: HTMLCanvasElement[] = [];
    const fuelCanvas = this.fuelMetaballs?.getCanvas();
    if (fuelCanvas) canvases.push(fuelCanvas);
    if (this.blackHoleCaptureVisible) canvases.push(this.blackHoleCaptureCanvas);
    return canvases;
  }

  setVisible(visible: boolean): void {
    this.blackHoleShader.setVisible(visible);
    this.fuelMetaballs?.setVisible(visible && this.perfToggles.fuelMetaballs);
  }

  dispose(): void {
    this.blackHoleShader.dispose();
    this.fuelMetaballs?.dispose();
  }

  private renderFuelMetaballs(world: GameWorld, now: number, screen: WorldSize): void {
    this.fuelMetaballs?.setVisible(this.perfToggles.fuelMetaballs);
    if (this.perfToggles.fuelMetaballs) {
      withPerformanceMeasure('space.render.fuelMetaballs', this.perfToggles.markers, () => {
        this.fuelMetaballs?.render(
          buildFuelBlobMetaballSamples({
            blobs: world.fuelBlobs,
            now,
            project: (position, radius) => {
              if (
                position.x + radius < 0 ||
                position.x - radius > screen.width ||
                position.y + radius < 0 ||
                position.y - radius > screen.height
              ) {
                return [];
              }
              return [position];
            },
          }),
          now,
          screen.width,
          screen.height,
        );
      });
    }
  }

  private buildBlackHoleSamples(world: GameWorld): BlackHoleScreenSample[] {
    return buildBlackHoleScreenSamples({
      projectiles: world.projectiles,
      project: (position) => [position],
    });
  }

  private renderBlackHoleCapture(
    blackHoles: BlackHoleScreenSample[],
    width: number,
    height: number,
  ): void {
    this.blackHoleCaptureVisible = renderBlackHoleCaptureCanvas({
      blackHoles,
      canvas: this.blackHoleCaptureCanvas,
      height,
      width,
    });
  }

  private clearBlackHoleCapture(width: number, height: number): void {
    this.blackHoleCaptureVisible = renderBlackHoleCaptureCanvas({
      blackHoles: [],
      canvas: this.blackHoleCaptureCanvas,
      height,
      width,
    });
  }
}
