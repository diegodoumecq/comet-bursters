import Phaser from 'phaser';

import { withPerformanceMeasure } from '../../core/performance';
import type { MatterImage, Vector, WorldSize } from '../../core/types';
import type { PortalEntity } from '../../dimensions/types';
import type { ActionState } from '../../input/actions';
import {
  getPlayerVisible,
  renderPlayerFuel,
  renderPlayerShield,
  renderPlayerThruster,
  renderPlayerTurret,
} from '../../player/rendering';
import { fillPlayerHull, PLAYER_TURRET_TEXTURE_KEY, strokePlayerHull } from '../../player/textures';
import { PortalSceneCapture } from '../../portals/PortalSceneCapture';
import { PortalWindowRenderer } from '../../portals/PortalWindowRenderer';
import { getSandboxPerfToggles } from '../../runtime/startup';
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
  private readonly playerRiftSilhouette: Phaser.GameObjects.Graphics;
  private readonly perfToggles = getSandboxPerfToggles();
  private readonly riftRenderer: PortalWindowRenderer;
  private readonly sceneCapture: PortalSceneCapture;
  private readonly weaponMenu: WeaponMenu;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private playerInRift = false;
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
    this.playerRiftSilhouette = scene.add.graphics().setDepth(2.5);
    this.riftRenderer = new PortalWindowRenderer(scene, {
      height: world.height,
      width: world.width,
    });
    this.weaponMenu = new WeaponMenu(scene, weaponPolicy.allowedWeapons);
    this.sceneCapture = new PortalSceneCapture(scene, world, () => {
      const canvas = this.getBackgroundCanvas();
      return canvas ? [canvas] : [];
    });
  }

  getSelectedWeapon(aim: Vector): WeaponKind {
    return this.weaponMenu.getSelected(aim);
  }

  getBackgroundCanvas(): HTMLCanvasElement | null {
    if (!this.perfToggles.threeBackground) return null;
    return this.background.getCanvas();
  }

  captureTextureKey(): string {
    this.prepareBackgroundForCapture();
    const textureKey = this.sceneCapture.capture();
    this.background.hide();
    return textureKey;
  }

  addRift(portal: PortalEntity): void {
    this.riftRenderer.add(portal);
  }

  setRiftPortals(portals: PortalEntity[]): void {
    this.riftRenderer.setPortals(portals);
  }

  setPortalDestinationTextureKeyProvider(getDestinationTextureKey: () => string | null): void {
    this.riftRenderer.setDestinationTextureKeyProvider(getDestinationTextureKey);
  }

  setPlayerInRift(inRift: boolean): void {
    this.playerInRift = inRift;
  }

  render(
    now: number,
    session: ArcadeRunState,
    action: ActionState,
    tractorActive: boolean,
    backgroundVisible = true,
  ): void {
    withPerformanceMeasure('arcade.render.background', this.perfToggles.markers, () => {
      this.background.render(now, session.player.velocity, {
        grid: backgroundVisible && this.perfToggles.grid,
        markers: this.perfToggles.markers,
        starfield: backgroundVisible && this.perfToggles.starfield,
        threeBackground: backgroundVisible && this.perfToggles.threeBackground,
      });
    });
    const playerAlive = session.playerAlive;
    const playerVisible = getPlayerVisible(
      playerAlive && !this.playerInRift,
      session.player.invulnerableUntil,
      now,
    );
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
    this.renderRiftPlayerSilhouette(session, now);
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
    if (backgroundVisible) {
      this.riftRenderer.render(now);
    } else {
      this.riftRenderer.setVisible(false);
    }
  }

  private prepareBackgroundForCapture(): void {
    this.background.render(
      this.scene.time.now,
      { x: 0, y: 0 },
      {
        grid: this.perfToggles.grid,
        markers: this.perfToggles.markers,
        starfield: this.perfToggles.starfield,
        threeBackground: this.perfToggles.threeBackground,
      },
    );
  }

  startShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeUntil = Math.max(this.shakeUntil, this.scene.time.now + durationMs);
  }

  renderGameOver(input: { visible: boolean; world: WorldSize }): void {
    if (input.visible && !this.gameOverText) {
      this.gameOverText = createArcadeGameOverText(this.scene, input.world);
    }
    this.gameOverText?.setVisible(input.visible);
  }

  resize(world: WorldSize): void {
    this.background.resize(world);
    this.sceneCapture.resize(world);
    this.riftRenderer.resize({ height: world.height, width: world.width });
  }

  destroy(): void {
    this.riftRenderer.destroy();
    this.sceneCapture.destroy();
  }

  private renderRiftPlayerSilhouette(session: ArcadeRunState, now: number): void {
    this.playerRiftSilhouette.clear();
    if (!this.playerInRift || !session.playerAlive) return;
    if (!getPlayerVisible(true, session.player.invulnerableUntil, now)) return;

    const size = 30;
    const pulse = 0.55 + Math.sin(now / 220) * 0.18;
    this.playerRiftSilhouette.setPosition(session.player.position.x, session.player.position.y);
    this.playerRiftSilhouette.setRotation(session.player.rotation);
    this.playerRiftSilhouette.fillStyle(0x67e8f9, 0.1 + pulse * 0.12);
    fillPlayerHull(this.playerRiftSilhouette, size);
    this.playerRiftSilhouette.lineStyle(2, 0x67e8f9, 0.38 + pulse * 0.2);
    strokePlayerHull(this.playerRiftSilhouette, size);
    this.playerRiftSilhouette.lineStyle(1, 0xffffff, 0.16 + pulse * 0.1);
    strokePlayerHull(this.playerRiftSilhouette, size * 0.78);
    this.drawRiftPlayerSilhouetteTurret(session.player.lastAim, session.player.rotation, size);
  }

  private drawRiftPlayerSilhouetteTurret(aim: Vector, hullRotation: number, size: number): void {
    const magnitude = Math.hypot(aim.x, aim.y);
    const angle = magnitude > 0 ? Math.atan2(aim.y, aim.x) - hullRotation : 0;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    this.playerRiftSilhouette.lineStyle(3, 0x67e8f9, 0.32);
    this.playerRiftSilhouette.beginPath();
    this.playerRiftSilhouette.moveTo(direction.x * size * 0.12, direction.y * size * 0.12);
    this.playerRiftSilhouette.lineTo(direction.x * size * 0.86, direction.y * size * 0.86);
    this.playerRiftSilhouette.strokePath();
    this.playerRiftSilhouette.fillStyle(0x67e8f9, 0.28);
    this.playerRiftSilhouette.fillCircle(0, 0, size * 0.17);
  }
}
