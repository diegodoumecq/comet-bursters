import { AsteroidBodies } from '../asteroids/bodies';
import { createAsteroid } from '../asteroids/logic';
import { createAsteroidTextures } from '../asteroids/textures';
import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import { ActionReader } from '../input/actions';
import { createPlanet, PLANET_SPECS } from '../planets/logic';
import type { PlanetEntity } from '../planets/types';
import { PlanetViews } from '../planets/views';
import { PlayerBody } from '../player/body';
import { PlayerState } from '../player/state';
import { createPlayerTexture } from '../player/textures';
import { BaseGameScene } from './BaseGameScene';
import { DemoRenderer } from './demo/DemoRenderer';

const WORLD: WorldSize = { width: 4600, height: 3400 };
export class PhaserDemoScene extends BaseGameScene {
  private actions!: ActionReader;
  private playerBody!: PlayerBody;
  private sceneRenderer!: DemoRenderer;
  private planets: PlanetEntity[] = [];
  private asteroids: AsteroidEntity[] = [];
  private asteroidBodies!: AsteroidBodies;
  private planetViews!: PlanetViews;
  private lastAim: Vector = { x: 0, y: -1 };
  private readonly playerState = new PlayerState();

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
    this.playerBody.body.setStatic(true);
    this.playerBody.body.setMass(18);
    this.sceneRenderer = new DemoRenderer(this, this.playerBody.body);
    this.cameras.main.startFollow(this.playerBody.body, true, 0.08, 0.08);
  }

  protected readFrameInput(): ReturnType<ActionReader['read']> {
    return this.actions.read(this.playerState.position);
  }

  protected updateState(
    _action: ReturnType<ActionReader['read']>,
    _time: number,
    _delta: number,
  ): void {}

  protected renderState(_action: ReturnType<ActionReader['read']>, time: number): void {
    this.sceneRenderer.render({
      aim: this.lastAim,
      asteroids: this.asteroids,
      now: time,
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
      [980, 980, 'lush'],
      [1660, 930, 'desert'],
      [2320, 1130, 'ice'],
      [2940, 1560, 'crystal'],
    ];
    this.planets = layouts.map(([x, y, kind]) => createPlanet(x, y, PLANET_SPECS[kind]));
    for (const planet of this.planets) this.planetViews.add(planet);
  }

  private createAsteroids(): void {
    const positions: Array<[number, number]> = [
      [1100, 2620],
      [1940, 2740],
      [2820, 2650],
      [3660, 2480],
    ];
    const tiers = ['mega', 'big', 'medium', 'small'] as const;
    this.asteroids = positions.map(([x, y], index) => {
      const asteroid = createAsteroid(tiers[index], { x, y }, { x: 0, y: 0 });
      this.asteroidBodies.add(asteroid).setStatic(true);
      return asteroid;
    });
  }
}
