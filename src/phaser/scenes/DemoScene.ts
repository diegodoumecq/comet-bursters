import { ActionReader } from '../input/actions';
import { createAsteroid } from '../asteroids/logic';
import { AsteroidBodies } from '../asteroids/bodies';
import { createAsteroidTextures } from '../asteroids/textures';
import { createPlayerTexture } from '../player/textures';
import { DemoRenderer } from './demo/DemoRenderer';
import type { AsteroidEntity } from '../asteroids/types';
import type { PlanetEntity } from '../planets/types';
import type { Vector, WorldSize } from '../core/types';
import { PlanetViews } from '../planets/views';
import { PlayerBody } from '../player/body';
import { PlayerState } from '../player/state';
import { BaseGameScene } from './BaseGameScene';

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

  protected updateState(_action: ReturnType<ActionReader['read']>, _time: number, _delta: number): void {}

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
    const layouts: Array<[number, number, number, number]> = [
      [980, 980, 130, 0x4ade80],
      [1660, 930, 150, 0xf59e0b],
      [2320, 1130, 120, 0x7dd3fc],
      [2940, 1560, 140, 0xa78bfa],
    ];
    this.planets = layouts.map(([x, y, radius, color], index) => ({
      color,
      gravityStrength: 0.5,
      id: index + 1,
      position: { x, y },
      radius,
    }));
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
