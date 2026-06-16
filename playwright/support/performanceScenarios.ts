import type { Page, TestInfo } from '@playwright/test';

import {
  readPerformanceDurationMs,
  writePerformanceArtifact,
  type PerformanceArtifactInput,
  type PerformanceArtifactReport,
  type PerformanceGranularity,
  type PerformanceScene,
} from './performanceArtifacts';
import {
  clearPerfSnapshot,
  collectFrameStats,
  collectGraphicsSummary,
  collectPerfSnapshot,
  startFrameSampling,
  type FrameStats,
} from './sandboxHarness';

export type SceneTelemetry = {
  activeScenes: string[];
  canvases: Array<{ height: number; visible: boolean; width: number }>;
  displayObjects: number;
  graphics: Array<{
    active: boolean;
    alpha: number;
    commandBufferLength: number;
    depth: number;
    index: number;
    name: string;
    sceneKey: string;
    visible: boolean;
    x: number;
    y: number;
  }>;
  renderTextures: Array<{
    height: number;
    name: string;
    sceneKey: string;
    visible: boolean;
    width: number;
  }>;
  textures: {
    asteroidAtlases: number;
    planetTextures: number;
    total: number;
  };
};

export type SandboxFeatureSummary = SceneTelemetry & {
  controlsEnabled: boolean;
  counts: {
    asteroids: number;
    fuelBlobs: number;
    particles: number;
    planets: number;
    projectiles: number;
  };
  playerDocked: boolean;
};

export type DemoTechniqueSummary = SceneTelemetry & {
  asteroidVisuals: number;
  planets: number;
  technique: string;
};

export type ScenarioSampleOptions = {
  consoleMessages?: string[];
  counts?: Record<string, number>;
  durationMs?: number;
  granularity: PerformanceGranularity;
  metrics?: Record<string, number | null>;
  notes?: string[];
  samples?: unknown;
  scene: PerformanceScene;
  scenario: string;
  suite: string;
  tags?: string[];
  testInfo: TestInfo;
  toggles?: Record<string, boolean>;
};

type PerfMarkerSnapshot = Record<
  string,
  { average: number; count: number; max: number; min: number; total: number }
>;

const menuClickByScene: Record<Exclude<PerformanceScene, 'global'>, { x: number; y: number }> = {
  arcade: { x: 640, y: 412 },
  demo: { x: 640, y: 340 },
  sandbox: { x: 640, y: 484 },
};

export async function openDemoGame(
  page: Page,
  settleMs = 1200,
  options: {
    demoTechnique?: 'asteroid-atlas-rotation' | 'planet-texture-cache';
    markers?: boolean;
  } = {},
): Promise<void> {
  await page.addInitScript(
    ({ demoTechnique, markers }) => {
      window.sessionStorage.setItem('comet-bursters-sandboxPerfMarkers', String(markers));
      if (demoTechnique) {
        (window as typeof window & { __demoPerfTechnique?: string }).__demoPerfTechnique =
          demoTechnique;
      }
    },
    { demoTechnique: options.demoTechnique, markers: options.markers === true },
  );
  await page.goto('/phaser-game.html', { waitUntil: 'networkidle' });
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    type GameWindow = typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => { scene?: { isActive?: () => boolean } };
        };
      };
    };
    return (
      (window as GameWindow).__cometBurstersGame?.scene
        ?.getScene?.('scene-menu')
        ?.scene?.isActive?.() === true
    );
  });
  const clickTarget = menuClickByScene.demo;
  await page.mouse.click(clickTarget.x, clickTarget.y);
  await page.waitForFunction(() => {
    type GameWindow = typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => { scene?: { isActive?: () => boolean } };
        };
      };
    };
    return (
      (window as GameWindow).__cometBurstersGame?.scene?.getScene?.('demo')?.scene?.isActive?.() ===
      true
    );
  });
  await page.waitForTimeout(settleMs);
}

export async function recordScenarioSample(
  page: Page,
  options: ScenarioSampleOptions,
): Promise<PerformanceArtifactReport> {
  const durationMs = options.durationMs ?? readPerformanceDurationMs(1500);
  await clearPerfSnapshot(page);
  await startFrameSampling(page);
  await page.waitForTimeout(durationMs);
  const frameStats = await collectFrameStats(page);
  const markers = normalizeMarkerSnapshot(await collectPerfSnapshot(page));
  const viewport = page.viewportSize();
  return writePerformanceArtifact({
    consoleMessages: options.consoleMessages,
    counts: options.counts,
    durationMs,
    frameStats: flattenFrameStats(frameStats),
    granularity: options.granularity,
    markers,
    metrics: options.metrics,
    notes: options.notes,
    samples: options.samples,
    scene: options.scene,
    scenario: options.scenario,
    suite: options.suite,
    tags: options.tags,
    testInfo: options.testInfo,
    toggles: options.toggles,
    url: page.url(),
    viewport: {
      deviceScaleFactor: await page.evaluate(() => window.devicePixelRatio),
      height: viewport?.height ?? null,
      width: viewport?.width ?? null,
    },
  } satisfies PerformanceArtifactInput);
}

