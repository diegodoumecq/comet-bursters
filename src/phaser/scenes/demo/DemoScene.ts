import { AsteroidBodies } from '../../asteroids/bodies';
import { getGameAudio } from '../../audio/AudioManager';
import type { SceneAudioDirector } from '../../audio/SceneAudioDirector';
import { ASTEROIDS, createAsteroid } from '../../asteroids/logic';
import { ASTEROID_TEXTURES, createAsteroidTextures } from '../../asteroids/textures';
import type { AsteroidEntity } from '../../asteroids/types';
import { applyMatterBodySpec } from '../../core/matterBodySpec';
import type { WorldSize } from '../../core/types';
import { MAX_FUEL } from '../../fuel/rules';
import { ActionReader } from '../../input/actions';
import { createPlanet, PLANET_SPECS } from '../../planets/logic';
import type { PlanetEntity } from '../../planets/types';
import { PlanetViews } from '../../planets/views';
import { PlayerBody } from '../../player/body';
import { PLAYER_DEFINITIONS } from '../../player/definition';
import { updatePlayerMotion } from '../../player/motion';
import { ShipState } from '../../player/shipState';
import { PlayerState } from '../../player/state';
import { createPlayerTexture } from '../../player/textures';
import { normalize } from '../../world/geometry';
import { BaseGameScene } from '../BaseGameScene';
import { DemoRenderer } from './DemoRenderer';

const WORLD: WorldSize = { width: 5000, height: 5000 };
const DEMO_PLAYER_ACCELERATION = 2880;
const DEMO_PLAYER_MAX_SPEED = 42;
const DEMO_PLANET_ROW_START = { x: 520, y: 1180 };
const DEMO_PLANET_GAP = 110;
const DEMO_SHOWCASE_ROTATION = 0;
const DEMO_PLANET_ROTATION_SPEED = 0.00008;

export class PhaserDemoScene extends BaseGameScene {
  private actions!: ActionReader;
  private playerBody!: PlayerBody;
  private sceneRenderer!: DemoRenderer;
  private planets: PlanetEntity[] = [];
  private asteroids: AsteroidEntity[] = [];
  private asteroidBodies!: AsteroidBodies;
  private planetViews!: PlanetViews;
  private audioDirector!: SceneAudioDirector;
  private readonly playerState = new PlayerState();
  private readonly ship = new ShipState();

  constructor() {
    super('demo');
  }

  create(): void {
    this.audioDirector = getGameAudio(this).createSceneDirector(this, 'demo');
    this.audioDirector.enter();
    this.events.once('shutdown', () => this.audioDirector.exit());
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
    applyMatterBodySpec(this.playerBody.body, PLAYER_DEFINITIONS.demo.body);
    this.sceneRenderer = new DemoRenderer(this, this.playerBody.body, this.asteroidBodies, WORLD);
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
      tuning: {
        acceleration: DEMO_PLAYER_ACCELERATION,
        maxSpeed: DEMO_PLAYER_MAX_SPEED,
      },
      world: WORLD,
      wrap: false,
    });
    this.ship.setFuel(MAX_FUEL);
    this.updatePlanets(delta);
  }

  protected renderState(_action: ReturnType<ActionReader['read']>, time: number): void {
    this.audioDirector.update({
      playerSpeed: Math.hypot(this.playerState.velocity.x, this.playerState.velocity.y),
    });
    this.sceneRenderer.render({
      asteroids: this.asteroids,
      now: time,
      player: this.playerState,
      planets: this.planets,
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
    let nextLeft = DEMO_PLANET_ROW_START.x;
    let nextTop = DEMO_PLANET_ROW_START.y;
    this.planets = Object.values(PLANET_SPECS).map((spec) => {
      const rawX = nextLeft + spec.radius * 1.5;
      if (rawX + spec.radius > WORLD.width) {
        nextLeft = DEMO_PLANET_ROW_START.x;
        nextTop += DEMO_PLANET_ROW_START.y;
      }
      const x = nextLeft + spec.radius * 1.5;
      nextLeft = x + spec.radius + DEMO_PLANET_GAP;
      const planet = createPlanet(x, nextTop, spec);
      planet.rotation = DEMO_SHOWCASE_ROTATION;
      planet.rotationSpeed = DEMO_PLANET_ROTATION_SPEED;
      return planet;
    });
    for (const planet of this.planets) {
      this.planetViews.add(planet);
      this.add
        .text(planet.position.x, planet.position.y + planet.radius * 1.1, planet.kind, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '16px',
        })
        .setOrigin(0.5);
    }
  }

  private createAsteroids(): void {
    const layouts = (Object.keys(ASTEROIDS) as Array<keyof typeof ASTEROIDS>).flatMap((tier, row) =>
      ASTEROID_TEXTURES[tier].map((_, visualVariant) => ({
        tier,
        visualVariant,
        x: 400 + visualVariant * 280,
        y: 1800 + row * 220,
      })),
    );
    this.asteroids = layouts.map(({ tier, visualVariant, x, y }) => {
      const asteroid = createAsteroid(tier, { x, y }, { x: 0, y: 0 });
      asteroid.visualVariant = visualVariant;
      asteroid.rotation = DEMO_SHOWCASE_ROTATION;
      asteroid.angularVelocity = 0;
      this.asteroidBodies.add(asteroid).setStatic(true);
      this.add
        .text(x, y + ASTEROIDS[tier].radius + 18, `${tier} / variant ${visualVariant}`, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '16px',
        })
        .setOrigin(0.5);
      return asteroid;
    });
  }

  private updatePlanets(deltaMs: number): void {
    for (const planet of this.planets) {
      planet.rotation += planet.rotationSpeed * deltaMs;
      this.planetViews.sync(planet);
    }
  }
}
