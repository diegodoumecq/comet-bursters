import { AsteroidBodies } from '../../asteroids/bodies';
import { ASTEROIDS, createAsteroid } from '../../asteroids/logic';
import { ASTEROID_TEXTURES, createAsteroidTextures } from '../../asteroids/textures';
import type { AsteroidEntity, AsteroidTier } from '../../asteroids/types';
import { getGameAudio } from '../../audio/AudioManager';
import type { SceneAudioDirector } from '../../audio/SceneAudioDirector';
import { applyMatterBodySpec } from '../../core/matterBodySpec';
import type { WorldSize } from '../../core/types';
import type { PortalEntity } from '../../dimensions/types';
import { MAX_FUEL } from '../../fuel/rules';
import { ActionReader, type ActionState } from '../../input/actions';
import {
  createFuelExtractionPlanet,
  type FuelExtractionPlanetEntity,
} from '../../planets/fuelExtraction';
import { FuelExtractorViews } from '../../planets/fuelExtractorViews';
import { createPlanet, PLANET_SPECS } from '../../planets/logic';
import { PlanetViews } from '../../planets/views';
import { PlayerBody } from '../../player/body';
import { PLAYER_DEFINITIONS } from '../../player/definition';
import { updatePlayerMotion } from '../../player/motion';
import { ShipState } from '../../player/shipState';
import { PlayerState } from '../../player/state';
import { createPlayerTexture } from '../../player/textures';
import {
  BLACK_HOLE_GROWTH_DURATION_MS,
  BLACK_HOLE_MATURE_AFTER_MS,
  BLACK_HOLE_MATURE_RADIUS,
  BLACK_HOLE_RADIUS,
  BLACK_HOLE_SOURCE_OVERSCAN,
} from '../../projectiles/definition';
import type { ProjectileEntity } from '../../projectiles/types';
import { enableCanvasOverscan } from '../../runtime/canvasOverscan';
import { EntityBodies } from '../../entities/bodies';
import { createMonolith } from '../../entities/logic';
import { ENTITIES } from '../../entities/config';
import { createEntityTextures } from '../../entities/textures';
import type { GameEntity } from '../../entities/types';
import { normalize } from '../../world/geometry';
import { BaseGameScene } from '../BaseGameScene';
import { DemoRenderer } from './DemoRenderer';

const WORLD: WorldSize = { width: 5000, height: 5000 };
const DEMO_PLAYER_ACCELERATION = 2880;
const DEMO_PLAYER_MAX_SPEED = 42;
const DEMO_PLANET_ROW_START = { x: 520, y: 1180 };
const DEMO_PLANET_GAP = 110;
const DEMO_SHOWCASE_ROTATION = 0;
const DEMO_ASTEROID_ROTATION_SPEED = 0.00072;
const DEMO_PLANET_ROTATION_SPEED = 0.00008;
const DEMO_BLACK_HOLE_AGE_MS = BLACK_HOLE_MATURE_AFTER_MS + BLACK_HOLE_GROWTH_DURATION_MS;
const DEMO_BLACK_HOLE_LIFETIME_MS = Number.MAX_SAFE_INTEGER;

const DEMO_ASTEROID_TIER_ROTATION_SCALE: Record<AsteroidTier, number> = {
  big: 0.68,
  medium: 0.88,
  mega: 0.52,
  small: 1.12,
};

const DEMO_BLACK_HOLE_LAYOUTS: Array<{ id: number; mass: number; x: number; y: number }> = [
  { id: 1, mass: 1, x: 320, y: 520 },
  { id: 2, mass: 1.7, x: 820, y: 560 },
  { id: 3, mass: 2.4, x: 1160, y: 860 },
  { id: 4, mass: 1.3, x: 520, y: 1060 },
  { id: 5, mass: 2.1, x: 1420, y: 420 },
  { id: 6, mass: 1.5, x: 1900, y: 1320 },
  { id: 7, mass: 2.7, x: 2940, y: 2320 },
  { id: 8, mass: 1.9, x: 4040, y: 3520 },
];

const DEMO_PORTAL_LAYOUTS: Array<{
  id: number;
  normal: { x: number; y: number };
  viewPolicy: PortalEntity['viewPolicy'];
  x: number;
  y: number;
}> = [
  { id: 1, normal: { x: 1, y: 0.18 }, viewPolicy: 'window', x: 980, y: 620 },
  { id: 2, normal: { x: -0.38, y: 1 }, viewPolicy: 'cameraTransfer', x: 1120, y: 980 },
];

