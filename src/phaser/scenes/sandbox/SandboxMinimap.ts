import Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import type { PlanetEntity } from '../../planets/types';
import { MINIMAP_COLUMNS, MINIMAP_ROWS, type SandboxDiscovery } from './discovery';

const WIDTH = 220;
const HEIGHT = 220;
const PADDING = 20;

export class SandboxMinimap {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(200);
  }

  render(input: {
    camera: Phaser.Cameras.Scene2D.Camera;
    discovery: SandboxDiscovery;
    planets: PlanetEntity[];
    player: Vector;
    playerAim: Vector;
    world: WorldSize;
  }): void {
    const x = this.scene.scale.width - WIDTH - PADDING;
    const y = PADDING;
    const scaleX = WIDTH / input.world.width;
    const scaleY = HEIGHT / input.world.height;
    const cellWidth = WIDTH / MINIMAP_COLUMNS;
    const cellHeight = HEIGHT / MINIMAP_ROWS;

    this.graphics.clear();
    this.graphics.fillStyle(0x020617, 0.96);
    this.graphics.fillRect(x, y, WIDTH, HEIGHT);
    this.graphics.lineStyle(2, 0xffffff, 0.18);
    this.graphics.strokeRect(x, y, WIDTH, HEIGHT);

    for (let row = 0; row < MINIMAP_ROWS; row += 1) {
      for (let col = 0; col < MINIMAP_COLUMNS; col += 1) {
        const index = row * MINIMAP_COLUMNS + col;
        if (input.discovery.exploredCells[index]) {
          const alpha = input.discovery.visibleCells[index] ? 0.9 : 0.42;
          this.graphics.fillStyle(input.discovery.visibleCells[index] ? 0x102338 : 0x0a1322, alpha);
          this.graphics.fillRect(x + col * cellWidth, y + row * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
        }
      }
    }

    this.graphics.lineStyle(1, 0xffffff, 0.08);
    for (let index = 1; index < 4; index += 1) {
      const gridX = x + (WIDTH / 4) * index;
      const gridY = y + (HEIGHT / 4) * index;
      this.graphics.lineBetween(gridX, y, gridX, y + HEIGHT);
      this.graphics.lineBetween(x, gridY, x + WIDTH, gridY);
    }

    for (const planet of input.planets) {
      if (input.discovery.discoveredPlanetIds.has(planet.id)) {
        this.graphics.fillStyle(planet.color, 0.9);
        this.graphics.fillCircle(
          x + positiveModulo(planet.position.x, input.world.width) * scaleX,
          y + positiveModulo(planet.position.y, input.world.height) * scaleY,
          Math.max(3, planet.radius * scaleX),
        );
      }
    }

    this.drawWrappedViewport(input.camera, input.world, x, y, scaleX, scaleY);
    this.drawPlayer(input.player, input.playerAim, input.world, x, y, scaleX, scaleY);
  }

  private drawWrappedViewport(
    camera: Phaser.Cameras.Scene2D.Camera,
    world: WorldSize,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const boxX = positiveModulo(camera.scrollX, world.width) * scaleX;
    const boxY = positiveModulo(camera.scrollY, world.height) * scaleY;
    const boxWidth = Math.min(WIDTH, camera.width * scaleX);
    const boxHeight = Math.min(HEIGHT, camera.height * scaleY);
    this.graphics.lineStyle(1.5, 0xffffff, 0.72);
    for (const offsetX of [0, -WIDTH]) {
      for (const offsetY of [0, -HEIGHT]) {
        const drawX = x + boxX + offsetX;
        const drawY = y + boxY + offsetY;
        if (drawX < x + WIDTH && drawX + boxWidth > x && drawY < y + HEIGHT && drawY + boxHeight > y) {
          this.graphics.strokeRect(drawX, drawY, boxWidth, boxHeight);
        }
      }
    }
  }

  private drawPlayer(
    player: Vector,
    aim: Vector,
    world: WorldSize,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): void {
    const centerX = x + positiveModulo(player.x, world.width) * scaleX;
    const centerY = y + positiveModulo(player.y, world.height) * scaleY;
    const angle = Math.atan2(aim.y, aim.x);
    const size = 6;
    this.graphics.fillStyle(0xe0f2fe, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(centerX + Math.cos(angle) * size, centerY + Math.sin(angle) * size);
    this.graphics.lineTo(centerX + Math.cos(angle + 2.45) * size, centerY + Math.sin(angle + 2.45) * size);
    this.graphics.lineTo(centerX + Math.cos(angle - 2.45) * size, centerY + Math.sin(angle - 2.45) * size);
    this.graphics.closePath();
    this.graphics.fillPath();
  }
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
