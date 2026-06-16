import type Phaser from 'phaser';

import { withPerformanceMeasure } from '../../core/performance';
import type { Vector, WorldSize } from '../../core/types';
import { FUEL_BLOB_AMOUNT, FUEL_BLOB_RADIUS } from '../../fuel/definition';
import type { FuelMetaball } from '../../fuel/metaballs';
import { FuelMetaballRenderer } from '../../fuel/metaballs';
import { addProjectedMetaballs, buildFuelBlobMetaballSamples } from '../../fuel/metaballSamples';
import type { FuelBlobEntity } from '../../fuel/types';
import {
  getFuelExtractorBlobPosition,
  type FuelExtractionPlanetEntity,
} from '../../planets/fuelExtraction';
import { buildBlackHoleScreenSamples } from '../../projectiles/blackHoleSamples';
import { BlackHoleShaderRenderer } from '../../projectiles/blackHoleShader';
import type { ProjectileEntity } from '../../projectiles/types';
import { getSandboxPerfToggles } from '../../runtime/startup';
import { createWrappedScreenProjector } from '../../world/screenProjection';

const FUEL_INSPECTION_BLOB_AMOUNT = FUEL_BLOB_AMOUNT * 10;
const MAX_INTERNAL_FUEL_METABALLS_PER_PLANET = 14;

type SandboxRenderEffectsInput = {
  camera: Phaser.Cameras.Scene2D.Camera;
  fuelBlobs: FuelBlobEntity[];
  now: number;
  planets: FuelExtractionPlanetEntity[];
  playerPosition: Vector;
  projectiles: ProjectileEntity[];
  screen: WorldSize;
  world: WorldSize;
};

export class SandboxRenderEffects {
  private readonly blackHoleShader: BlackHoleShaderRenderer;
  private readonly fuelMetaballs: FuelMetaballRenderer | null;
  private readonly perfToggles = getSandboxPerfToggles();

  constructor(sourceCanvas: HTMLCanvasElement, parent: HTMLElement | null) {
    this.fuelMetaballs = parent ? new FuelMetaballRenderer(parent) : null;
    this.blackHoleShader = new BlackHoleShaderRenderer(
      sourceCanvas,
      () => [],
      () => {
        const canvas = this.fuelMetaballs?.getCanvas();
        return canvas ? [canvas] : [];
      },
    );
  }

  render(input: SandboxRenderEffectsInput): void {
    const project = createWrappedScreenProjector({
      camera: input.camera,
      center: input.playerPosition,
      screen: input.screen,
      world: input.world,
    });
    const metaballs = [
      ...buildSandboxPlanetMetaballSamples(input.planets, input.now, project),
      ...buildFuelBlobMetaballSamples({
        blobs: input.fuelBlobs,
        now: input.now,
        project,
      }),
    ];

    this.fuelMetaballs?.setVisible(this.perfToggles.fuelMetaballs);
    if (this.perfToggles.fuelMetaballs) {
      withPerformanceMeasure('sandbox.render.fuelMetaballs', this.perfToggles.markers, () => {
        this.fuelMetaballs?.render(metaballs, input.now, input.screen.width, input.screen.height);
      });
    }

    if (this.perfToggles.blackHoles) {
      const blackHoles = buildBlackHoleScreenSamples({
        projectiles: input.projectiles,
        project,
      });
      withPerformanceMeasure('sandbox.render.blackHoles', this.perfToggles.markers, () => {
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

function buildSandboxPlanetMetaballSamples(
  planets: FuelExtractionPlanetEntity[],
  now: number,
  project: (position: Vector, radius: number) => Vector[],
): FuelMetaball[] {
  const metaballs: FuelMetaball[] = [];
  for (const planet of planets) {
    for (const blob of planet.extractor.blobs) {
      addProjectedMetaballs(
        metaballs,
        project,
        getFuelExtractorBlobPosition(planet, blob, now),
        FUEL_BLOB_RADIUS,
        blob.wobbleSeed,
      );
    }

    if (now < planet.inspectedUntil && project(planet.position, planet.radius).length > 0) {
      const reserveBlobCount = Math.ceil(planet.fuelReserve / FUEL_INSPECTION_BLOB_AMOUNT);
      const internalBlobCount = Math.min(MAX_INTERNAL_FUEL_METABALLS_PER_PLANET, reserveBlobCount);
      const reserveScale = Math.min(1, reserveBlobCount / MAX_INTERNAL_FUEL_METABALLS_PER_PLANET);
      for (let index = 0; index < internalBlobCount; index += 1) {
        const seed = (index + 1) * 12.9898 + planet.position.x * 0.001 + planet.position.y * 0.002;
        const orbit = now * 0.00035 * Math.max(0.25, reserveScale * 3.5) + seed;
        const metaballRadius = 10 + reserveScale * 12;
        const maxCenterDistance = Math.max(0, planet.radius - metaballRadius * 2.2);
        const targetDistance = planet.radius * (0.12 + ((index * 37) % 58) / 100);
        const centerDistance = Math.min(targetDistance, maxCenterDistance);
        const driftX = Math.cos(orbit) * centerDistance;
        const driftY = Math.sin(orbit * 1.17) * centerDistance;
        const driftLength = Math.hypot(driftX, driftY);
        const driftScale = driftLength > maxCenterDistance ? maxCenterDistance / driftLength : 1;
        addProjectedMetaballs(
          metaballs,
          project,
          {
            x: planet.position.x + driftX * driftScale,
            y: planet.position.y + driftY * driftScale,
          },
          metaballRadius,
          seed,
        );
      }
    }
  }
  return metaballs;
}
