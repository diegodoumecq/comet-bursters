import Phaser from 'phaser';

import type { AsteroidBodies } from '../../asteroids/bodies';
import type { AsteroidEntity } from '../../asteroids/types';
import type { MatterImage, WorldSize } from '../../core/types';
import type { PlanetEntity } from '../../planets/types';
import {
  renderPlayerFuel,
  renderPlayerShield,
  renderPlayerThruster,
  renderPlayerTurret,
} from '../../player/rendering';
import type { ShipState } from '../../player/shipState';
import type { PlayerState } from '../../player/state';
import { PLAYER_TURRET_TEXTURE_KEY } from '../../player/textures';
import { Hud } from '../../ui/Hud';
import { Minimap } from '../../ui/Minimap';

export class DemoRenderer {
  private readonly playerTurret: Phaser.GameObjects.Image;
  private readonly playerShield: Phaser.GameObjects.Graphics;
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly playerThruster: Phaser.GameObjects.Graphics;
  private readonly collisionMasks: Phaser.GameObjects.Graphics;
  private readonly hud: Hud;
  private readonly minimap: Minimap;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Matter.Image,
    private readonly asteroidBodies: AsteroidBodies,
    private readonly world: WorldSize,
  ) {
    this.playerTurret = scene.add.image(player.x, player.y, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.playerShield = scene.add.graphics();
    this.playerFuelBase = scene.add.graphics().setDepth(2);
    this.playerFuelFill = scene.add.graphics().setDepth(2);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.playerThruster = scene.add.graphics().setDepth(0);
    this.collisionMasks = scene.add.graphics().setDepth(20);
    this.hud = new Hud(scene);
    this.minimap = new Minimap(scene);
  }

  render(input: {
    asteroids: AsteroidEntity[];
    now: number;
    player: PlayerState;
    planets: PlanetEntity[];
    ship: ShipState;
  }): void {
    renderPlayerThruster(
      this.playerThruster,
      this.player,
      input.player.lastThrustMove,
      input.ship.fuel > 0,
      input.player.thrusting,
    );
    renderPlayerTurret(this.player, this.playerTurret, input.player.lastAim, true);
    renderPlayerFuel(
      this.playerFuelBase,
      this.playerFuelFill,
      this.playerFuelMask,
      this.player,
      input.ship.fuel,
      input.now,
      true,
    );
    renderPlayerShield(this.playerShield, this.player, false, input.ship.fuel, true);
    this.renderCollisionMasks(input);
    this.minimap.render({
      asteroids: input.asteroids,
      camera: this.scene.cameras.main,
      planets: input.planets,
      player: input.player.position,
      playerAim: input.player.lastAim,
      viewportMode: 'bounded',
      world: this.world,
    });
    this.hud.update({
      asteroids: input.asteroids.length,
      projectiles: 0,
      timeDilation: false,
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
