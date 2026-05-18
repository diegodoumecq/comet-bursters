import Phaser from 'phaser';

import type { AsteroidEntity } from '../../asteroids/types';
import type { Vector } from '../../core/types';
import { PLAYER_TURRET_TEXTURE_KEY } from '../../player/textures';
import { renderPlayerFuel, renderPlayerShield, renderPlayerThruster, renderPlayerTurret } from '../../player/rendering';
import { Hud } from '../../ui/Hud';

export class DemoRenderer {
  private readonly playerTurret: Phaser.GameObjects.Image;
  private readonly playerShield: Phaser.GameObjects.Graphics;
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly playerThruster: Phaser.GameObjects.Graphics;
  private readonly hud: Hud;

  constructor(scene: Phaser.Scene, private readonly player: Phaser.Physics.Matter.Image) {
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
    aim: Vector;
    asteroids: AsteroidEntity[];
    now: number;
  }): void {
    renderPlayerThruster(this.playerThruster, this.player, input.aim, true, false);
    renderPlayerTurret(this.player, this.playerTurret, input.aim, true);
    renderPlayerFuel(this.playerFuelBase, this.playerFuelFill, this.playerFuelMask, this.player, 100, input.now, true);
    renderPlayerShield(this.playerShield, this.player, false, 100, true);
    this.hud.update({
      asteroids: input.asteroids.length,
      projectiles: 0,
      timeDilation: false,
    });
  }
}
