import Phaser from 'phaser';

import type { MatterImage, Vector, WeaponKind, WorldSize } from '../../model';
import { drawTractorBeam } from '../../services/tractorBeam';
import type { SceneWeaponPolicy } from '../../services/sceneWeaponPolicy';
import { Hud } from '../../ui/Hud';
import { WeaponMenu } from '../../ui/WeaponMenu';
import { createArcadeBackground, createArcadeGameOverText, drawShield, updateCameraShake, updatePlayerBlink } from './arcadeVisuals';

type PresentationState = {
  asteroids: number;
  fuel: number;
  invulnerableUntil: number;
  lives: number;
  playerAlive: boolean;
  primary: WeaponKind;
  projectiles: number;
  score: number;
  secondary: WeaponKind;
  shieldActive: boolean;
  timeDilation: boolean;
  tractorActive: boolean;
  wave: number;
};

export class ArcadePresentation {
  private readonly turret: Phaser.GameObjects.Line;
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly shield: Phaser.GameObjects.Graphics;
  private readonly hud: Hud;
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
    createArcadeBackground(scene, world);
    this.turret = scene.add.line(player.x, player.y, 0, 0, 0, -52, 0xffffff).setLineWidth(3, 3);
    this.beam = scene.add.graphics();
    this.shield = scene.add.graphics();
    this.hud = new Hud(scene);
    this.weaponMenu = new WeaponMenu(scene, weaponPolicy.allowedWeapons);
  }

  getSelectedWeapon(aim: Vector): WeaponKind {
    return this.weaponMenu.getSelected(aim);
  }

  update(now: number, aim: Vector, state: PresentationState): void {
    this.updateTurret(aim, state.playerAlive);
    drawTractorBeam(this.beam, this.player, aim, state.tractorActive);
    drawShield(this.shield, this.player, state.shieldActive, state.playerAlive && state.fuel > 0);
    this.weaponMenu.draw(this.player, aim, state.primary, state.secondary, state.timeDilation);
    updatePlayerBlink(this.player, state.playerAlive, state.invulnerableUntil, now);
    this.shakeIntensity = updateCameraShake(
      this.scene.cameras.main,
      now,
      this.shakeUntil,
      this.shakeIntensity,
    ).shakeIntensity;
    this.hud.update({
      asteroids: state.asteroids,
      fuel: state.fuel,
      lives: state.lives,
      primary: state.primary,
      projectiles: state.projectiles,
      score: state.score,
      secondary: state.secondary,
      timeDilation: state.timeDilation,
      wave: state.wave,
    });
  }

  startShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeUntil = Math.max(this.shakeUntil, this.scene.time.now + durationMs);
  }

  showGameOver(world: WorldSize): void {
    if (this.gameOverText) return;
    this.gameOverText = createArcadeGameOverText(this.scene, world);
  }

  private updateTurret(aim: Vector, playerAlive: boolean): void {
    this.turret.setVisible(playerAlive);
    this.turret.setPosition(this.player.x, this.player.y);
    this.turret.setRotation(Math.atan2(aim.y, aim.x) + Math.PI * 0.5);
  }
}
