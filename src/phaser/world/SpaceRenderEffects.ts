import { withPerformanceMeasure } from '../core/performance';
import type { WorldSize } from '../core/types';
import { FuelMetaballRenderer } from '../fuel/metaballs';
import { buildFuelBlobMetaballSamples } from '../fuel/metaballSamples';
import { buildBlackHoleScreenSamples } from '../projectiles/blackHoleSamples';
import { BlackHoleShaderRenderer } from '../projectiles/blackHoleShader';
import { getSandboxPerfToggles } from '../runtime/startup';
import type { GameWorld } from './state';

export class SpaceRenderEffects {
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly fuelMetaballs: FuelMetaballRenderer | null;
  private readonly perfToggles = getSandboxPerfToggles();

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

    if (this.perfToggles.blackHoles) {
      withPerformanceMeasure('space.render.blackHoles', this.perfToggles.markers, () => {
        this.blackHoleShader.render(
          buildBlackHoleScreenSamples({
            projectiles: world.projectiles,
            project: (position) => [position],
          }),
        );
      });
    } else {
      this.blackHoleShader.setVisible(false);
    }
  }

  setVisible(visible: boolean): void {
    this.blackHoleShader.setVisible(visible);
    this.fuelMetaballs?.setVisible(visible && this.perfToggles.fuelMetaballs);
  }

  dispose(): void {
    this.blackHoleShader.dispose();
    this.fuelMetaballs?.dispose();
  }
}
