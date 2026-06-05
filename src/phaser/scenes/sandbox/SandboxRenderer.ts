import Phaser from 'phaser';

import type { AsteroidEntity } from '../../asteroids/types';
import { startPerformanceFrame } from '../../core/performance';
import type { Vector, WorldSize } from '../../core/types';
import { PLAYER_COLLISION_RADIUS } from '../../player/config';
import {
  getPlayerVisible,
  renderPlayerFuel,
  renderPlayerShield,
  renderPlayerThruster,
  renderPlayerTurret,
} from '../../player/rendering';
import type { ShipState } from '../../player/shipState';
import type { PlayerState } from '../../player/state';
import { PLAYER_TURRET_TEXTURE_KEY } from '../../player/textures';
import { buildPlayerTrajectoryPreview } from '../../player/trajectory';
import { getSandboxPerfToggles } from '../../runtime/startup';
import { Minimap } from '../../ui/Minimap';
import { WeaponMenu } from '../../ui/WeaponMenu';
import type { SceneWeaponPolicy } from '../../weapons/scenePolicy';
import { drawTractorBeam } from '../../weapons/tractorBeam';
import type { WeaponKind } from '../../weapons/types';
import type { SandboxBiomeRegion } from './biomeGeneration';
import { MINIMAP_COLUMNS, MINIMAP_ROWS, type SandboxDiscovery } from './discovery';
import { NebulaRegionRenderer } from './NebulaRegionRenderer';
import type { NebulaRegion } from './nebulaRegions';
import type { SandboxPlanetEntity } from './planetFuel';
import { SandboxBackground } from './SandboxBackground';
import { SandboxBiomeDebugOverlay } from './SandboxBiomeDebugOverlay';
import { SandboxPlanetOverlay } from './SandboxPlanetOverlay';

const PLAYER_FUEL_HUD_DEPTH = 30;
const PLAYER_TRAJECTORY_PREVIEW_DEPTH = 4;
const PLAYER_TRAJECTORY_PREVIEW_COLOR = 0x7dd3fc;
const PLAYER_TRAJECTORY_PREVIEW_MIN_ALPHA = 0.1;
const PLAYER_TRAJECTORY_PREVIEW_MAX_ALPHA = 0.82;

