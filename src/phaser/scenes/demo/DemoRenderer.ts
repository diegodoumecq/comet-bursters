import Phaser from 'phaser';

import type { AsteroidBodies } from '../../asteroids/bodies';
import type { AsteroidEntity } from '../../asteroids/types';
import type { MatterImage, WorldSize } from '../../core/types';
import type { PlanetEntity } from '../../planets/types';
import { renderPlayerFuel } from '../../player/rendering';
import type { ShipState } from '../../player/shipState';
import type { PlayerState } from '../../player/state';
import { Minimap } from '../../ui/Minimap';

export class DemoRenderer {
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly collisionMasks: Phaser.GameObjects.Graphics;
  private readonly minimap: Minimap;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Matter.Image,
    private readonly asteroidBodies: AsteroidBodies,
    private readonly world: WorldSize,
  ) {
    this.playerFuelBase = scene.add.graphics().setDepth(2);
    this.playerFuelFill = scene.add.graphics().setDepth(2);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.collisionMasks = scene.add.graphics().setDepth(20);
    this.minimap = new Minimap(scene);
  }

  render(input: {
    asteroids: AsteroidEntity[];
    now: number;
    player: PlayerState;
    planets: PlanetEntity[];
    ship: ShipState;
  }): void {
    renderPlayerFuel(
      this.playerFuelBase,
      this.playerFuelFill,
      this.playerFuelMask,
      this.player,
      input.ship.fuel,
      input.now,
      true,
    );
    this.renderCollisionMasks(input);
    this.minimap.render({
      asteroids: input.asteroids,
      camera: this.scene.cameras.main,
      planets: input.planets,
      player: input.player.position,
      playerRotation: input.player.rotation,
      playerVelocity: input.player.velocity,
      viewportMode: 'bounded',
      world: this.world,
    });
  }

  private renderCollisionMasks(input: {
    asteroids: AsteroidEntity[];
    planets: PlanetEntity[];
  }): void {
    this.collisionMasks.clear();
    this.collisionMasks.lineStyle(2, 0xffffff, 0.9);
    this.strokeMatterBody(this.player as MatterImage);
    for (const asteroid of input.asteroids) {
      this.strokeMatterBody(this.asteroidBodies.get(asteroid));
    }
    for (const planet of input.planets) {
      this.collisionMasks.strokeCircle(planet.position.x, planet.position.y, planet.radius);
    }
  }

  private strokeMatterBody(target: MatterImage): void {
    const vertices = target.body.vertices;
    if (!vertices || vertices.length < 2) return;
    this.collisionMasks.beginPath();
    this.collisionMasks.moveTo(vertices[0].x, vertices[0].y);
    for (let index = 1; index < vertices.length; index += 1) {
      this.collisionMasks.lineTo(vertices[index].x, vertices[index].y);
    }
    this.collisionMasks.closePath();
    this.collisionMasks.strokePath();
  }
}
