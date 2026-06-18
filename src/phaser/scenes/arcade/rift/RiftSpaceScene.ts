import Phaser from 'phaser';

import { createArcadeGameOverText } from '../../../arcade/visuals';
import { AsteroidBodies } from '../../../asteroids/bodies';
import { ASTEROIDS } from '../../../asteroids/config';
import type { AsteroidEntity } from '../../../asteroids/types';
import { getGameAudio } from '../../../audio/AudioManager';
import type { SceneAudioDirector } from '../../../audio/SceneAudioDirector';
import { MatterContacts } from '../../../combat/matterContacts';
import { applyMatterBodySpec } from '../../../core/matterBodySpec';
import type { Vector, WorldSize } from '../../../core/types';
import { DimensionDebugOverlay } from '../../../dimensions/DimensionDebugOverlay';
import { normalizeVector } from '../../../dimensions/portalGeometry';
import type { RiftSpaceSceneBridge } from '../../../dimensions/RiftSpaceSceneBridge';
import { getDimensionCoordinator } from '../../../dimensions/runtime';
import type { PortalEntity, PortalViewPolicy } from '../../../dimensions/types';
import { EntityBodies } from '../../../entities/bodies';
import { createMonolith } from '../../../entities/logic';
import {
  createMonolithAsteroidId,
  MonolithRiftDirector,
  type MonolithRiftAttack,
} from '../../../entities/monolithRiftDirector';
import type { GameEntity } from '../../../entities/types';
import { FuelBodies } from '../../../fuel/bodies';
import type { ActionState } from '../../../input/actions';
import { ParticleViews } from '../../../particles/views';
import { PlayerBody } from '../../../player/body';
import { PLAYER_DEFINITIONS } from '../../../player/definition';
import {
  createPlayerHullVisual,
  getPlayerVisible,
  renderPlayerFuel,
  renderPlayerShield,
  renderPlayerThruster,
  renderPlayerTurret,
  type PlayerHullVisual,
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
import { DimensionBackground } from '../../../world/DimensionBackground';
import { SpaceRenderEffects } from '../../../world/SpaceRenderEffects';
import { SpaceWorldRuntime } from '../../../world/SpaceWorldRuntime';

const RIFT_MONOLITH_ID = 700_001;
const PORTAL_SEED_DEPTH = -1.75;
const MONOLITH_BASE_SPEED = 2.15;
const MONOLITH_TARGET_SPEED = 4.2;
const MONOLITH_STEER_FORCE_SCALE = 0.00008;
const MONOLITH_MAX_STEER_FORCE = 0.0085;

type GrowingAsteroid = {
  asteroid: AsteroidEntity;
  durationMs: number;
  initialScale: number;
  startedAt: number;
};

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
  private playerHull!: PlayerHullVisual;
  private playerTurret!: Phaser.GameObjects.Image;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private activeView = false;
  private timeScale = 1;
  private worldSize!: WorldSize;
  private riftMonolith: GameEntity | null = null;
  private monolithDirector = new MonolithRiftDirector();
  private readonly growingAsteroids: GrowingAsteroid[] = [];
  private readonly perfToggles = getSandboxPerfToggles();

  constructor() {
    super('rift-space');
  }

  create(): void {
    this.audioDirector = getGameAudio(this).createSceneDirector(this, 'rift-space');
    this.worldSize = { width: this.scale.width, height: this.scale.height };
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
    this.playerHull = createPlayerHullVisual(this, 0, 0, 2);
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
    this.ensureRiftMonolith();
    this.updateGrowingAsteroids(time);
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
    this.ensureRiftMonolith();
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
      this.playerHull,
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

  setMonolithRiftIntensity(initialIntensity: number): void {
    this.monolithDirector = new MonolithRiftDirector(initialIntensity);
  }

  updateMonolithRift(input: {
    activePortal: PortalEntity | null;
    forcePortal?: boolean;
    forcedViewPolicy?: PortalViewPolicy;
    now: number;
    playerPosition: Vector;
    portalId: number;
    world: WorldSize;
  }): { burstCount: number; portal: PortalEntity } | null {
    this.ensureRiftMonolith();
    const monolith = this.getRiftMonolith();
    const result = this.monolithDirector.update({
      activePortal: input.activePortal,
      forcePortal: input.forcePortal,
      forcedViewPolicy: input.forcedViewPolicy,
      monolith,
      now: input.now,
      playerPosition: input.playerPosition,
      portalId: input.portalId,
      world: input.world,
    });
    this.applyMonolithMovement(monolith, result.movementTarget, input.now);
    this.launchDueMonolithAsteroids(input.activePortal, input.now);
    if (!result.attack) return null;
    this.createPortalSeedBallVisuals(result.attack, monolith.position, input.now);
    return {
      burstCount: result.attack.burstCount,
      portal: result.attack.portal,
    };
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

  private ensureRiftMonolith(): void {
    const monolith = this.getRiftMonolith();
    const attached = this.runtime.world.entities.includes(monolith);
    if (!attached) {
      this.placeRiftMonolithAtSpawn(monolith);
      this.runtime.addEntities([monolith]);
    }
  }

  private getRiftMonolith(): GameEntity {
    if (!this.riftMonolith) {
      const position = this.getRiftMonolithPosition();
      this.riftMonolith = {
        ...createMonolith(position, { x: 0, y: 0 }),
        id: RIFT_MONOLITH_ID,
        membership: { space: 'rift' },
      };
    }
    return this.riftMonolith;
  }

  private placeRiftMonolithAtSpawn(monolith: GameEntity): void {
    const position = this.getRiftMonolithPosition();
    monolith.position = position;
    monolith.velocity = { x: 0, y: 0 };
  }

  private getRiftMonolithPosition(): Vector {
    return { x: this.worldSize.width * 0.5, y: this.worldSize.height * 0.5 };
  }

  private applyMonolithMovement(monolith: GameEntity, target: Vector, now: number): void {
    const body = this.runtime.getEntityBodies().get(monolith);
    const delta = {
      x: target.x - monolith.position.x,
      y: target.y - monolith.position.y,
    };
    const distance = Math.hypot(delta.x, delta.y);
    const direction =
      distance > 0.001 ? { x: delta.x / distance, y: delta.y / distance } : { x: 0, y: 0 };
    const tangent = { x: -direction.y, y: direction.x };
    const speed = Phaser.Math.Clamp(distance * 0.014, MONOLITH_BASE_SPEED, MONOLITH_TARGET_SPEED);
    const wobble = Math.sin(now * 0.0031 + monolith.id * 0.17) * 1.35;
    const velocity = {
      x: direction.x * speed + tangent.x * wobble,
      y: direction.y * speed + tangent.y * wobble,
    };
    const steering = {
      x: velocity.x - body.body.velocity.x,
      y: velocity.y - body.body.velocity.y,
    };
    const force = limitVector(
      {
        x: steering.x * body.body.mass * MONOLITH_STEER_FORCE_SCALE,
        y: steering.y * body.body.mass * MONOLITH_STEER_FORCE_SCALE,
      },
      MONOLITH_MAX_STEER_FORCE,
    );
    body.applyForce(new Phaser.Math.Vector2(force.x, force.y));
  }

  private createPortalSeedBallVisuals(
    attack: MonolithRiftAttack,
    monolithPosition: Vector,
    now: number,
  ): void {
    for (const seed of attack.seedBalls) {
      const direction = normalizeVector({
        x: seed.target.x - monolithPosition.x,
        y: seed.target.y - monolithPosition.y,
      });
      const start = {
        x: monolithPosition.x + direction.x * 48,
        y: monolithPosition.y + direction.y * 48,
      };
      const ball = this.add
        .circle(start.x, start.y, seed.radius, 0x01030a, 0.94)
        .setDepth(PORTAL_SEED_DEPTH);
      ball.setStrokeStyle(Math.max(1, seed.radius * 0.18), 0x38bdf8, 0.42);
      const duration = Math.max(140, seed.arrivalAt - now);
      this.tweens.add({
        alpha: 0.08,
        duration,
        ease: 'Cubic.easeOut',
        onComplete: () => ball.destroy(),
        scale: 0.36,
        targets: ball,
        x: seed.target.x,
        y: seed.target.y,
      });
    }
  }

  private launchDueMonolithAsteroids(activePortal: PortalEntity | null, now: number): void {
    const monolith = this.getRiftMonolith();
    const launches = this.monolithDirector.consumeDueAsteroidLaunches({
      monolithPosition: monolith.position,
      now,
      portal: activePortal,
    });
    if (launches.length === 0) return;
    const asteroids = launches.map(({ launch, position, velocity }) => {
      const asteroid: AsteroidEntity = {
        angularVelocity: launch.angularVelocity,
        hits: ASTEROIDS[launch.tier].hits,
        id: createMonolithAsteroidId(),
        membership: { space: 'rift' },
        position,
        rotation: launch.rotation,
        spawnScale: this.monolithDirector.getLaunchInitialScale(),
        tier: launch.tier,
        velocity,
        visualVariant: launch.visualVariant,
      };
      this.growingAsteroids.push({
        asteroid,
        durationMs: launch.scaleDurationMs,
        initialScale: asteroid.spawnScale ?? 1,
        startedAt: now,
      });
      return asteroid;
    });
    this.runtime.addAsteroids(asteroids);
  }

  private updateGrowingAsteroids(now: number): void {
    const activeGrowth: GrowingAsteroid[] = [];
    for (const growing of this.growingAsteroids) {
      const asteroidStillExists = this.runtime.world.asteroids.includes(growing.asteroid);
      if (asteroidStillExists) {
        const progress = Phaser.Math.Clamp((now - growing.startedAt) / growing.durationMs, 0, 1);
        if (progress >= 1) {
          delete growing.asteroid.spawnScale;
        } else {
          const eased = Phaser.Math.Easing.Cubic.Out(progress);
          growing.asteroid.spawnScale = Phaser.Math.Linear(growing.initialScale, 1, eased);
          activeGrowth.push(growing);
        }
      }
    }
    this.growingAsteroids.length = 0;
    this.growingAsteroids.push(...activeGrowth);
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
    this.playerHull.current.destroy();
    this.playerHull.next.destroy();
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
    this.playerHull.current.setVisible(visible);
    this.playerHull.next.setVisible(visible);
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

function limitVector(vector: Vector, maxLength: number): Vector {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= maxLength || length === 0) return vector;
  const scale = maxLength / length;
  return { x: vector.x * scale, y: vector.y * scale };
}