export async function collectSceneTelemetry(page: Page): Promise<SceneTelemetry> {
  const graphics = (await collectGraphicsSummary(page)) as SceneTelemetry['graphics'];
  const runtime = await page.evaluate(() => {
    type SceneLike = {
      children?: {
        list?: Array<{
          height?: number;
          name?: string;
          type?: string;
          visible?: boolean;
          width?: number;
        }>;
      };
      scene: { key: string };
    };
    type TextureManagerLike = {
      list?: Record<string, unknown>;
    };
    type GameWindow = typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScenes?: (activeOnly?: boolean) => SceneLike[];
        };
        textures?: TextureManagerLike;
      };
    };

    const game = (window as GameWindow).__cometBurstersGame;
    const scenes = game?.scene?.getScenes?.(true) ?? [];
    const textureKeys = Object.keys(game?.textures?.list ?? {});
    return {
      activeScenes: scenes.map((scene) => scene.scene.key),
      canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
        height: canvas.height,
        visible: canvas.getClientRects().length > 0,
        width: canvas.width,
      })),
      displayObjects: scenes.reduce((sum, scene) => sum + (scene.children?.list?.length ?? 0), 0),
      renderTextures: scenes.flatMap((scene) =>
        (scene.children?.list ?? [])
          .filter((child) => child.type === 'RenderTexture')
          .map((child) => ({
            height: readFiniteRuntimeNumber(child.height),
            name: child.name || '(unnamed)',
            sceneKey: scene.scene.key,
            visible: child.visible !== false,
            width: readFiniteRuntimeNumber(child.width),
          })),
      ),
      textures: {
        asteroidAtlases: textureKeys.filter((key) => key.startsWith('phaser-asteroid-')).length,
        planetTextures: textureKeys.filter((key) => key.startsWith('phaser-planet-')).length,
        total: textureKeys.length,
      },
    };

    function readFiniteRuntimeNumber(value: unknown): number {
      return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
  });
  return {
    ...runtime,
    graphics,
  };
}

export async function collectSandboxFeatureSummary(page: Page): Promise<SandboxFeatureSummary> {
  const telemetry = await collectSceneTelemetry(page);
  const summary = await page.evaluate(() => {
    type SandboxSceneLike = {
      controlsEnabled?: boolean;
      planets?: unknown[];
      runtime?: {
        world?: {
          asteroids?: unknown[];
          fuelBlobs?: unknown[];
          particles?: unknown[];
          projectiles?: unknown[];
        };
      };
      sceneRenderer?: {
        playerThruster?: { depth?: number };
      };
    };
    type GameWindow = typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => SandboxSceneLike;
        };
      };
    };
    const sandbox = (window as GameWindow).__cometBurstersGame?.scene?.getScene?.('sandbox');
    const world = sandbox?.runtime?.world;
    return {
      controlsEnabled: sandbox?.controlsEnabled === true,
      counts: {
        asteroids: world?.asteroids?.length ?? 0,
        fuelBlobs: world?.fuelBlobs?.length ?? 0,
        particles: world?.particles?.length ?? 0,
        planets: sandbox?.planets?.length ?? 0,
        projectiles: world?.projectiles?.length ?? 0,
      },
      playerDocked: (sandbox?.sceneRenderer?.playerThruster?.depth ?? 0) < 0,
    };
  });
  return {
    ...telemetry,
    ...summary,
  };
}

