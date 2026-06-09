import { withPerformanceMeasure } from '../../core/performance';
import type { WorldSize } from '../../core/types';
import { FuelMetaballRenderer } from '../../fuel/metaballs';
import { buildFuelBlobMetaballSamples } from '../../fuel/metaballSamples';
import { BlackHoleShaderRenderer } from '../../projectiles/blackHoleShader';
import { getSandboxPerfToggles } from '../../runtime/startup';
import { buildArcadeBlackHoleScreenSamples } from './arcadeBlackHoles';
import type { ArcadeRunState } from './arcadeRunState';

export class ArcadeRenderEffects {
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly fuelMetaballs: FuelMetaballRenderer | null;
  private readonly perfToggles = getSandboxPerfToggles();

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

    if (this.perfToggles.blackHoles) {
      const blackHoles = buildArcadeBlackHoleScreenSamples(session.world.projectiles, screen, {
        height: this.sourceCanvas.height,
        width: this.sourceCanvas.width,
      });
      withPerformanceMeasure('arcade.render.blackHoles', this.perfToggles.markers, () => {
        this.blackHoleShader.render(blackHoles);
      });
    } else {
      this.blackHoleShader.setVisible(false);
    }
  }

  dispose(): void {
    this.blackHoleShader.dispose();
    this.fuelMetaballs?.dispose();
  }

  setVisible(visible: boolean): void {
    this.blackHoleShader.setVisible(visible);
    this.fuelMetaballs?.setVisible(visible && this.perfToggles.fuelMetaballs);
  }
}
