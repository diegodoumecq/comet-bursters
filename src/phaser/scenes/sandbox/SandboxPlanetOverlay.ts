import Phaser from 'phaser';

import type { SandboxPlanetEntity } from './planetFuel';
import { getExtractorPosition } from './planetFuel';

export class SandboxPlanetOverlay {
  private readonly inspectionGraphics: Phaser.GameObjects.Graphics;
  private readonly pulseGraphics: Phaser.GameObjects.Graphics;
  private readonly staticGraphics: Phaser.GameObjects.Graphics;
  private staticExtractorKey: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.inspectionGraphics = scene.add.graphics().setDepth(1.9);
    this.staticGraphics = scene.add.graphics().setDepth(2);
    this.pulseGraphics = scene.add.graphics().setDepth(2.1);
  }

  render(planets: SandboxPlanetEntity[], now: number): void {
    this.renderStaticExtractors(planets);
    this.inspectionGraphics.clear();
    this.pulseGraphics.clear();
    for (const planet of planets) {
      if (now < planet.inspectedUntil) this.drawInspectionOverlay(planet);
      this.drawExtractorPulse(planet, now);
    }
  }

  private renderStaticExtractors(planets: SandboxPlanetEntity[]): void {
    const key = planets
      .map(
        (planet) =>
          `${planet.id}:${planet.position.x}:${planet.position.y}:${planet.extractor.angle}`,
      )
      .join('|');
    if (key === this.staticExtractorKey) return;

    this.staticExtractorKey = key;
    this.staticGraphics.clear();
    for (const planet of planets) this.drawExtractorBody(planet);
  }

  private drawInspectionOverlay(planet: SandboxPlanetEntity): void {
    this.inspectionGraphics.fillStyle(0x020617, 0.5);
    this.inspectionGraphics.fillCircle(planet.position.x, planet.position.y, planet.radius * 0.96);
    this.inspectionGraphics.lineStyle(3, 0x7dd3fc, 0.82);
    this.inspectionGraphics.strokeCircle(
      planet.position.x,
      planet.position.y,
      planet.radius * 0.96,
    );
  }

  private drawExtractorBody(planet: SandboxPlanetEntity): void {
    const position = getExtractorPosition(planet);
    const angle = planet.extractor.angle + Math.PI * 0.5;
    this.staticGraphics.save();
    this.staticGraphics.translateCanvas(position.x, position.y);
    this.staticGraphics.rotateCanvas(angle);

    this.staticGraphics.fillStyle(0x0b1220, 1);
    this.staticGraphics.fillRoundedRect(-24, -12, 48, 24, 5);
    this.staticGraphics.lineStyle(2, 0x334155, 1);
    this.staticGraphics.strokeRoundedRect(-24, -12, 48, 24, 5);

    this.staticGraphics.fillStyle(0x111827, 1);
    this.staticGraphics.fillRect(-17, -25, 34, 13);
    this.staticGraphics.lineStyle(2, 0x475569, 1);
    this.staticGraphics.strokeRect(-17, -25, 34, 13);

    this.staticGraphics.fillStyle(0x1e293b, 1);
    this.staticGraphics.fillRect(-10, -39, 20, 14);
    this.staticGraphics.lineStyle(2, 0x64748b, 0.9);
    this.staticGraphics.strokeRect(-10, -39, 20, 14);

    this.staticGraphics.lineStyle(3, 0x94a3b8, 0.95);
    this.staticGraphics.lineBetween(0, -39, 0, -53);
    this.staticGraphics.restore();
  }

  private drawExtractorPulse(planet: SandboxPlanetEntity, now: number): void {
    const position = getExtractorPosition(planet);
    const angle = planet.extractor.angle + Math.PI * 0.5;
    const active = planet.fuelReserve > 0;
    const pulse = active ? 0.72 + Math.sin(now * 0.006 + planet.visualSeed) * 0.18 : 0.2;
    this.pulseGraphics.save();
    this.pulseGraphics.translateCanvas(position.x, position.y);
    this.pulseGraphics.rotateCanvas(angle);
    this.pulseGraphics.fillStyle(0x67e8f9, pulse);
    this.pulseGraphics.fillRect(-14, -7, 9, 5);
    this.pulseGraphics.fillRect(5, -7, 9, 5);
    this.pulseGraphics.fillStyle(0x22d3ee, pulse);
    this.pulseGraphics.fillRect(-7, -21, 14, 4);
    this.pulseGraphics.lineStyle(3, 0x67e8f9, pulse);
    this.pulseGraphics.lineBetween(-8, -53, 8, -53);
    this.pulseGraphics.restore();
  }
}
