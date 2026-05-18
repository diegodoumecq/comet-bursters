import Phaser from 'phaser';

import type { PlanetEntity, Vector, WorldSize } from '../model';
import { ActionReader } from '../services/actions';
import { createAsteroid } from '../services/asteroids';
import { createAsteroidTextures } from '../services/asteroidTextures';
import { consumeThrustFuel, FUELLESS_THRUST_SCALE } from '../services/fuel';
import { PlayerFuelOverlay } from '../services/playerFuelOverlay';
import { createPlayerTexture, PLAYER_TURRET_TEXTURE_KEY } from '../services/playerTextures';
import { applyPlanetGravity } from '../services/gravity';
import { mainGameState } from '../services/mainGameState';
import { createSandboxPlanets } from './sandbox/sandboxPlanets';
import { PlayerRuntimeState } from '../services/playerRuntimeState';
import { ALL_WEAPONS, type SceneWeaponPolicy } from '../services/sceneWeaponPolicy';
import { getTimeScale } from '../services/time';
import { normalize, wrapPoint } from '../services/world';
import { Hud } from '../ui/Hud';

const WORLD: WorldSize = { width: 12000, height: 12000 };
const PLAYER_ACCELERATION = 1600;
const PLAYER_MAX_SPEED = 820;

export class PhaserSandboxScene extends Phaser.Scene {
  private actions!: ActionReader;
  private hud!: Hud;
  private player!: Phaser.Physics.Matter.Image;
  private fuelOverlay!: PlayerFuelOverlay;
  private turret!: Phaser.GameObjects.Image;
  private planets: PlanetEntity[] = [];
  private readonly runtime = new PlayerRuntimeState();
  private readonly ship = mainGameState.ship;
  private readonly weaponPolicy: SceneWeaponPolicy = { allowedWeapons: ALL_WEAPONS };
  private playerVelocity: Vector = { x: 0, y: 0 };

  constructor() {
    super('sandbox');
  }

  create(): void {
    this.actions = new ActionReader(this);
    this.createTextures();
    this.createBackground();
    this.planets = createSandboxPlanets(this, WORLD, 8);
    this.createReferenceAsteroids();
    this.player = this.matter.add.image(WORLD.width * 0.5, WORLD.height * 0.5, 'phaser-ship');
    this.player.setStatic(true);
    this.player.setCircle(18);
    this.fuelOverlay = new PlayerFuelOverlay(this, 2);
    this.turret = this.add.image(this.player.x, this.player.y, PLAYER_TURRET_TEXTURE_KEY).setDepth(3);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.hud = new Hud(this);
  }

  update(time: number, delta: number): void {
    const action = this.actions.read(this.player);
    const deltaSeconds = (delta / 1000) * getTimeScale(action.timeDilation);
    const aim = normalize(action.aim);
    const move = normalize(action.move);
    this.runtime.updateAim(aim);
    if (Math.hypot(move.x, move.y) > 0) {
      this.player.setRotation(Math.atan2(move.y, move.x) + Math.PI * 0.5);
    }

    const thrusting = Math.hypot(move.x, move.y) > 0;
    const nextFuel = consumeThrustFuel(this.ship.fuel, deltaSeconds, thrusting);
    const thrustScale = nextFuel > 0 ? 1 : FUELLESS_THRUST_SCALE;
    this.ship.setFuel(nextFuel);
    this.playerVelocity.x += move.x * PLAYER_ACCELERATION * thrustScale * deltaSeconds;
    this.playerVelocity.y += move.y * PLAYER_ACCELERATION * thrustScale * deltaSeconds;
    applyPlanetGravity(this.playerVelocity, this.player, this.planets, WORLD, deltaSeconds);
    const speed = Math.hypot(this.playerVelocity.x, this.playerVelocity.y);
    if (speed > PLAYER_MAX_SPEED) {
      this.playerVelocity.x = (this.playerVelocity.x / speed) * PLAYER_MAX_SPEED;
      this.playerVelocity.y = (this.playerVelocity.y / speed) * PLAYER_MAX_SPEED;
    }
    this.player.setPosition(
      this.player.x + this.playerVelocity.x * deltaSeconds,
      this.player.y + this.playerVelocity.y * deltaSeconds,
    );
    wrapPoint(this.player, WORLD);
    this.turret.setPosition(this.player.x, this.player.y);
    this.turret.setRotation(Math.atan2(this.runtime.lastAim.y, this.runtime.lastAim.x));
    this.fuelOverlay.update(this.player, this.ship.fuel, time);
    this.hud.update({
      asteroids: 4,
      fuel: this.ship.fuel,
      primary: this.weaponPolicy.allowedWeapons.includes(this.ship.primaryWeapon) ? this.ship.primaryWeapon : undefined,
      projectiles: 0,
      secondary: this.weaponPolicy.allowedWeapons.includes(this.ship.secondaryWeapon) ? this.ship.secondaryWeapon : undefined,
      timeDilation: action.timeDilation,
    });
  }

  private createBackground(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x152033, 0.9);
    for (let x = 0; x <= WORLD.width; x += 240) graphics.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += 240) graphics.lineBetween(0, y, WORLD.width, y);
  }

  private createTextures(): void {
    createPlayerTexture(this);
    createAsteroidTextures(this);
  }

  private createReferenceAsteroids(): void {
    createAsteroid(this, 'mega', { x: WORLD.width * 0.5 - 820, y: WORLD.height * 0.5 + 460 }, { x: 0, y: 0 });
    createAsteroid(this, 'big', { x: WORLD.width * 0.5 - 420, y: WORLD.height * 0.5 + 460 }, { x: 0, y: 0 });
    createAsteroid(this, 'medium', { x: WORLD.width * 0.5, y: WORLD.height * 0.5 + 460 }, { x: 0, y: 0 });
    createAsteroid(this, 'small', { x: WORLD.width * 0.5 + 320, y: WORLD.height * 0.5 + 460 }, { x: 0, y: 0 });
  }
}
