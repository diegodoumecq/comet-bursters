import Phaser from 'phaser';

import type { SandboxPlanetEntity } from './planetFuel';
import { getExtractorBlobPosition, getExtractorPosition } from './planetFuel';

const MAX_INTERNAL_BLOBS = 8;

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

  private drawInspectionOverlay(planet: SandboxPlanetEntity, now: number): void {
    const reserveRatio = Math.min(1, planet.fuelReserve / 150);
    this.graphics.fillStyle(0x020617, 0.5);
    this.graphics.fillCircle(planet.position.x, planet.position.y, planet.radius * 0.96);
    this.graphics.lineStyle(3, 0x7dd3fc, 0.82);
    this.graphics.strokeCircle(planet.position.x, planet.position.y, planet.radius * 0.96);

    const blobCount = Math.max(1, Math.ceil(reserveRatio * MAX_INTERNAL_BLOBS));
    for (let index = 0; index < blobCount; index += 1) {
      const seed = planet.visualSeed + index * 12.9898;
      const orbit = now * 0.00035 * Math.max(0.3, reserveRatio * 2.4) + seed;
      const radialRatio = 0.16 + pseudoRandom(seed) * 0.46;
      const maxDistance = planet.radius * radialRatio;
      const x = planet.position.x + Math.cos(orbit) * maxDistance;
      const y = planet.position.y + Math.sin(orbit * 1.17) * maxDistance;
      const radius = 10 + reserveRatio * 12 + pseudoRandom(seed * 1.7) * 5;
      const pulse = 0.8 + Math.sin(now * 0.004 + seed) * 0.12;
      this.graphics.fillStyle(0x67e8f9, (0.18 + reserveRatio * 0.34) * pulse);
      this.graphics.fillCircle(x, y, radius);
      this.graphics.lineStyle(1.5, 0xe0f2fe, (0.25 + reserveRatio * 0.28) * pulse);
      this.graphics.strokeCircle(x, y, radius);
    }
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

    for (const blob of planet.extractor.blobs) {
      const blobPosition = getExtractorBlobPosition(planet, blob, now);
      const wobbleAlpha = 0.74 + Math.sin(now * 0.004 + blob.wobbleSeed * Math.PI * 2) * 0.12;
      this.graphics.fillStyle(0x67e8f9, wobbleAlpha);
      this.graphics.fillCircle(blobPosition.x, blobPosition.y, 10);
      this.graphics.lineStyle(1.5, 0xe0f2fe, wobbleAlpha * 0.75);
      this.graphics.strokeCircle(blobPosition.x, blobPosition.y, 10);
    }
  }
}

function pseudoRandom(seed: number): number {
  return Math.abs(Math.sin(seed * 43758.5453)) % 1;
}
