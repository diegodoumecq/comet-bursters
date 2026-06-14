import Phaser from 'phaser';

import type { FuelExtractionPlanetEntity } from '../../planets/fuelExtraction';
import { FuelExtractorViews } from '../../planets/fuelExtractorViews';

export class SandboxPlanetOverlay {
  private readonly extractorViews: FuelExtractorViews;
  private readonly inspectionGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.extractorViews = new FuelExtractorViews(scene);
    this.inspectionGraphics = scene.add
      .graphics()
      .setName('sandbox-planet-inspection-overlay')
      .setDepth(1.9);
  }

  render(planets: FuelExtractionPlanetEntity[], now: number): void {
    this.inspectionGraphics.clear();
    this.extractorViews.sync(planets, now);
    for (const planet of planets) {
      if (now < planet.inspectedUntil) this.drawInspectionOverlay(planet);
    }
  }

  private drawInspectionOverlay(planet: FuelExtractionPlanetEntity): void {
    this.inspectionGraphics.fillStyle(0x020617, 0.5);
    this.inspectionGraphics.fillCircle(planet.position.x, planet.position.y, planet.radius * 0.96);
    this.inspectionGraphics.lineStyle(3, 0x7dd3fc, 0.82);
    this.inspectionGraphics.strokeCircle(
      planet.position.x,
      planet.position.y,
      planet.radius * 0.96,
    );
  }
}
