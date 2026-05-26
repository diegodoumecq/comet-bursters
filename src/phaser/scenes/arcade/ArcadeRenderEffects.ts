import type { WorldSize } from '../../core/types';
import { FuelMetaballRenderer } from '../../fuel/metaballs';
import { buildFuelBlobMetaballSamples } from '../../fuel/metaballSamples';
import { buildBlackHoleScreenSamples } from '../../projectiles/blackHoleSamples';
import { BlackHoleShaderRenderer } from '../../projectiles/blackHoleShader';
import type { ArcadeRunState } from './arcadeRunState';

export class ArcadeRenderEffects {
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly fuelMetaballs: FuelMetaballRenderer | null;

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

    const blackHoles = buildBlackHoleScreenSamples({
      projectiles: session.world.projectiles,
      project: (position) => [position],
    });
    this.fuelMetaballs?.setVisible(blackHoles.length === 0);
    this.blackHoleShader.render(blackHoles);
  }

  dispose(): void {
    this.blackHoleShader.dispose();
    this.fuelMetaballs?.dispose();
  }
}
