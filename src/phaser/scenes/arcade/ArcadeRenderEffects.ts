import { withPerformanceMeasure } from '../../core/performance';
import type { WorldSize } from '../../core/types';
import { FuelMetaballRenderer } from '../../fuel/metaballs';
import { buildFuelBlobMetaballSamples } from '../../fuel/metaballSamples';
import { renderBlackHoleCaptureCanvas } from '../../projectiles/blackHoleCaptureCanvas';
import {
  BlackHoleShaderRenderer,
  type BlackHoleScreenSample,
} from '../../projectiles/blackHoleShader';
import { getSandboxPerfToggles } from '../../runtime/startup';
import { buildArcadeBlackHoleScreenSamples } from './arcadeBlackHoles';
import type { ArcadeRunState } from './arcadeRunState';

export class ArcadeRenderEffects {
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly blackHoleCaptureCanvas = document.createElement('canvas');
  private readonly fuelMetaballs: FuelMetaballRenderer | null;
  private readonly perfToggles = getSandboxPerfToggles();
  private blackHoleCaptureVisible = false;

  constructor(
    private readonly sourceCanvas: HTMLCanvasElement,
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

  render(session: ArcadeRunState, now: number, screen: WorldSize): void {
    this.renderFuelMetaballs(session, now, screen);

    if (this.perfToggles.blackHoles) {
      const blackHoles = this.buildBlackHoleSamples(session, screen);
      this.renderBlackHoleCapture(blackHoles, this.sourceCanvas.width, this.sourceCanvas.height);
      withPerformanceMeasure('arcade.render.blackHoles', this.perfToggles.markers, () => {
        this.blackHoleShader.render(blackHoles);
      });
    } else {
      this.clearBlackHoleCapture(this.sourceCanvas.width, this.sourceCanvas.height);
      this.blackHoleShader.setVisible(false);
    }
  }

  prepareCaptureCanvases(session: ArcadeRunState, now: number, screen: WorldSize): void {
    this.renderFuelMetaballs(session, now, screen);
    if (this.perfToggles.blackHoles) {
      this.renderBlackHoleCapture(
        this.buildBlackHoleSamples(session, screen),
        this.sourceCanvas.width,
        this.sourceCanvas.height,
      );
    } else {
      this.clearBlackHoleCapture(this.sourceCanvas.width, this.sourceCanvas.height);
    }
  }

  getCaptureCanvases(): HTMLCanvasElement[] {
    const canvases: HTMLCanvasElement[] = [];
    const fuelCanvas = this.fuelMetaballs?.getCanvas();
    if (fuelCanvas) canvases.push(fuelCanvas);
    if (this.blackHoleCaptureVisible) canvases.push(this.blackHoleCaptureCanvas);
    return canvases;
  }

  dispose(): void {
    this.blackHoleShader.dispose();
    this.fuelMetaballs?.dispose();
  }

  setVisible(visible: boolean): void {
    this.blackHoleShader.setVisible(visible);
    this.fuelMetaballs?.setVisible(visible && this.perfToggles.fuelMetaballs);
  }

  private renderFuelMetaballs(session: ArcadeRunState, now: number, screen: WorldSize): void {
    this.fuelMetaballs?.setVisible(this.perfToggles.fuelMetaballs);
    if (this.perfToggles.fuelMetaballs) {
      withPerformanceMeasure('arcade.render.fuelMetaballs', this.perfToggles.markers, () => {
        this.fuelMetaballs?.render(
          buildFuelBlobMetaballSamples({
            blobs: session.world.fuelBlobs,
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

  private buildBlackHoleSamples(
    session: ArcadeRunState,
    screen: WorldSize,
  ): BlackHoleScreenSample[] {
    return buildArcadeBlackHoleScreenSamples(session.world.projectiles, screen, {
      height: this.sourceCanvas.height,
      width: this.sourceCanvas.width,
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
