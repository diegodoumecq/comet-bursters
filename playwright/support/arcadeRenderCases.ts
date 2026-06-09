import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

export type ArcadeRenderCaseName =
  | 'asteroidWrap'
  | 'blackHole'
  | 'blackHoleMetaballs'
  | 'blackHoleWrap'
  | 'fullIntersection'
  | 'metaballs'
  | 'portalAsteroidCrossing'
  | 'portalBlackHoleCrossing'
  | 'shipWrap';

export type ArcadeRenderCaseExpectation = {
  activePortal?: boolean;
  arcadeAsteroids?: number;
  blackHoles?: number;
  fuelBlobs?: number;
  playerNearEdge?: boolean;
  wrappedAsteroids?: number;
  wrappedBlackHoles?: number;
};

export type ArcadeRenderCase = {
  expected: ArcadeRenderCaseExpectation;
  name: ArcadeRenderCaseName;
};

export type ArcadeRenderSummary = {
  activePortal: boolean;
  activeScenes: string[];
  arcadeAsteroids: number;
  blackHoles: number;
  domCanvases: Array<{
    height: number;
    visible: boolean;
    width: number;
  }>;
  fuelBlobs: number;
  player: {
    nearEdge: boolean;
    position: { x: number; y: number };
  };
  riftAsteroids: number;
  riftBlackHoles: number;
  sceneActive: boolean;
  toroidalAsteroidCopyCount: number;
  wrappedBlackHoleCount: number;
};

const artifactRoot = path.resolve(process.cwd(), 'artifacts/playwright');

export const ARCADE_RENDER_CASES: ArcadeRenderCase[] = [
  {
    expected: { blackHoles: 1 },
    name: 'blackHole',
  },
  {
    expected: { fuelBlobs: 8 },
    name: 'metaballs',
  },
  {
    expected: { blackHoles: 1, fuelBlobs: 8 },
    name: 'blackHoleMetaballs',
  },
  {
    expected: { arcadeAsteroids: 1, wrappedAsteroids: 1 },
    name: 'asteroidWrap',
  },
  {
    expected: { playerNearEdge: true },
    name: 'shipWrap',
  },
  {
    expected: { blackHoles: 1, wrappedBlackHoles: 1 },
    name: 'blackHoleWrap',
  },
  {
    expected: { activePortal: true, arcadeAsteroids: 1 },
    name: 'portalAsteroidCrossing',
  },
  {
    expected: { activePortal: true, blackHoles: 1 },
    name: 'portalBlackHoleCrossing',
  },
  {
    expected: {
      activePortal: true,
      arcadeAsteroids: 2,
      blackHoles: 2,
      fuelBlobs: 8,
      playerNearEdge: true,
      wrappedAsteroids: 1,
      wrappedBlackHoles: 1,
    },
    name: 'fullIntersection',
  },
];

