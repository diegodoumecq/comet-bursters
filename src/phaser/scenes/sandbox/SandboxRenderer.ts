import Phaser from 'phaser';

import type { Vector } from '../../core/types';
import { getPlayerVisible, renderPlayerFuel, renderPlayerShield, renderPlayerThruster, renderPlayerTurret } from '../../player/rendering';
import type { PlayerState } from '../../player/state';
import type { ShipState } from '../../player/shipState';
import { PLAYER_TURRET_TEXTURE_KEY } from '../../player/textures';
import { Hud } from '../../ui/Hud';
import { WeaponMenu } from '../../ui/WeaponMenu';
import type { SceneWeaponPolicy } from '../../weapons/scenePolicy';
import { drawTractorBeam } from '../../weapons/tractorBeam';
import type { WeaponKind } from '../../weapons/types';
import type { WorldSize } from '../../core/types';
import type { SandboxDiscovery } from './discovery';
import { SandboxBackground } from './SandboxBackground';
import { SandboxMinimap } from './SandboxMinimap';
import { SandboxPlanetOverlay } from './SandboxPlanetOverlay';
import type { SandboxPlanetEntity } from './planetFuel';

export class SandboxRenderer {
  private readonly background: SandboxBackground;
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly playerTurret: Phaser.GameObjects.Image;
  private readonly playerShield: Phaser.GameObjects.Graphics;
  private readonly playerFuelBase: Phaser.GameObjects.Graphics;
  private readonly playerFuelFill: Phaser.GameObjects.Graphics;
  private readonly playerFuelMask: Phaser.GameObjects.Graphics;
  private readonly playerThruster: Phaser.GameObjects.Graphics;
  private readonly hud: Hud;
  private readonly weaponMenu: WeaponMenu;
  private readonly minimap: SandboxMinimap;
  private readonly planetOverlay: SandboxPlanetOverlay;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Matter.Image,
    weaponPolicy: SceneWeaponPolicy,
    world: WorldSize,
  ) {
    this.background = new SandboxBackground(scene, world);
    this.beam = scene.add.graphics();
    this.playerTurret = scene.add.image(player.x, player.y, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.playerShield = scene.add.graphics();
    this.playerFuelBase = scene.add.graphics().setDepth(2);
    this.playerFuelFill = scene.add.graphics().setDepth(2);
    this.playerFuelMask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.playerFuelFill.setMask(this.playerFuelMask.createGeometryMask());
    this.playerThruster = scene.add.graphics().setDepth(0);
    this.hud = new Hud(scene);
    this.weaponMenu = new WeaponMenu(scene, weaponPolicy.allowedWeapons);
    this.minimap = new SandboxMinimap(scene);
    this.planetOverlay = new SandboxPlanetOverlay(scene);
  }

  getSelectedWeapon(aim: Vector): WeaponKind {
    return this.weaponMenu.getSelected(aim);
  }

  setPlayerDocked(docked: boolean): void {
    const playerDepth = docked ? 1 : 6;
    this.player.setDepth(playerDepth);
    this.playerThruster.setDepth(playerDepth - 1);
    this.playerFuelBase.setDepth(playerDepth + 1);
    this.playerFuelFill.setDepth(playerDepth + 1);
    this.playerTurret.setDepth(playerDepth + 2);
    this.playerShield.setDepth(playerDepth + 2);
  }

  render(input: {
    asteroidCount: number;
    now: number;
    player: PlayerState;
    projectileCount: number;
    shieldActive: boolean;
    ship: ShipState;
    timeDilation: boolean;
    tractorActive: boolean;
    inspectionProbes: number;
    discovery: SandboxDiscovery;
    planets: SandboxPlanetEntity[];
    world: WorldSize;
  }): void {
    this.background.render();
    const visible = getPlayerVisible(input.player.visible, input.player.invulnerableUntil, input.now);
    renderPlayerThruster(this.playerThruster, this.player, input.player.lastThrustMove, input.ship.fuel > 0, visible && input.player.thrusting);
    renderPlayerTurret(this.player, this.playerTurret, input.player.lastAim, visible);
    renderPlayerFuel(this.playerFuelBase, this.playerFuelFill, this.playerFuelMask, this.player, input.ship.fuel, input.now, visible);
    renderPlayerShield(this.playerShield, this.player, input.shieldActive, input.ship.fuel, visible);
    drawTractorBeam(this.beam, this.player, input.player.lastAim, input.tractorActive);
    this.weaponMenu.draw(this.player, input.player.lastAim, input.ship.primaryWeapon, input.ship.secondaryWeapon, input.timeDilation);
    this.hud.update({
      asteroids: input.asteroidCount,
      fuel: input.ship.fuel,
      primary: input.ship.primaryWeapon,
      projectiles: input.projectileCount,
      secondary: input.ship.secondaryWeapon,
      probes: input.inspectionProbes,
      timeDilation: input.timeDilation,
    });
    this.minimap.render({
      camera: this.scene.cameras.main,
      discovery: input.discovery,
      planets: input.planets,
      player: input.player.position,
      playerAim: input.player.lastAim,
      world: input.world,
    });
    this.planetOverlay.render(input.planets, input.now);
  }
}