export class PhaserDemoScene extends BaseGameScene {
  private actions!: ActionReader;
  private playerBody!: PlayerBody;
  private sceneRenderer!: DemoRenderer;
  private planets: FuelExtractionPlanetEntity[] = [];
  private asteroids: AsteroidEntity[] = [];
  private entities: GameEntity[] = [];
  private blackHoles: ProjectileEntity[] = [];
  private portals: PortalEntity[] = [];
  private asteroidBodies!: AsteroidBodies;
  private entityBodies!: EntityBodies;
  private planetViews!: PlanetViews;
  private fuelExtractorViews!: FuelExtractorViews;
  private audioDirector!: SceneAudioDirector;
  private disposeCanvasOverscan: (() => void) | null = null;
  private readonly playerState = new PlayerState();
  private readonly ship = new ShipState();

  constructor() {
    super('demo');
  }

  create(): void {
    this.disposeCanvasOverscan = enableCanvasOverscan(this.game, BLACK_HOLE_SOURCE_OVERSCAN);
    this.audioDirector = getGameAudio(this).createSceneDirector(this, 'demo');
    this.audioDirector.enter();
    this.events.once('shutdown', () => {
      this.disposeCanvasOverscan?.();
      this.disposeCanvasOverscan = null;
      this.audioDirector.exit();
      this.sceneRenderer.destroy();
      this.fuelExtractorViews.destroy();
    });
    this.matter.world.setBounds(0, 0, WORLD.width, WORLD.height, 64, true, true, true, true);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.actions = new ActionReader(this);
    this.asteroidBodies = new AsteroidBodies(this);
    this.entityBodies = new EntityBodies(this);
    this.planetViews = new PlanetViews(this);
    this.fuelExtractorViews = new FuelExtractorViews(this);
    this.createGrid();
    this.createTextures();
    this.createPlanets();
    this.createAsteroids();
    this.createBlackHoles();
    this.createEntities();
    this.createPortals();
    this.playerBody = new PlayerBody(this, { x: 620, y: 760 }, this.playerState);
    applyMatterBodySpec(this.playerBody.body, PLAYER_DEFINITIONS.demo.body);
    this.sceneRenderer = new DemoRenderer(
      this,
      this.playerBody.body,
      this.asteroidBodies,
      this.entityBodies,
      WORLD,
    );
    this.cameras.main.startFollow(this.playerBody.body, false, 1, 1);
  }

  protected readFrameInput(): ActionState {
    return this.actions.read(this.playerState.position);
  }

  protected updateState(action: ActionState, _time: number, delta: number): void {
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
    this.updateAsteroids(delta);
    this.updateEntities(delta);
    this.updatePlanets(delta);
  }