export async function applyArcadeRenderCase(
  page: Page,
  caseName: ArcadeRenderCaseName,
): Promise<void> {
  await page.evaluate((scenarioName) => {
    type Vector = { x: number; y: number };
    type WorldSize = { height: number; width: number };
    type RuntimeLike = {
      addAsteroids: (asteroids: unknown[]) => void;
      addFuelBlobs: (blobs: unknown[]) => void;
      addProjectile: (projectile: unknown) => void;
      clearNonShipEntities: () => void;
      syncPreviousPositions?: () => void;
      world: {
        asteroids: unknown[];
        fuelBlobs: unknown[];
        particles: unknown[];
        projectiles: unknown[];
      };
    };
    type CoordinatorLike = {
      activePortal?: unknown;
      getWorld: (space: 'arcade' | 'rift') => RuntimeLike | null;
      openPortal: (plan: unknown) => void;
      pendingSpawnPlan?: unknown;
    };
    type ArcadeSceneLike = {
      dimensionCoordinator: CoordinatorLike;
      playerBody: {
        setPosition: (position: Vector) => void;
        setRotation: (rotation: number) => void;
        setVelocity: (velocity: Vector) => void;
      };
      runtime: RuntimeLike;
      session: {
        nextProjectileId: number;
        player: {
          invulnerableUntil: number;
          lastAim: Vector;
          lastThrustMove: Vector;
          membership: { space: 'arcade' | 'rift' };
          position: Vector;
          rotation: number;
          velocity: Vector;
        };
        ship: {
          setFuel?: (fuel: number) => void;
        };
      };
      time: {
        now: number;
      };
      worldSize: WorldSize;
    };
    type GameWindow = typeof window & {
      __arcadeRenderCaseApplied?: string;
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => ArcadeSceneLike;
        };
      };
    };

    const gameWindow = window as GameWindow;
    const arcade = gameWindow.__cometBurstersGame?.scene?.getScene?.('arcade');
    if (!arcade) throw new Error('Arcade scene is not available');

    const world = arcade.worldSize;
    const now = arcade.time.now;
    const runtime = arcade.runtime;
    const riftRuntime = arcade.dimensionCoordinator.getWorld('rift');
    runtime.clearNonShipEntities();
    riftRuntime?.clearNonShipEntities();
    arcade.dimensionCoordinator.activePortal = null;
    arcade.dimensionCoordinator.pendingSpawnPlan = null;
    setPlayer(arcade, { x: world.width * 0.5, y: world.height * 0.5 }, { x: 0, y: 0 }, -0.1);
    arcade.session.ship.setFuel?.(100);

    const addAsteroid = (
      id: number,
      position: Vector,
      velocity: Vector,
      tier: 'big' | 'medium' | 'small' = 'medium',
    ) => {
      runtime.addAsteroids([
        {
          angularVelocity: 0.01,
          hits: tier === 'big' ? 10 : tier === 'medium' ? 3 : 1,
          id,
          membership: { space: 'arcade' },
          position,
          rotation: 0.3,
          tier,
          velocity,
          visualVariant: 0,
        },
      ]);
    };

    const addBlackHole = (
      id: number,
      position: Vector,
      velocity: Vector,
      mass = 5,
      ageMs = 4600,
    ) => {
      runtime.addProjectile({
        absorbedFuel: 0,
        ageMs,
        airResistance: 0.01,
        angle: Math.atan2(velocity.y, velocity.x),
        baseSpeed: 1,
        blackHoleMass: mass,
        collapseStartedAt: null,
        createdAt: now - ageMs,
        damage: 0,
        id,
        impact: 0,
        kind: 'blackHole',
        lifetimeMs: 16000,
        membership: { space: 'arcade' },
        position,
        radius: 6,
        velocity,
      });
      arcade.session.nextProjectileId = Math.max(arcade.session.nextProjectileId, id + 1);
    };

    const addFuelCluster = (origin: Vector) => {
      const offsets = [
        { x: -36, y: -20 },
        { x: -16, y: 10 },
        { x: 8, y: -12 },
        { x: 28, y: 18 },
        { x: 42, y: -24 },
        { x: -48, y: 26 },
        { x: 0, y: 34 },
        { x: 58, y: 2 },
      ];
      runtime.addFuelBlobs(
        offsets.map((offset, index) => ({
          airResistance: 0.01,
          collectableAtMs: now + 30000,
          id: 920_000 + index,
          membership: { space: 'arcade' },
          position: { x: origin.x + offset.x, y: origin.y + offset.y },
          velocity: { x: 0, y: 0 },
          wobbleSeed: index / 8,
        })),
      );
    };

    const openPortal = () => {
      const portal = {
        activeDurationMs: 20000,
        aperture: { radiusX: 150, radiusY: 110 },
        closeStartedAt: null,
        closingDurationMs: 240,
        id: 910_001,
        lifecycle: 'active',
        normal: { x: 1, y: 0 },
        openedAt: now - 600,
        openingDurationMs: 240,
        position: { x: world.width * 0.68, y: world.height * 0.5 },
        viewPolicy: 'window',
        visualRadiusX: 190,
        visualRadiusY: 135,
      };
      arcade.dimensionCoordinator.openPortal({
        portal,
        spawn: {
          asteroidCount: 0,
          asteroidSpeed: 0,
          spawnDistance: 0,
          spreadRadius: 0,
        },
      });
      return portal;
    };

    if (scenarioName === 'blackHole') {
      addBlackHole(930_001, { x: world.width * 0.55, y: world.height * 0.48 }, { x: 0, y: 0 });
    } else if (scenarioName === 'metaballs') {
      addFuelCluster({ x: world.width * 0.55, y: world.height * 0.5 });
    } else if (scenarioName === 'blackHoleMetaballs') {
      addBlackHole(
        930_002,
        { x: world.width * 0.52, y: world.height * 0.48 },
        { x: 0, y: 0 },
        5,
        2400,
      );
      addFuelCluster({ x: world.width * 0.68, y: world.height * 0.55 });
    } else if (scenarioName === 'asteroidWrap') {
      addAsteroid(930_003, { x: world.width - 18, y: world.height * 0.5 }, { x: 0, y: 0 }, 'big');
    } else if (scenarioName === 'shipWrap') {
      setPlayer(arcade, { x: world.width - 10, y: world.height * 0.5 }, { x: 0, y: 0 }, 0);
    } else if (scenarioName === 'blackHoleWrap') {
      addBlackHole(930_004, { x: world.width - 14, y: world.height * 0.46 }, { x: 0, y: 0 }, 8);
    } else if (scenarioName === 'portalAsteroidCrossing') {
      const portal = openPortal();
      addAsteroid(
        930_005,
        { x: portal.position.x + 78, y: portal.position.y - 16 },
        { x: -3, y: 0 },
      );
    } else if (scenarioName === 'portalBlackHoleCrossing') {
      const portal = openPortal();
      addBlackHole(
        930_006,
        { x: portal.position.x + 32, y: portal.position.y - 12 },
        { x: -1, y: 0 },
        6,
      );
    } else if (scenarioName === 'fullIntersection') {
      const portal = openPortal();
      setPlayer(arcade, { x: world.width - 10, y: portal.position.y + 96 }, { x: 0, y: 0 }, 0);
      addAsteroid(
        930_007,
        { x: portal.position.x + 82, y: portal.position.y - 18 },
        { x: 0, y: 0 },
      );
      addAsteroid(930_008, { x: world.width - 18, y: world.height * 0.72 }, { x: 0, y: 0 }, 'big');
      addBlackHole(
        930_009,
        { x: portal.position.x + 28, y: portal.position.y + 8 },
        { x: -1, y: 0 },
        5,
        2400,
      );
      addBlackHole(930_010, { x: world.width - 14, y: world.height * 0.36 }, { x: 0, y: 0 }, 8);
      addFuelCluster({ x: portal.position.x - 30, y: portal.position.y + 44 });
    } else {
      throw new Error(`Unknown arcade render case: ${scenarioName}`);
    }

    runtime.syncPreviousPositions?.();
    riftRuntime?.syncPreviousPositions?.();
    gameWindow.__arcadeRenderCaseApplied = scenarioName;

    function setPlayer(
      scene: ArcadeSceneLike,
      position: Vector,
      velocity: Vector,
      rotation: number,
    ): void {
      scene.session.player.membership = { space: 'arcade' };
      scene.session.player.position = { ...position };
      scene.session.player.velocity = { ...velocity };
      scene.session.player.rotation = rotation;
      scene.session.player.lastAim = { x: 1, y: 0 };
      scene.session.player.lastThrustMove = { x: -1, y: 0 };
      scene.session.player.invulnerableUntil = scene.time.now + 30000;
      scene.playerBody.setPosition(position);
      scene.playerBody.setVelocity(velocity);
      scene.playerBody.setRotation(rotation);
    }
  }, caseName);

  await page.waitForFunction((scenarioName) => {
    return (
      (window as typeof window & { __arcadeRenderCaseApplied?: string })
        .__arcadeRenderCaseApplied === scenarioName
    );
  }, caseName);
  await page.waitForTimeout(900);
}

