import Phaser from 'phaser';

import type { MatterImage, Vector, WorldSize } from '../../core/types';
import type { ActionState } from '../../input/actions';
import {
  getPlayerVisible,
  renderPlayerFuel,
  renderPlayerShield,
  renderPlayerThruster,
  renderPlayerTurret,
} from '../../player/rendering';
import { PLAYER_TURRET_TEXTURE_KEY } from '../../player/textures';
import { WeaponMenu } from '../../ui/WeaponMenu';
import type { SceneWeaponPolicy } from '../../weapons/scenePolicy';
import { drawTractorBeam } from '../../weapons/tractorBeam';
import type { WeaponKind } from '../../weapons/types';
import type { ArcadeRunState } from './arcadeRunState';
import { ArcadeSpaceBackground } from './ArcadeSpaceBackground';
import { createArcadeGameOverText, updateCameraShake } from './arcadeVisuals';

export class ArcadeRenderer {
  private readonly background: ArcadeSpaceBackground;
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly playerTurret: Phaser.GameObjects.Image;
  private readonly playerShield: Phaser.GameObjects.Graphics;
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly playerThruster: Phaser.GameObjects.Graphics;
  private readonly weaponMenu: WeaponMenu;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private shakeUntil = 0;
  private shakeIntensity = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: MatterImage,
    world: WorldSize,
    weaponPolicy: SceneWeaponPolicy,
  ) {
    this.background = new ArcadeSpaceBackground(scene, world);
    this.beam = scene.add.graphics();
    this.playerTurret = scene.add.image(player.x, player.y, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.playerShield = scene.add.graphics();
    this.playerFuelBase = scene.add.graphics().setDepth(2);
    this.playerFuelFill = scene.add.graphics().setDepth(2);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.playerThruster = scene.add.graphics().setDepth(0);
    this.weaponMenu = new WeaponMenu(scene, weaponPolicy.allowedWeapons);
  }

  getSelectedWeapon(aim: Vector): WeaponKind {
    return this.weaponMenu.getSelected(aim);
  }

  render(now: number, session: ArcadeRunState, action: ActionState, tractorActive: boolean): void {
    this.background.render(now, session.player.velocity);
    const playerAlive = session.playerAlive;
    const playerVisible = getPlayerVisible(playerAlive, session.player.invulnerableUntil, now);
    renderPlayerThruster(
      this.playerThruster,
      this.player,
      session.player.lastThrustMove,
      session.ship.fuel > 0,
      playerVisible && session.player.thrusting,
    );
    renderPlayerTurret(this.player, this.playerTurret, session.player.lastAim, playerVisible);
    renderPlayerFuel(
      this.playerFuelBase,
      this.playerFuelFill,
      this.playerFuelMask,
      this.player,
      session.ship.fuel,
      now,
      playerVisible,
    );
    renderPlayerShield(
      this.playerShield,
      this.player,
      action.shield,
      session.ship.fuel,
      playerVisible,
    );
    drawTractorBeam(this.beam, this.player, session.player.lastAim, tractorActive);
    this.weaponMenu.draw(
      this.player,
      session.player.lastAim,
      session.ship.primaryWeapon,
      session.ship.secondaryWeapon,
      action.timeDilation,
    );
    this.shakeIntensity = updateCameraShake(
      this.scene.cameras.main,
      now,
      this.shakeUntil,
      this.shakeIntensity,
    ).shakeIntensity;
  }

  startShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeUntil = Math.max(this.shakeUntil, this.scene.time.now + durationMs);
  }

  showGameOver(world: WorldSize): void {
    if (this.gameOverText) return;
    this.gameOverText = createArcadeGameOverText(this.scene, world);
  }

  resize(world: WorldSize): void {
    this.background.resize(world);
  }
}
