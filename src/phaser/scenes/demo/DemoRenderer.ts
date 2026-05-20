import Phaser from 'phaser';

import type { AsteroidEntity } from '../../asteroids/types';
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

export class DemoRenderer {
  private readonly playerTurret: Phaser.GameObjects.Image;
  private readonly playerShield: Phaser.GameObjects.Graphics;
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly playerThruster: Phaser.GameObjects.Graphics;
  private readonly hud: Hud;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Matter.Image,
  ) {
    this.playerTurret = scene.add.image(player.x, player.y, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.playerShield = scene.add.graphics();
    this.playerFuelBase = scene.add.graphics().setDepth(2);
    this.playerFuelFill = scene.add.graphics().setDepth(2);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.playerThruster = scene.add.graphics().setDepth(0);
    this.hud = new Hud(scene);
  }

  render(input: {
    asteroids: AsteroidEntity[];
    now: number;
    player: PlayerState;
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
    this.hud.update({
      asteroids: input.asteroids.length,
      projectiles: 0,
      timeDilation: false,
    });
  }
}