export async function collectArcadeRenderSummary(page: Page): Promise<ArcadeRenderSummary> {
  return page.evaluate(() => {
    type RuntimeLike = {
      world: {
        asteroids: Array<{ id: number; position: { x: number; y: number }; tier: string }>;
        fuelBlobs: unknown[];
        projectiles: Array<{
          kind: string;
          position: { x: number; y: number };
        }>;
      };
    };
    type ArcadeSceneLike = {
      asteroidBodies?: {
        toroidalCopies?: Map<number, unknown[]>;
      };
      dimensionCoordinator: {
        getActivePortal: () => unknown | null;
        getWorld: (space: 'arcade' | 'rift') => RuntimeLike | null;
      };
      runtime: RuntimeLike;
      scene: {
        isActive: () => boolean;
      };
      session: {
        player: {
          position: { x: number; y: number };
        };
      };
      worldSize: { height: number; width: number };
    };
    type GameWindow = typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => ArcadeSceneLike;
          getScenes?: (activeOnly?: boolean) => Array<{ scene: { key: string } }>;
        };
      };
    };

    const game = (window as GameWindow).__cometBurstersGame;
    const arcade = game?.scene?.getScene?.('arcade');
    if (!arcade) throw new Error('Arcade scene is not available');

    const runtime = arcade.runtime;
    const riftRuntime = arcade.dimensionCoordinator.getWorld('rift');
    const world = arcade.worldSize;
    const blackHoles = runtime.world.projectiles.filter(
      (projectile) => projectile.kind === 'blackHole',
    );
    const wrappedBlackHoleCount = blackHoles.filter(
      (projectile) =>
        projectile.position.x < 80 ||
        projectile.position.x > world.width - 80 ||
        projectile.position.y < 80 ||
        projectile.position.y > world.height - 80,
    ).length;
    const toroidalCopies = arcade.asteroidBodies?.toroidalCopies;
    const toroidalAsteroidCopyCount = toroidalCopies
      ? [...toroidalCopies.values()].reduce((sum, copies) => sum + copies.length, 0)
      : 0;
    const playerPosition = arcade.session.player.position;
    const playerNearEdge =
      playerPosition.x < 40 ||
      playerPosition.x > world.width - 40 ||
      playerPosition.y < 40 ||
      playerPosition.y > world.height - 40;

    return {
      activePortal: arcade.dimensionCoordinator.getActivePortal() !== null,
      activeScenes: game?.scene?.getScenes?.(true).map((scene) => scene.scene.key) ?? [],
      arcadeAsteroids: runtime.world.asteroids.length,
      blackHoles: blackHoles.length,
      domCanvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
        height: canvas.height,
        visible: canvas.getClientRects().length > 0,
        width: canvas.width,
      })),
      fuelBlobs: runtime.world.fuelBlobs.length,
      player: {
        nearEdge: playerNearEdge,
        position: playerPosition,
      },
      riftAsteroids: riftRuntime?.world.asteroids.length ?? 0,
      riftBlackHoles:
        riftRuntime?.world.projectiles.filter((projectile) => projectile.kind === 'blackHole')
          .length ?? 0,
      sceneActive: arcade.scene.isActive(),
      toroidalAsteroidCopyCount,
      wrappedBlackHoleCount,
    };
  });
}

export async function saveArcadeRenderCaseArtifacts(
  page: Page,
  testInfo: TestInfo,
  caseName: ArcadeRenderCaseName,
  summary: ArcadeRenderSummary,
): Promise<void> {
  const screenshotPath = path.join(
    artifactRoot,
    'screenshots/arcade-render-cases',
    `${caseName}.png`,
  );
  const summaryPath = path.join(artifactRoot, 'profiles/arcade-render-cases', `${caseName}.json`);
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(screenshotPath, await page.screenshot({ fullPage: true }));
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await testInfo.attach(`${caseName}-screenshot`, {
    contentType: 'image/png',
    path: screenshotPath,
  });
  await testInfo.attach(`${caseName}-summary`, {
    contentType: 'application/json',
    path: summaryPath,
  });
}