export class SandboxRenderer {
  private readonly background: SandboxBackground;
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly biomeDebug: SandboxBiomeDebugOverlay;
  private readonly nebulaRegions: NebulaRegionRenderer;
  private readonly playerTurret: Phaser.GameObjects.Image;
  private readonly playerShield: Phaser.GameObjects.Graphics;
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly playerThruster: Phaser.GameObjects.Graphics;
  private readonly playerTrajectoryPreview: Phaser.GameObjects.Graphics;
  private readonly weaponMenu: WeaponMenu;
  private readonly minimap: Minimap;
  private readonly planetOverlay: SandboxPlanetOverlay;
  private readonly perfToggles = getSandboxPerfToggles();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Matter.Image,
    weaponPolicy: SceneWeaponPolicy,
    world: WorldSize,
    private readonly sandboxNebulaRegions: NebulaRegion[],
    private readonly sandboxBiomes: SandboxBiomeRegion[],
  ) {
    this.background = new SandboxBackground(scene, world);
    this.biomeDebug = new SandboxBiomeDebugOverlay(scene);
    this.nebulaRegions = new NebulaRegionRenderer(scene);
    this.beam = scene.add.graphics().setName('sandbox-tractor-beam');
    this.playerTurret = scene.add.image(player.x, player.y, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.playerShield = scene.add.graphics().setName('sandbox-player-shield');
    this.playerFuelBase = scene.add
      .graphics()
      .setName('sandbox-player-fuel-base')
      .setDepth(PLAYER_FUEL_HUD_DEPTH);
    this.playerFuelFill = scene.add
      .graphics()
      .setName('sandbox-player-fuel-fill')
      .setDepth(PLAYER_FUEL_HUD_DEPTH);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelMask.setName('sandbox-player-fuel-mask');
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.playerThruster = scene.add.graphics().setName('sandbox-player-thruster').setDepth(0);
    this.playerTrajectoryPreview = scene.add
      .graphics()
      .setName('sandbox-player-trajectory-preview')
      .setDepth(PLAYER_TRAJECTORY_PREVIEW_DEPTH);
    this.weaponMenu = new WeaponMenu(scene, weaponPolicy.allowedWeapons);
    this.minimap = new Minimap(scene);
    this.planetOverlay = new SandboxPlanetOverlay(scene);
  }

  getSelectedWeapon(aim: Vector): WeaponKind {
    return this.weaponMenu.getSelected(aim);
  }

  getBackgroundCanvas(): HTMLCanvasElement | null {
    if (!this.perfToggles.threeBackground) return null;
    return this.background.getCanvas();
  }

  setPlayerDocked(docked: boolean): void {
    if (docked) {
      this.playerThruster.setDepth(-4);
      this.player.setDepth(-3.5);
      this.playerFuelBase.setDepth(PLAYER_FUEL_HUD_DEPTH);
      this.playerFuelFill.setDepth(PLAYER_FUEL_HUD_DEPTH);
      this.playerTurret.setDepth(-2.5);
      this.playerShield.setDepth(-2.5);
      this.playerTrajectoryPreview.clear();
      return;
    }
    this.player.setDepth(6);
    this.playerThruster.setDepth(5);
    this.playerFuelBase.setDepth(PLAYER_FUEL_HUD_DEPTH);
    this.playerFuelFill.setDepth(PLAYER_FUEL_HUD_DEPTH);
    this.playerTurret.setDepth(8);
    this.playerShield.setDepth(8);
  }

  render(input: {
    asteroidCount: number;
    asteroids: AsteroidEntity[];
    now: number;
    player: PlayerState;
    projectileCount: number;
    shieldActive: boolean;
    ship: ShipState;
    timeDilation: boolean;
    trajectoryPreviewActive: boolean;
    tractorActive: boolean;
    inspectionProbes: number;
    discovery: SandboxDiscovery;
    fogEnabled: boolean;
    planets: SandboxPlanetEntity[];
    world: WorldSize;
  }): void {
    const perf = startPerformanceFrame('sandbox.render.total', this.perfToggles.markers);
    try {
      perf.startSection('sandbox.render.background');
      this.background.render(input.player.position, input.world, {
        grid: this.perfToggles.grid,
        markers: this.perfToggles.markers,
        starfield: this.perfToggles.starfield,
        threeBackground: this.perfToggles.threeBackground,
      });

      perf.startSection('sandbox.render.nebulaRegions');
      if (this.perfToggles.nebulaRegions) {
        this.nebulaRegions.render({
          camera: this.scene.cameras.main,
          regions: this.sandboxNebulaRegions,
          screen: { width: this.scene.scale.width, height: this.scene.scale.height },
          world: input.world,
        });
      } else {
        this.nebulaRegions.render({
          camera: this.scene.cameras.main,
          regions: [],
          screen: { width: this.scene.scale.width, height: this.scene.scale.height },
          world: input.world,
        });
      }

      const visible = getPlayerVisible(
        input.player.visible,
        input.player.invulnerableUntil,
        input.now,
      );

      perf.startSection('sandbox.render.trajectoryPreview');
      this.renderPlayerTrajectoryPreview(
        input,
        this.perfToggles.trajectoryPreview && visible && input.trajectoryPreviewActive,
      );

      perf.startSection('sandbox.render.playerHud');
      this.renderPlayerHud(input, visible);

      perf.startSection('sandbox.render.weaponMenu');
      this.weaponMenu.draw(
        this.player,
        input.player.lastAim,
        input.ship.primaryWeapon,
        input.ship.secondaryWeapon,
        input.timeDilation,
      );

      this.minimap.setVisible(this.perfToggles.minimap);
      if (this.perfToggles.minimap) {
        perf.startSection('sandbox.render.minimap');
        this.minimap.render({
          asteroids: input.asteroids,
          biomeRegions: this.perfToggles.biomeDebug
            ? this.sandboxBiomes
                .filter((biome) => biome.source === 'generated')
                .map((biome) => ({
                  color: biome.profile.color,
                  points: biome.points,
                }))
            : undefined,
          camera: this.scene.cameras.main,
          fog: input.fogEnabled
            ? {
                columns: MINIMAP_COLUMNS,
                discoveredPlanetIds: input.discovery.discoveredPlanetIds,
                exploredCells: input.discovery.exploredCells,
                rows: MINIMAP_ROWS,
                visibleCells: input.discovery.visibleCells,
              }
            : undefined,
          nebulaRegions: this.sandboxNebulaRegions,
          planets: input.planets,
          player: input.player.position,
          playerAim: input.player.lastAim,
          viewportMode: 'wrapped',
          world: input.world,
        });
      }

      perf.startSection('sandbox.render.overlays');
      this.planetOverlay.render(input.planets, input.now);
      this.biomeDebug.render({
        biomes: this.sandboxBiomes,
        camera: this.scene.cameras.main,
        enabled: this.perfToggles.biomeDebug,
        world: input.world,
      });
    } finally {
      perf.end();
    }
  }

  private renderPlayerTrajectoryPreview(
    input: {
      planets: SandboxPlanetEntity[];
      player: PlayerState;
      world: WorldSize;
    },
    active: boolean,
  ): void {
    this.playerTrajectoryPreview.clear();
    if (!active) return;

    const preview = buildPlayerTrajectoryPreview({
      planets: input.planets,
      playerRadius: PLAYER_COLLISION_RADIUS * input.player.scale,
      position: input.player.position,
      velocity: input.player.velocity,
      world: input.world,
    });
    if (!preview) return;

    let previous = input.player.position;
    for (let i = 0; i < preview.points.length; i += 1) {
      const fade = 1 - i / preview.points.length;
      const alpha =
        (PLAYER_TRAJECTORY_PREVIEW_MIN_ALPHA +
          (PLAYER_TRAJECTORY_PREVIEW_MAX_ALPHA - PLAYER_TRAJECTORY_PREVIEW_MIN_ALPHA) *
            fade *
            fade) *
        preview.alphaScale;
      const point = preview.points[i];
      this.playerTrajectoryPreview.lineStyle(2, PLAYER_TRAJECTORY_PREVIEW_COLOR, alpha);
      this.playerTrajectoryPreview.beginPath();
      this.playerTrajectoryPreview.moveTo(previous.x, previous.y);
      this.playerTrajectoryPreview.lineTo(point.x, point.y);
      this.playerTrajectoryPreview.strokePath();
      previous = point;
    }
  }

  private renderPlayerHud(
    input: {
      now: number;
      player: PlayerState;
      shieldActive: boolean;
      ship: ShipState;
      tractorActive: boolean;
    },
    visible: boolean,
  ): void {
    if (this.perfToggles.playerHud) {
      renderPlayerThruster(
        this.playerThruster,
        this.player,
        input.player.lastThrustMove,
        input.ship.fuel > 0,
        visible && input.player.thrusting,
      );
      renderPlayerTurret(this.player, this.playerTurret, input.player.lastAim, visible);
      renderPlayerFuel(
        this.playerFuelBase,
        this.playerFuelFill,
        this.playerFuelMask,
        this.player,
        input.ship.fuel,
        input.now,
        visible,
      );
      renderPlayerShield(
        this.playerShield,
        this.player,
        input.shieldActive,
        input.ship.fuel,
        visible,
      );
      drawTractorBeam(this.beam, this.player, input.player.lastAim, input.tractorActive);
      return;
    }

    this.player.setVisible(visible);
    this.playerTurret.setVisible(visible);
    this.playerFuelBase.setVisible(false);
    this.playerFuelFill.setVisible(false);
    this.playerFuelMask.setVisible(false);
    this.playerShield.clear();
    this.playerThruster.clear();
    this.beam.clear();
  }
}
