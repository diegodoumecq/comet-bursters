import Phaser from 'phaser';

import type { SandboxPlanetEntity } from './planetFuel';
import { getExtractorPosition } from './planetFuel';

export class SandboxPlanetOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(2);
  }

  render(planets: SandboxPlanetEntity[], now: number): void {
    this.graphics.clear();
    for (const planet of planets) {
      if (now < planet.inspectedUntil) this.drawInspectionOverlay(planet, now);
      this.drawExtractor(planet, now);
    }
  }

  private drawInspectionOverlay(planet: SandboxPlanetEntity): void {
    this.graphics.fillStyle(0x020617, 0.5);
    this.graphics.fillCircle(planet.position.x, planet.position.y, planet.radius * 0.96);
    this.graphics.lineStyle(3, 0x7dd3fc, 0.82);
    this.graphics.strokeCircle(planet.position.x, planet.position.y, planet.radius * 0.96);
  }

  private drawExtractor(planet: SandboxPlanetEntity, now: number): void {
    const position = getExtractorPosition(planet);
    const angle = planet.extractor.angle + Math.PI * 0.5;
    const active = planet.fuelReserve > 0;
    const pulse = active ? 0.72 + Math.sin(now * 0.006 + planet.visualSeed) * 0.18 : 0.2;
    this.graphics.save();
    this.graphics.translateCanvas(position.x, position.y);
    this.graphics.rotateCanvas(angle);

    this.graphics.fillStyle(0x0b1220, 1);
    this.graphics.fillRoundedRect(-24, -12, 48, 24, 5);
    this.graphics.lineStyle(2, 0x334155, 1);
    this.graphics.strokeRoundedRect(-24, -12, 48, 24, 5);

    this.graphics.fillStyle(0x111827, 1);
    this.graphics.fillRect(-17, -25, 34, 13);
    this.graphics.lineStyle(2, 0x475569, 1);
    this.graphics.strokeRect(-17, -25, 34, 13);

    this.graphics.fillStyle(0x1e293b, 1);
    this.graphics.fillRect(-10, -39, 20, 14);
    this.graphics.lineStyle(2, 0x64748b, 0.9);
    this.graphics.strokeRect(-10, -39, 20, 14);

    this.graphics.fillStyle(0x67e8f9, pulse);
    this.graphics.fillRect(-14, -7, 9, 5);
    this.graphics.fillRect(5, -7, 9, 5);
    this.graphics.fillStyle(0x22d3ee, pulse);
    this.graphics.fillRect(-7, -21, 14, 4);

    this.graphics.lineStyle(3, 0x94a3b8, 0.95);
    this.graphics.lineBetween(0, -39, 0, -53);
    this.graphics.lineStyle(3, 0x67e8f9, pulse);
    this.graphics.lineBetween(-8, -53, 8, -53);
    this.graphics.restore();

  }
}