export async function applySandboxPerfCase(
  page: Page,
  caseName: 'crowdedEffects' | 'freeFlight',
): Promise<void> {
  await page.evaluate((scenarioName) => {
    type Vector = { x: number; y: number };
    type RuntimeLike = {
      addFuelBlobs: (blobs: unknown[]) => void;
      addProjectile: (projectile: unknown) => void;
      world: {
        fuelBlobs: unknown[];
        projectiles: unknown[];
      };
    };
    type SandboxSceneLike = {
      controlsEnabled: boolean;
      nextProjectileId: number;
      player: {
        invulnerableUntil: number;
        lastAim: Vector;
        lastThrustMove: Vector;
        position: Vector;
        rotation: number;
        velocity: Vector;
        visible: boolean;
      };
      playerBody: {
        setPosition: (position: Vector) => void;
        setRotation: (rotation: number) => void;
        setVelocity: (velocity: Vector) => void;
      };
      runtime: RuntimeLike;
      sceneRenderer: {
        setPlayerDocked: (docked: boolean) => void;
      };
      time: { now: number };
    };
    type GameWindow = typeof window & {
      __sandboxPerfCaseApplied?: string;
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => SandboxSceneLike;
        };
      };
    };

    const gameWindow = window as GameWindow;
    const sandbox = gameWindow.__cometBurstersGame?.scene?.getScene?.('sandbox');
    if (!sandbox) throw new Error('Sandbox scene is not available');

    sandbox.controlsEnabled = true;
    sandbox.sceneRenderer.setPlayerDocked(false);
    const position = { x: sandbox.player.position.x + 180, y: sandbox.player.position.y - 90 };
    sandbox.player.visible = true;
    sandbox.player.position = position;
    sandbox.player.velocity = { x: 12, y: -3 };
    sandbox.player.rotation = -0.15;
    sandbox.player.lastAim = { x: 1, y: 0 };
    sandbox.player.lastThrustMove = { x: 1, y: 0 };
    sandbox.player.invulnerableUntil = sandbox.time.now + 30000;
    sandbox.playerBody.setPosition(position);
    sandbox.playerBody.setVelocity(sandbox.player.velocity);
    sandbox.playerBody.setRotation(sandbox.player.rotation);

    if (scenarioName === 'crowdedEffects') {
      const origin = sandbox.player.position;
      const fuelBlobs = Array.from({ length: 14 }, (_, index) => ({
        airResistance: 0.01,
        collectableAtMs: sandbox.time.now + 30000,
        id: 980_000 + index,
        position: {
          x: origin.x + Math.cos(index * 0.8) * (44 + index * 2),
          y: origin.y + Math.sin(index * 0.8) * (38 + index * 2),
        },
        velocity: { x: 0, y: 0 },
        wobbleSeed: index / 14,
      }));
      sandbox.runtime.addFuelBlobs(fuelBlobs);
      sandbox.runtime.addProjectile({
        absorbedFuel: 0,
        ageMs: 3600,
        airResistance: 0.01,
        angle: 0,
        baseSpeed: 1,
        blackHoleMass: 8,
        collapseStartedAt: null,
        createdAt: sandbox.time.now - 3600,
        damage: 0,
        gravityScale: 1,
        id: 990_000 + sandbox.runtime.world.projectiles.length,
        impact: 0,
        kind: 'blackHole',
        lifetimeMs: 16000,
        position: { x: origin.x + 130, y: origin.y + 80 },
        radius: 6,
        velocity: { x: 0, y: 0 },
      });
      sandbox.nextProjectileId = Math.max(sandbox.nextProjectileId, 990_010);
    }

    gameWindow.__sandboxPerfCaseApplied = scenarioName;
  }, caseName);

  await page.waitForFunction((scenarioName) => {
    return (
      (window as typeof window & { __sandboxPerfCaseApplied?: string }).__sandboxPerfCaseApplied ===
      scenarioName
    );
  }, caseName);
  await page.waitForTimeout(700);
}

