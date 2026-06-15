import Phaser from 'phaser';

import { createArcadeGameOverText, createArcadeTextures } from '../../../arcade/visuals';
import { AsteroidBodies } from '../../../asteroids/bodies';
import { getGameAudio } from '../../../audio/AudioManager';
import type { SceneAudioDirector } from '../../../audio/SceneAudioDirector';
import { MatterContacts } from '../../../combat/matterContacts';
import { applyMatterBodySpec } from '../../../core/matterBodySpec';
import type { Vector, WorldSize } from '../../../core/types';
import { DimensionDebugOverlay } from '../../../dimensions/DimensionDebugOverlay';
import type { RiftSpaceSceneBridge } from '../../../dimensions/RiftSpaceSceneBridge';
import { getDimensionCoordinator } from '../../../dimensions/runtime';
import type { PortalEntity } from '../../../dimensions/types';
import { FuelBodies } from '../../../fuel/bodies';
import type { ActionState } from '../../../input/actions';
import { ParticleViews } from '../../../particles/views';
import { PlayerBody } from '../../../player/body';
import { PLAYER_DEFINITIONS } from '../../../player/definition';
import {
  getPlayerVisible,
  renderPlayerFuel,
  renderPlayerShield,
  renderPlayerThruster,
  renderPlayerTurret,
} from '../../../player/rendering';
import type { ShipState } from '../../../player/shipState';
import type { PlayerState } from '../../../player/state';
import {
  fillPlayerHull,
  PLAYER_TURRET_TEXTURE_KEY,
  strokePlayerHull,
} from '../../../player/textures';
import { PortalSceneCapture } from '../../../portals/PortalSceneCapture';
import { PortalWindowRenderer } from '../../../portals/PortalWindowRenderer';
import { ProjectileBodies } from '../../../projectiles/bodies';
import { getSandboxPerfToggles } from '../../../runtime/startup';
import { EntityBodies } from '../../../entities/bodies';
import { createEntityTextures } from '../../../entities/textures';
import { DimensionBackground } from '../../../world/DimensionBackground';
import { SpaceRenderEffects } from '../../../world/SpaceRenderEffects';
import { SpaceWorldRuntime } from '../../../world/SpaceWorldRuntime';

export class PhaserRiftSpaceScene extends Phaser.Scene implements RiftSpaceSceneBridge {
  private background!: DimensionBackground;
  private destinationTextureKeyProvider: () => string | null = () => null;
  private portalRenderer!: PortalWindowRenderer;
  private readonly portals: PortalEntity[] = [];
  private dimensionDebug!: DimensionDebugOverlay;
  private renderEffects!: SpaceRenderEffects;
  private audioDirector!: SceneAudioDirector;
  private runtime!: SpaceWorldRuntime;
  private sceneCapture!: PortalSceneCapture;
  private playerFuelBase!: Phaser.GameObjects.Graphics;
  private playerFuelFill!: Phaser.GameObjects.Graphics;
  private playerFuelMask!: Phaser.GameObjects.Graphics;
  private playerShield!: Phaser.GameObjects.Graphics;
  private playerArcadeSilhouette!: Phaser.GameObjects.Graphics;
  private playerThruster!: Phaser.GameObjects.Graphics;
  private playerTurret!: Phaser.GameObjects.Image;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private activeView = false;
  private timeScale = 1;
  private worldSize!: WorldSize;
  private readonly perfToggles = getSandboxPerfToggles();

  constructor() {
    super('rift-space');
  }

