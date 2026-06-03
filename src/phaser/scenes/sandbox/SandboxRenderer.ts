import Phaser from 'phaser';

import type { AsteroidEntity } from '../../asteroids/types';
import { withPerformanceMeasure } from '../../core/performance';
import type { Vector, WorldSize } from '../../core/types';
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
import { getSandboxPerfToggles } from '../../runtime/startup';
import { Minimap } from '../../ui/Minimap';
import { WeaponMenu } from '../../ui/WeaponMenu';
import type { SceneWeaponPolicy } from '../../weapons/scenePolicy';
import { drawTractorBeam } from '../../weapons/tractorBeam';
import type { WeaponKind } from '../../weapons/types';
import { MINIMAP_COLUMNS, MINIMAP_ROWS, type SandboxDiscovery } from './discovery';
import { NebulaRegionRenderer } from './NebulaRegionRenderer';
import type { NebulaRegion } from './nebulaRegions';
import type { SandboxPlanetEntity } from './planetFuel';
import { SandboxBackground } from './SandboxBackground';
import { SandboxBiomeDebugOverlay } from './SandboxBiomeDebugOverlay';
import type { SandboxBiomeRegion } from './biomeGeneration';
import { SandboxPlanetOverlay } from './SandboxPlanetOverlay';

const PLAYER_FUEL_HUD_DEPTH = 30;

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
    this.beam = scene.add.graphics();
    this.playerTurret = scene.add.image(player.x, player.y, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.playerShield = scene.add.graphics();
    this.playerFuelBase = scene.add.graphics().setDepth(PLAYER_FUEL_HUD_DEPTH);
    this.playerFuelFill = scene.add.graphics().setDepth(PLAYER_FUEL_HUD_DEPTH);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.playerThruster = scene.add.graphics().setDepth(0);
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
    tractorActive: boolean;
    inspectionProbes: number;
    discovery: SandboxDiscovery;
    fogEnabled: boolean;
    planets: SandboxPlanetEntity[];
    world: WorldSize;
  }): void {
    withPerformanceMeasure('sandbox.render.background', this.perfToggles.markers, () => {
      this.background.render(input.player.position, input.world, {
        grid: this.perfToggles.grid,
        markers: this.perfToggles.markers,
        starfield: this.perfToggles.starfield,
        threeBackground: this.perfToggles.threeBackground,
      });
    });
    if (this.perfToggles.nebulaRegions) {
      withPerformanceMeasure('sandbox.render.nebulaRegions', this.perfToggles.markers, () => {
        this.nebulaRegions.render({
          camera: this.scene.cameras.main,
          regions: this.sandboxNebulaRegions,
          screen: { width: this.scene.scale.width, height: this.scene.scale.height },
          world: input.world,
        });
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
    this.weaponMenu.draw(
      this.player,
      input.player.lastAim,
      input.ship.primaryWeapon,
      input.ship.secondaryWeapon,
      input.timeDilation,
    );
    this.minimap.setVisible(this.perfToggles.minimap);
    if (this.perfToggles.minimap) {
      withPerformanceMeasure('sandbox.render.minimap', this.perfToggles.markers, () => {
        this.minimap.render({
          asteroids: input.asteroids,
          biomeRegions: this.perfToggles.biomeDebug
            ? this.sandboxBiomes.filter((biome) => biome.source === 'generated')
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
      });
    }
    this.planetOverlay.render(input.planets, input.now);
    this.biomeDebug.render({
      biomes: this.sandboxBiomes,
      camera: this.scene.cameras.main,
      enabled: this.perfToggles.biomeDebug,
      world: input.world,
    });
  }
}