export async function focusDemoTechnique(
  page: Page,
  technique: 'asteroid-atlas-rotation' | 'planet-texture-cache',
): Promise<DemoTechniqueSummary> {
  await page.evaluate((techniqueName) => {
    type DemoSceneLike = {
      asteroids?: Array<{ position: { x: number; y: number } }>;
      cameras?: {
        main?: {
          centerOn: (x: number, y: number) => void;
          setZoom: (zoom: number) => void;
        };
      };
      planets?: Array<{ position: { x: number; y: number } }>;
    };
    type GameWindow = typeof window & {
      __demoPerfTechnique?: string;
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => DemoSceneLike;
        };
      };
    };
    const gameWindow = window as GameWindow;
    const demo = gameWindow.__cometBurstersGame?.scene?.getScene?.('demo');
    if (!demo) throw new Error('Demo scene is not available');
    const targets =
      techniqueName === 'planet-texture-cache' ? (demo.planets ?? []) : (demo.asteroids ?? []);
    const center = targets.reduce(
      (sum, target) => ({
        x: sum.x + target.position.x / Math.max(1, targets.length),
        y: sum.y + target.position.y / Math.max(1, targets.length),
      }),
      { x: 0, y: 0 },
    );
    demo.cameras?.main?.centerOn(center.x, center.y);
    demo.cameras?.main?.setZoom(techniqueName === 'planet-texture-cache' ? 0.72 : 0.82);
    gameWindow.__demoPerfTechnique = techniqueName;
  }, technique);

  await page.waitForFunction((techniqueName) => {
    return (
      (window as typeof window & { __demoPerfTechnique?: string }).__demoPerfTechnique ===
      techniqueName
    );
  }, technique);
  await page.waitForTimeout(900);

  const telemetry = await collectSceneTelemetry(page);
  const counts = await page.evaluate((techniqueName) => {
    type DemoSceneLike = {
      asteroids?: unknown[];
      planets?: unknown[];
    };
    type GameWindow = typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => DemoSceneLike;
        };
      };
    };
    const demo = (window as GameWindow).__cometBurstersGame?.scene?.getScene?.('demo');
    return {
      asteroidVisuals: demo?.asteroids?.length ?? 0,
      planets: demo?.planets?.length ?? 0,
      technique: techniqueName,
    };
  }, technique);
  return {
    ...telemetry,
    ...counts,
  };
}

export function sceneTelemetryCounts(telemetry: SceneTelemetry): Record<string, number> {
  return {
    activeScenes: telemetry.activeScenes.length,
    asteroidAtlases: telemetry.textures.asteroidAtlases,
    canvases: telemetry.canvases.length,
    displayObjects: telemetry.displayObjects,
    graphics: telemetry.graphics.length,
    largestCanvasPixels: maxPixels(telemetry.canvases),
    largestRenderTexturePixels: maxPixels(telemetry.renderTextures),
    planetTextures: telemetry.textures.planetTextures,
    renderTextures: telemetry.renderTextures.length,
    totalCanvasPixels: sumPixels(telemetry.canvases),
    totalRenderTexturePixels: sumPixels(telemetry.renderTextures),
    visibleCanvases: telemetry.canvases.filter((canvas) => canvas.visible).length,
  };
}

function sumPixels(surfaces: Array<{ height: number; width: number }>): number {
  return surfaces.reduce((sum, surface) => sum + surface.width * surface.height, 0);
}

function maxPixels(surfaces: Array<{ height: number; width: number }>): number {
  return surfaces.reduce((max, surface) => Math.max(max, surface.width * surface.height), 0);
}

export function sandboxFeatureCounts(summary: SandboxFeatureSummary): Record<string, number> {
  return {
    ...sceneTelemetryCounts(summary),
    asteroids: summary.counts.asteroids,
    fuelBlobs: summary.counts.fuelBlobs,
    particles: summary.counts.particles,
    planets: summary.counts.planets,
    projectiles: summary.counts.projectiles,
  };
}

export function demoTechniqueCounts(summary: DemoTechniqueSummary): Record<string, number> {
  return {
    ...sceneTelemetryCounts(summary),
    asteroidVisuals: summary.asteroidVisuals,
    planets: summary.planets,
  };
}

function flattenFrameStats(frameStats: FrameStats | null): Record<string, number | null> {
  return {
    averageDeltaMs: frameStats?.averageDeltaMs ?? null,
    averageFps: frameStats?.averageFps ?? null,
    durationMs: frameStats?.durationMs ?? null,
    frameCount: frameStats?.frameCount ?? null,
    maxDeltaMs: frameStats?.maxDeltaMs ?? null,
    minDeltaMs: frameStats?.minDeltaMs ?? null,
  };
}

function normalizeMarkerSnapshot(snapshot: unknown): PerfMarkerSnapshot {
  if (!snapshot || typeof snapshot !== 'object') return {};
  return Object.fromEntries(
    Object.entries(snapshot)
      .map(([name, value]) => [name, normalizeMarkerValue(value)] as const)
      .filter((entry): entry is readonly [string, PerfMarkerSnapshot[string]] => entry[1] !== null),
  );
}

function normalizeMarkerValue(value: unknown): PerfMarkerSnapshot[string] | null {
  if (!value || typeof value !== 'object') return null;
  const marker = value as Partial<PerfMarkerSnapshot[string]>;
  const average = readFiniteNumber(marker.average);
  const count = readFiniteNumber(marker.count);
  const max = readFiniteNumber(marker.max);
  const min = readFiniteNumber(marker.min);
  const total = readFiniteNumber(marker.total);
  if (average === null || count === null || max === null || min === null || total === null)
    return null;
  return { average, count, max, min, total };
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
