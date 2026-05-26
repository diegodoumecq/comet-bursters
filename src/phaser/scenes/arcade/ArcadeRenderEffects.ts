import type { WorldSize } from '../../core/types';
import { withPerformanceMeasure } from '../../core/performance';
import { FuelMetaballRenderer } from '../../fuel/metaballs';
import { buildFuelBlobMetaballSamples } from '../../fuel/metaballSamples';
import { buildBlackHoleScreenSamples } from '../../projectiles/blackHoleSamples';
import { BlackHoleShaderRenderer } from '../../projectiles/blackHoleShader';
import { getSandboxPerfToggles } from '../../runtime/startup';
import type { ArcadeRunState } from './arcadeRunState';

export class ArcadeRenderEffects {
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly fuelMetaballs: FuelMetaballRenderer | null;
  private readonly perfToggles = getSandboxPerfToggles();

  constructor(
    sourceCanvas: HTMLCanvasElement,
    parent: HTMLElement | null,
    getBackgroundCanvases: () => HTMLCanvasElement[],
  ) {
    this.fuelMetaballs = parent ? new FuelMetaballRenderer(parent) : null;
    this.blackHoleShader = new BlackHoleShaderRenderer(sourceCanvas, getBackgroundCanvases, () => {
      const canvas = this.fuelMetaballs?.getCanvas();
      return canvas ? [canvas] : [];
    });
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
      const blackHoles = buildBlackHoleScreenSamples({
        projectiles: session.world.projectiles,
        project: (position) => [position],
      });
      this.fuelMetaballs?.setVisible(this.perfToggles.fuelMetaballs && blackHoles.length === 0);
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
}
