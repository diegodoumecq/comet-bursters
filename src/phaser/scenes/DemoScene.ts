import { AsteroidBodies } from '../asteroids/bodies';
import { createAsteroid } from '../asteroids/logic';
import { createAsteroidTextures } from '../asteroids/textures';
import type { AsteroidEntity } from '../asteroids/types';
import type { WorldSize } from '../core/types';
import { ActionReader } from '../input/actions';
import { createPlanet, PLANET_SPECS } from '../planets/logic';
import type { PlanetEntity } from '../planets/types';
import { PlanetViews } from '../planets/views';
import { PlayerBody } from '../player/body';
import { PLAYER_MASS } from '../player/config';
import { updatePlayerMotion } from '../player/motion';
import { ShipState } from '../player/shipState';
import { PlayerState } from '../player/state';
import { createPlayerTexture } from '../player/textures';
import { normalize } from '../world/geometry';
import { BaseGameScene } from './BaseGameScene';
import { DemoRenderer } from './demo/DemoRenderer';

const WORLD: WorldSize = { width: 7600, height: 5000 };
export class PhaserDemoScene extends BaseGameScene {
  private actions!: ActionReader;
  private playerBody!: PlayerBody;
  private sceneRenderer!: DemoRenderer;
  private planets: PlanetEntity[] = [];
  private asteroids: AsteroidEntity[] = [];
  private asteroidBodies!: AsteroidBodies;
  private planetViews!: PlanetViews;
  private readonly playerState = new PlayerState();
  private readonly ship = new ShipState();

  constructor() {
    super('demo');
  }

  create(): void {
    this.matter.world.setBounds(0, 0, WORLD.width, WORLD.height, 64, true, true, true, true);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.actions = new ActionReader(this);
    this.asteroidBodies = new AsteroidBodies(this);
    this.planetViews = new PlanetViews(this);
    this.createGrid();
    this.createTextures();
    this.createPlanets();
    this.createAsteroids();
    this.playerBody = new PlayerBody(this, { x: 620, y: 760 }, this.playerState);
    this.playerBody.body.setMass(PLAYER_MASS);
    this.playerBody.body.setFrictionAir(0);
    this.playerBody.body.setBounce(0.8);
    this.sceneRenderer = new DemoRenderer(this, this.playerBody.body);
    this.cameras.main.startFollow(this.playerBody.body, true, 1, 1);
  }

  protected readFrameInput(): ReturnType<ActionReader['read']> {
    return this.actions.read(this.playerState.position);
  }

  protected updateState(
    action: ReturnType<ActionReader['read']>,
    _time: number,
    delta: number,
  ): void {
    const move = normalize(action.move);
    this.playerState.updateAim(normalize(action.aim));
    updatePlayerMotion({
      body: this.playerBody,
      deltaSeconds: delta / 1000,
      move,
      player: this.playerState,
      ship: this.ship,
      world: WORLD,
      wrap: false,
    });
  }

  protected renderState(_action: ReturnType<ActionReader['read']>, time: number): void {
    this.sceneRenderer.render({
      asteroids: this.asteroids,
      now: time,
      player: this.playerState,
      ship: this.ship,
    });
  }

  private createGrid(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1f2a44, 1);
    for (let x = 0; x <= WORLD.width; x += 120) graphics.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += 120) graphics.lineBetween(0, y, WORLD.width, y);
  }

  private createTextures(): void {
    createPlayerTexture(this);
    createAsteroidTextures(this);
  }

  private createPlanets(): void {
    const layouts: Array<[number, number, keyof typeof PLANET_SPECS]> = [
      [1150, 1050, 'lush'],
      [2200, 1000, 'desert'],
      [3250, 1050, 'ice'],
      [4700, 1350, 'lava'],
      [6250, 1650, 'gas'],
      [2250, 3400, 'toxic'],
      [3900, 3400, 'crystal'],
    ];
    this.planets = layouts.map(([x, y, kind]) => createPlanet(x, y, PLANET_SPECS[kind]));
    for (const planet of this.planets) this.planetViews.add(planet);
  }

  private createAsteroids(): void {
    const positions: Array<[number, number]> = [
      [1150, 4400],
      [2950, 4400],
      [4850, 4300],
      [6500, 4050],
    ];
    const tiers = ['mega', 'big', 'medium', 'small'] as const;
    this.asteroids = positions.map(([x, y], index) => {
      const asteroid = createAsteroid(tiers[index], { x, y }, { x: 0, y: 0 });
      this.asteroidBodies.add(asteroid).setStatic(true);
      return asteroid;
    });
  }
}