  protected renderState(_action: ActionState, time: number): void {
    this.audioDirector.update({
      playerSpeed: Math.hypot(this.playerState.velocity.x, this.playerState.velocity.y),
    });
    this.sceneRenderer.render({
      asteroids: this.asteroids,
      blackHoles: this.blackHoles,
      now: time,
      player: this.playerState,
      planets: this.planets,
      portals: this.portals,
      ship: this.ship,
      entities: this.entities,
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
    createEntityTextures(this);
  }

  private createPlanets(): void {
    let nextLeft = DEMO_PLANET_ROW_START.x;
    let nextTop = DEMO_PLANET_ROW_START.y;
    this.planets = Object.values(PLANET_SPECS).map((spec, index) => {
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
      return createFuelExtractionPlanet(planet, createDemoFuelExtractorRandom(index));
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
        x: 280 + (visualVariant % 6) * 240,
        y: 1800 + row * 360 + Math.floor(visualVariant / 6) * 150,
      })),
    );
    this.asteroids = layouts.map(({ tier, visualVariant, x, y }) => {
      const asteroid = createAsteroid(tier, { x, y }, { x: 0, y: 0 });
      asteroid.visualVariant = visualVariant;
      asteroid.rotation = DEMO_SHOWCASE_ROTATION;
      asteroid.angularVelocity = getDemoAsteroidAngularVelocity(tier, visualVariant);
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

  private createBlackHoles(): void {
    this.blackHoles = DEMO_BLACK_HOLE_LAYOUTS.map((layout) => createPermanentDemoBlackHole(layout));
    for (const blackHole of this.blackHoles) {
      const radius = BLACK_HOLE_MATURE_RADIUS * Math.sqrt(blackHole.blackHoleMass ?? 1);
      this.add
        .text(blackHole.position.x, blackHole.position.y + radius + 18, 'black hole', {
          color: '#d8b4fe',
          fontFamily: 'monospace',
          fontSize: '16px',
        })
        .setOrigin(0.5);
    }
  }

  private createEntities(): void {
    const entity = createMonolith({ x: 100, y: 980 }, { x: 0, y: 0 });
    entity.rotation = DEMO_SHOWCASE_ROTATION;
    entity.angularVelocity = DEMO_ASTEROID_ROTATION_SPEED * 0.9;
    this.entities = [entity];
    this.entityBodies.add(entity);
    this.add
      .text(
        entity.position.x,
        entity.position.y + ENTITIES[entity.kind].size * 0.5 + 18,
        'monolith',
        {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '16px',
        },
      )
      .setOrigin(0.5);
  }

  private createPortals(): void {
    this.portals = DEMO_PORTAL_LAYOUTS.map((layout) => createPermanentDemoPortal(layout));
    for (const portal of this.portals) {
      this.add
        .text(portal.position.x, portal.position.y + portal.visualRadiusY + 20, 'portal', {
          color: portal.viewPolicy === 'cameraTransfer' ? '#93c5fd' : '#fbbf24',
          fontFamily: 'monospace',
          fontSize: '16px',
        })
        .setOrigin(0.5);
    }
  }

  private updateAsteroids(deltaMs: number): void {
    for (const asteroid of this.asteroids) {
      const angularVelocity = asteroid.angularVelocity;
      asteroid.rotation += angularVelocity * deltaMs;
      const body = this.asteroidBodies.get(asteroid);
      body.setRotation(asteroid.rotation);
      this.asteroidBodies.sync(asteroid);
      asteroid.angularVelocity = angularVelocity;
    }
  }

  private updateEntities(deltaMs: number): void {
    for (const entity of this.entities) {
      const angularVelocity = entity.angularVelocity;
      entity.rotation += angularVelocity * deltaMs;
      const body = this.entityBodies.get(entity);
      body.setRotation(entity.rotation);
      this.entityBodies.sync(entity);
      entity.angularVelocity = angularVelocity;
    }
  }

  private updatePlanets(deltaMs: number): void {
    for (const planet of this.planets) {
      planet.rotation += planet.rotationSpeed * deltaMs;
      this.planetViews.sync(planet);
    }
    this.fuelExtractorViews.sync(this.planets, this.time.now);
  }
}

function createPermanentDemoBlackHole(input: {
  id: number;
  mass: number;
  x: number;
  y: number;
}): ProjectileEntity {
  return {
    absorbedFuel: 0,
    ageMs: DEMO_BLACK_HOLE_AGE_MS,
    angle: 0,
    airResistance: 0,
    baseSpeed: 0,
    blackHoleMass: input.mass,
    collapseStartedAt: null,
    createdAt: 0,
    damage: 0,
    id: 10_000 + input.id,
    impact: 0,
    kind: 'blackHole',
    lifetimeMs: DEMO_BLACK_HOLE_LIFETIME_MS,
    position: { x: input.x, y: input.y },
    radius: BLACK_HOLE_RADIUS,
    velocity: { x: 0, y: 0 },
  };
}

function createPermanentDemoPortal(input: {
  id: number;
  normal: { x: number; y: number };
  viewPolicy: PortalEntity['viewPolicy'];
  x: number;
  y: number;
}): PortalEntity {
  return {
    activeDurationMs: DEMO_BLACK_HOLE_LIFETIME_MS,
    aperture: { radiusX: 116, radiusY: 168 },
    closeStartedAt: null,
    closingDurationMs: 1,
    id: 20_000 + input.id,
    lifecycle: 'active',
    normal: normalize(input.normal),
    openedAt: -1000,
    openingDurationMs: 1,
    position: { x: input.x, y: input.y },
    viewPolicy: input.viewPolicy,
    visualRadiusX: 116,
    visualRadiusY: 168,
  };
}

function getDemoAsteroidAngularVelocity(tier: AsteroidTier, visualVariant: number): number {
  const direction = visualVariant % 2 === 0 ? 1 : -1;
  return DEMO_ASTEROID_ROTATION_SPEED * DEMO_ASTEROID_TIER_ROTATION_SCALE[tier] * direction;
}

function createDemoFuelExtractorRandom(index: number) {
  const topArcAngle = 0.66 + (index % 5) * 0.045;
  const values = [topArcAngle, 0.72, (((index * 0.37 + 0.31) % 1) + 1) % 1];
  let nextIndex = 0;
  return {
    between: (min: number) => min,
    float: () => {
      const value = values[nextIndex % values.length];
      nextIndex += 1;
      return value;
    },
    floatBetween: (min: number, max: number) => min + (max - min) * values[0],
    pick: <T>(items: T[]) => items[index % items.length],
  };
}