  create(): void {
    this.audioDirector = getGameAudio(this).createSceneDirector(this, 'rift-space');
    this.worldSize = { width: this.scale.width, height: this.scale.height };
    createArcadeTextures(this);
    createEntityTextures(this);
    this.runtime = new SpaceWorldRuntime('rift', {
      asteroidBodies: new AsteroidBodies(this),
      contacts: new MatterContacts(this),
      createPlayerBody: (player) => this.createPlayerBody(player),
      fuelBodies: new FuelBodies(this),
      particleViews: new ParticleViews(this),
      projectileBodies: new ProjectileBodies(this),
      entityBodies: new EntityBodies(this),
    });
    getDimensionCoordinator().registerWorld(this.runtime);
    this.background = new DimensionBackground(this, this.worldSize, 'rift');
    this.renderEffects = new SpaceRenderEffects(
      this.game.canvas,
      this.game.canvas.parentElement,
      () => {
        const canvas = this.background.getCanvas();
        return canvas ? [canvas] : [];
      },
    );
    this.sceneCapture = new PortalSceneCapture(
      this,
      this.worldSize,
      () => {
        const canvas = this.background.getCanvas();
        return canvas ? [canvas] : [];
      },
      () => this.renderEffects.getCaptureCanvases(),
    );
    this.dimensionDebug = new DimensionDebugOverlay(this);
    this.portalRenderer = new PortalWindowRenderer(this, {
      height: this.worldSize.height,
      width: this.worldSize.width,
    });
    this.playerTurret = this.add.image(0, 0, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.playerShield = this.add.graphics();
    this.playerFuelBase = this.add.graphics().setDepth(2);
    this.playerFuelFill = this.add.graphics().setDepth(2);
    this.playerFuelMask = this.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.playerThruster = this.add.graphics().setDepth(0);
    this.playerArcadeSilhouette = this.add.graphics().setDepth(2.5);
    this.setPlayerOverlayVisible(false);
    this.portalRenderer.setDestinationTextureKeyProvider(() =>
      this.destinationTextureKeyProvider(),
    );
    this.setActiveView(false);
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  private createPlayerBody(player: PlayerState): PlayerBody {
    const body = new PlayerBody(this, player.position, player);
    applyMatterBodySpec(body.body, PLAYER_DEFINITIONS.arcade.body);
    return body;
  }

  update(time: number, delta: number): void {
    this.runtime.updateSceneEntities({
      deltaMs: delta * this.timeScale,
      deltaSeconds: (delta / 1000) * this.timeScale,
      worldSize: this.worldSize,
    });
    this.background.render(time, {
      grid: this.activeView && this.perfToggles.grid,
      starfield: this.activeView && this.perfToggles.starfield,
      threeBackground: this.activeView && this.perfToggles.threeBackground,
    });
    this.portalRenderer.setPortals(this.portals);
    if (this.activeView) {
      this.portalRenderer.render(time);
    } else {
      this.portalRenderer.setVisible(false);
    }
    if (this.activeView) {
      this.renderEffects.render(this.runtime.world, time, this.worldSize);
    } else {
      this.renderEffects.setVisible(false);
    }
  }

  captureTextureKey(): string {
    this.prepareBackgroundForCapture();
    this.renderEffects.prepareCaptureCanvases(this.runtime.world, this.time.now, this.worldSize);
    const textureKey = this.sceneCapture.capture();
    this.background.hide();
    if (!this.activeView) this.renderEffects.setVisible(false);
    return textureKey;
  }

  renderPlayerOverlay(input: {
    action: ActionState;
    alive: boolean;
    now: number;
    player: PlayerState;
    ship: ShipState;
  }): void {
    const playerBody = this.runtime.getPlayerBody();
    const visible = getPlayerVisible(
      this.activeView && input.alive && input.player.membership.space === 'rift' && !!playerBody,
      input.player.invulnerableUntil,
      input.now,
    );
    this.renderArcadePlayerSilhouette(input);
    if (!playerBody) {
      this.setPlayerOverlayVisible(false);
      return;
    }
    renderPlayerThruster(
      this.playerThruster,
      playerBody.body,
      input.player.lastThrustMove,
      input.ship.fuel > 0,
      visible && input.player.thrusting,
    );
    renderPlayerTurret(
      playerBody.body,
      this.playerTurret,
      input.player.lastAim,
      input.ship.primaryWeapon,
      visible,
    );
    renderPlayerFuel(
      this.playerFuelBase,
      this.playerFuelFill,
      this.playerFuelMask,
      playerBody.body,
      input.ship.fuel,
      input.now,
      visible,
    );
    renderPlayerShield(
      this.playerShield,
      playerBody.body,
      input.action.shield,
      input.ship.fuel,
      visible,
    );
  }

  renderDimensionDebug(input: { enabled: boolean }): void {
    this.dimensionDebug.render({
      enabled: input.enabled,
      runtime: this.runtime,
    });
  }

  setActiveView(active: boolean): void {
    if (active && !this.activeView) this.audioDirector.enter();
    if (!active && this.activeView) this.audioDirector.exit();
    this.activeView = active;
    this.cameras.main.visible = active;
    this.input.enabled = active;
    if (!active) {
      this.setPlayerOverlayVisible(false);
      this.playerArcadeSilhouette.clear();
    }
  }

  setPortalDestinationTextureKeyProvider(getDestinationTextureKey: () => string | null): void {
    this.destinationTextureKeyProvider = getDestinationTextureKey;
  }

  setPortals(portals: PortalEntity[]): void {
    this.portals.length = 0;
    this.portals.push(...portals);
  }

  setTimeScale(timeScale: number): void {
    this.timeScale = timeScale;
    this.matter.world.engine.timing.timeScale = timeScale;
  }

  renderGameOver(input: { visible: boolean; world: WorldSize }): void {
    if (input.visible && !this.gameOverText) {
      this.gameOverText = createArcadeGameOverText(this, input.world);
    }
    this.gameOverText?.setVisible(input.visible);
  }

  private prepareBackgroundForCapture(): void {
    this.background.render(this.time.now, {
      grid: this.perfToggles.grid,
      starfield: this.perfToggles.starfield,
      threeBackground: this.perfToggles.threeBackground,
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
    this.background.resize(this.worldSize);
    this.sceneCapture.resize(this.worldSize);
    this.portalRenderer.resize({ height: this.worldSize.height, width: this.worldSize.width });
  }

  private handleShutdown(): void {
    this.audioDirector.exit();
    this.scale.off('resize', this.handleResize, this);
    getDimensionCoordinator().unregisterWorld('rift', this.runtime);
    this.runtime.clearNonShipEntities();
    this.portalRenderer.destroy();
    this.dimensionDebug.destroy();
    this.playerTurret.destroy();
    this.playerShield.destroy();
    this.playerFuelBase.destroy();
    this.playerFuelFill.destroy();
    this.playerFuelMask.destroy();
    this.playerThruster.destroy();
    this.playerArcadeSilhouette.destroy();
    this.gameOverText?.destroy();
    this.renderEffects.dispose();
    this.sceneCapture.destroy();
  }

  private setPlayerOverlayVisible(visible: boolean): void {
    this.playerTurret.setVisible(visible);
    this.playerShield.setVisible(visible);
    this.playerFuelBase.setVisible(visible);
    this.playerFuelFill.setVisible(visible);
    this.playerFuelMask.setVisible(visible);
    this.playerThruster.setVisible(visible);
  }

  private renderArcadePlayerSilhouette(input: {
    alive: boolean;
    now: number;
    player: PlayerState;
  }): void {
    this.playerArcadeSilhouette.clear();
    if (!this.activeView || !input.alive || input.player.membership.space !== 'arcade') return;
    if (!getPlayerVisible(true, input.player.invulnerableUntil, input.now)) return;

    const size = 30;
    const pulse = 0.55 + Math.sin(input.now / 220) * 0.18;
    this.playerArcadeSilhouette.setPosition(input.player.position.x, input.player.position.y);
    this.playerArcadeSilhouette.setRotation(input.player.rotation);
    this.playerArcadeSilhouette.fillStyle(0xf97316, 0.1 + pulse * 0.12);
    fillPlayerHull(this.playerArcadeSilhouette, size);
    this.playerArcadeSilhouette.lineStyle(2, 0xf97316, 0.38 + pulse * 0.2);
    strokePlayerHull(this.playerArcadeSilhouette, size);
    this.playerArcadeSilhouette.lineStyle(1, 0xffffff, 0.16 + pulse * 0.1);
    strokePlayerHull(this.playerArcadeSilhouette, size * 0.78);
    this.drawArcadePlayerSilhouetteTurret(input.player.lastAim, input.player.rotation, size);
  }

  private drawArcadePlayerSilhouetteTurret(aim: Vector, hullRotation: number, size: number): void {
    const magnitude = Math.hypot(aim.x, aim.y);
    const angle = magnitude > 0 ? Math.atan2(aim.y, aim.x) - hullRotation : 0;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    this.playerArcadeSilhouette.lineStyle(3, 0xf97316, 0.32);
    this.playerArcadeSilhouette.beginPath();
    this.playerArcadeSilhouette.moveTo(direction.x * size * 0.12, direction.y * size * 0.12);
    this.playerArcadeSilhouette.lineTo(direction.x * size * 0.86, direction.y * size * 0.86);
    this.playerArcadeSilhouette.strokePath();
    this.playerArcadeSilhouette.fillStyle(0xf97316, 0.28);
    this.playerArcadeSilhouette.fillCircle(0, 0, size * 0.17);
  }
}
