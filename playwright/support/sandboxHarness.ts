import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CDPSession, Page, TestInfo } from '@playwright/test';

export type SandboxProfileToggles = {
  biomeDebug: boolean;
  blackHoles: boolean;
  fuelMetaballs: boolean;
  grid: boolean;
  markers: boolean;
  minimap: boolean;
  nebulaBackground: boolean;
  nebulaRegions: boolean;
  playerHud: boolean;
  starfield: boolean;
  trajectoryPreview: boolean;
};

export type FrameStats = {
  averageDeltaMs: number;
  averageFps: number;
  durationMs: number;
  frameCount: number;
  maxDeltaMs: number;
  minDeltaMs: number;
};

type TraceEvent = {
  cat?: string;
  dur?: number;
  name?: string;
  ph?: string;
  tid?: number;
};

type CpuProfileNode = {
  callFrame: {
    functionName?: string;
    url?: string;
  };
  id: number;
};

type CpuProfile = {
  nodes: CpuProfileNode[];
  samples?: number[];
  timeDeltas?: number[];
};

type DurationSummary = {
  count: number;
  name: string;
  totalMs: number;
};

type ConsoleDiagnostics = {
  messages: string[];
  stop: () => void;
};

type PhaserProfileScene = 'arcade' | 'sandbox';
type PhaserProfileTraceMode = 'sample' | 'trace';
type PhaserProfileRunMode = 'current' | 'milestone';

type ProfileMetadata = {
  git: {
    branch: string | null;
    commit: string | null;
    dirty: boolean | null;
  };
  machine: {
    arch: string;
    cpuModel: string | null;
    hostname: string;
    platform: string;
    release: string;
  };
  pid: number;
  runMode: PhaserProfileRunMode;
  scene: PhaserProfileScene;
  timestamp: string;
  traceMode: PhaserProfileTraceMode;
};

type ProfileMetricComparison = {
  current: number | null;
  delta: number | null;
  deltaPercent: number | null;
  milestone: number | null;
};

type ProfileComparison = {
  frameStats: Record<keyof FrameStats, ProfileMetricComparison>;
  markerAverages: Record<string, ProfileMetricComparison>;
  milestoneArtifactPath: string;
  milestoneTimestamp: string;
};

type PhaserProfileReport = {
  artifactPath: string;
  comparison: ProfileComparison | null;
  consoleMessages: string[];
  cpu: Array<{ name: string; totalMs: number }> | null;
  durationMs: number;
  frameSnapshot: unknown;
  frameStats: FrameStats | null;
  graphicsAfterProfile: unknown;
  graphicsBeforeProfile: unknown;
  metadata: ProfileMetadata;
  startupSnapshot: unknown;
  timeline: ReturnType<typeof summarizeTrace> | null;
  traceMode: PhaserProfileTraceMode;
  url: string;
};

const artifactRoot = path.resolve(process.cwd(), 'artifacts/playwright');

const storageKeyByToggle: Record<keyof SandboxProfileToggles, string> = {
  biomeDebug: 'sandboxBiomeDebug',
  blackHoles: 'sandboxBlackHoles',
  fuelMetaballs: 'sandboxFuelMetaballs',
  grid: 'sandboxGrid',
  markers: 'sandboxPerfMarkers',
  minimap: 'sandboxMinimap',
  nebulaBackground: 'sandboxNebulaBackground',
  nebulaRegions: 'sandboxNebulaRegions',
  playerHud: 'sandboxPlayerHud',
  starfield: 'sandboxStarfield',
  trajectoryPreview: 'sandboxTrajectoryPreview',
};

const defaultSandboxProfileToggles: SandboxProfileToggles = {
  biomeDebug: false,
  blackHoles: true,
  fuelMetaballs: true,
  grid: true,
  markers: true,
  minimap: true,
  nebulaBackground: true,
  nebulaRegions: true,
  playerHud: true,
  starfield: true,
  trajectoryPreview: true,
};

const envByToggle: Record<keyof SandboxProfileToggles, string> = {
  biomeDebug: 'SANDBOX_BIOME_DEBUG',
  blackHoles: 'SANDBOX_BLACK_HOLES',
  fuelMetaballs: 'SANDBOX_FUEL_METABALLS',
  grid: 'SANDBOX_GRID',
  markers: 'SANDBOX_PERF_MARKERS',
  minimap: 'SANDBOX_MINIMAP',
  nebulaBackground: 'SANDBOX_NEBULA_BACKGROUND',
  nebulaRegions: 'SANDBOX_NEBULA_REGIONS',
  playerHud: 'SANDBOX_PLAYER_HUD',
  starfield: 'SANDBOX_STARFIELD',
  trajectoryPreview: 'SANDBOX_TRAJECTORY_PREVIEW',
};

const arcadeEnvByToggle: Record<keyof SandboxProfileToggles, string> = {
  biomeDebug: 'ARCADE_BIOME_DEBUG',
  blackHoles: 'ARCADE_BLACK_HOLES',
  fuelMetaballs: 'ARCADE_FUEL_METABALLS',
  grid: 'ARCADE_GRID',
  markers: 'ARCADE_PERF_MARKERS',
  minimap: 'ARCADE_MINIMAP',
  nebulaBackground: 'ARCADE_THREE_BACKGROUND',
  nebulaRegions: 'ARCADE_NEBULA_REGIONS',
  playerHud: 'ARCADE_PLAYER_HUD',
  starfield: 'ARCADE_STARFIELD',
  trajectoryPreview: 'ARCADE_TRAJECTORY_PREVIEW',
};

const menuClickByScene: Record<PhaserProfileScene, { x: number; y: number }> = {
  arcade: { x: 640, y: 412 },
  sandbox: { x: 640, y: 484 },
};

export function getSandboxProfileTogglesFromEnv(
  defaults: SandboxProfileToggles = defaultSandboxProfileToggles,
): SandboxProfileToggles {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [
      key,
      readBooleanEnvCandidates(getSandboxEnvCandidates(key as keyof SandboxProfileToggles), value),
    ]),
  ) as SandboxProfileToggles;
}

export function getArcadeProfileTogglesFromEnv(
  defaults: SandboxProfileToggles = defaultSandboxProfileToggles,
): SandboxProfileToggles {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [
      key,
      readBooleanEnvCandidates(
        [
          arcadeEnvByToggle[key as keyof SandboxProfileToggles],
          ...getSandboxEnvCandidates(key as keyof SandboxProfileToggles),
        ],
        value,
      ),
    ]),
  ) as SandboxProfileToggles;
}

function getSandboxEnvCandidates(key: keyof SandboxProfileToggles): string[] {
  if (key === 'nebulaBackground') return [envByToggle.nebulaBackground, 'SANDBOX_THREE_BACKGROUND'];
  return [envByToggle[key]];
}

export async function openSandboxGame(
  page: Page,
  options: {
    settleMs?: number;
    toggles?: SandboxProfileToggles;
    url?: string;
  } = {},
): Promise<void> {
  await openPhaserGameScene(page, {
    scene: 'sandbox',
    settleMs: options.settleMs,
    toggles: options.toggles ?? getSandboxProfileTogglesFromEnv(),
    url: options.url,
  });
}

export async function openArcadeGame(
  page: Page,
  options: {
    settleMs?: number;
    toggles?: SandboxProfileToggles;
    url?: string;
  } = {},
): Promise<void> {
  await openPhaserGameScene(page, {
    scene: 'arcade',
    settleMs: options.settleMs,
    toggles: options.toggles ?? getArcadeProfileTogglesFromEnv(),
    url: options.url,
  });
}

async function openPhaserGameScene(
  page: Page,
  options: {
    scene: PhaserProfileScene;
    settleMs?: number;
    toggles: SandboxProfileToggles;
    url?: string;
  },
): Promise<void> {
  await page.addInitScript(
    ({ storageKeys, startupToggles }) => {
      Object.entries(storageKeys).forEach(([toggleName, storageKey]) => {
        const enabled = startupToggles[toggleName as keyof typeof startupToggles];
        window.sessionStorage.setItem(`comet-bursters-${storageKey}`, String(enabled));
      });
    },
    { startupToggles: options.toggles, storageKeys: storageKeyByToggle },
  );
  await page.goto(options.url ?? '/phaser-game.html', { waitUntil: 'networkidle' });
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
  const clickTarget = menuClickByScene[options.scene];
  await page.mouse.click(clickTarget.x, clickTarget.y);
  await page.waitForFunction((sceneKey) => {
    type GameWindow = typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScene?: (key: string) => { scene?: { isActive?: () => boolean } };
        };
      };
    };
    return (
      (window as GameWindow).__cometBurstersGame?.scene
        ?.getScene?.(sceneKey)
        ?.scene?.isActive?.() === true
    );
  }, options.scene);
  await page.waitForTimeout(options.settleMs ?? 1200);
}

export function captureConsoleDiagnostics(page: Page): ConsoleDiagnostics {
  const messages: string[] = [];
  const onConsole = (message: { text: () => string; type: () => string }) => {
    messages.push(`${message.type()}: ${message.text()}`);
  };
  const onPageError = (error: Error) => {
    messages.push(`pageerror: ${error.message}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  return {
    messages,
    stop: () => {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    },
  };
}

export async function startFrameSampling(page: Page): Promise<void> {
  await page.evaluate(() => {
    type FrameSample = {
      frames: number[];
      start: number;
    };
    const sampleWindow = window as typeof window & {
      __cometBurstersFrameSample?: FrameSample;
    };
    sampleWindow.__cometBurstersFrameSample = {
      frames: [],
      start: performance.now(),
    };
    const sample = () => {
      const state = sampleWindow.__cometBurstersFrameSample;
      if (state) {
        state.frames.push(performance.now());
        window.requestAnimationFrame(sample);
      }
    };
    window.requestAnimationFrame(sample);
  });
}

export async function collectFrameStats(page: Page): Promise<FrameStats | null> {
  return page.evaluate(() => {
    type FrameSample = {
      frames: number[];
      start: number;
    };
    const sampleWindow = window as typeof window & {
      __cometBurstersFrameSample?: FrameSample;
    };
    const sample = sampleWindow.__cometBurstersFrameSample;
    if (!sample || sample.frames.length < 2) return null;

    const deltas: number[] = [];
    for (let index = 1; index < sample.frames.length; index += 1) {
      deltas.push(sample.frames[index] - sample.frames[index - 1]);
    }

    const totalMs = sample.frames[sample.frames.length - 1] - sample.frames[0];
    const averageDeltaMs = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    return {
      averageDeltaMs,
      averageFps: 1000 / averageDeltaMs,
      durationMs: totalMs,
      frameCount: sample.frames.length,
      maxDeltaMs: Math.max(...deltas),
      minDeltaMs: Math.min(...deltas),
    };
  });
}

export async function collectPerfSnapshot(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const perfWindow = window as typeof window & {
      __cometBurstersPerf?: {
        snapshot: () => unknown;
      };
    };
    return perfWindow.__cometBurstersPerf?.snapshot?.() ?? null;
  });
}

export async function clearPerfSnapshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const perfWindow = window as typeof window & {
      __cometBurstersPerf?: {
        clear: () => void;
      };
    };
    perfWindow.__cometBurstersPerf?.clear?.();
  });
}

export async function collectGraphicsSummary(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    type GraphicsChild = {
      active: boolean;
      alpha: number;
      commandBuffer?: unknown[];
      depth: number;
      name?: string;
      type?: string;
      visible: boolean;
      x: number;
      y: number;
    };
    type SceneLike = {
      children?: {
        list?: GraphicsChild[];
      };
      scene: {
        key: string;
      };
    };
    const gameWindow = window as typeof window & {
      __cometBurstersGame?: {
        scene?: {
          getScenes?: (activeOnly?: boolean) => SceneLike[];
        };
      };
    };
    const scenes = gameWindow.__cometBurstersGame?.scene?.getScenes?.(true) ?? [];
    const graphics = scenes.flatMap((scene) =>
      (scene.children?.list ?? [])
        .filter((child) => child.type === 'Graphics')
        .map((child) => ({ child, sceneKey: scene.scene.key })),
    );
    return graphics
      .map(({ child, sceneKey }, index) => {
        const commandBuffer = Array.isArray(child.commandBuffer) ? child.commandBuffer : [];
        return {
          active: child.active,
          alpha: child.alpha,
          commandBufferLength: commandBuffer.length,
          depth: child.depth,
          index,
          name: child.name || '(unnamed)',
          sceneKey,
          visible: child.visible,
          x: child.x,
          y: child.y,
        };
      })
      .sort((a, b) => b.commandBufferLength - a.commandBufferLength);
  });
}

export async function recordSandboxProfile(
  page: Page,
  options: {
    consoleMessages?: string[];
    durationMs: number;
    includeTrace?: boolean;
    testInfo: TestInfo;
  },
): Promise<PhaserProfileReport> {
  return recordPhaserProfile(page, { ...options, scene: 'sandbox' });
}

export async function recordArcadeProfile(
  page: Page,
  options: {
    consoleMessages?: string[];
    durationMs: number;
    includeTrace?: boolean;
    testInfo: TestInfo;
  },
): Promise<PhaserProfileReport> {
  return recordPhaserProfile(page, { ...options, scene: 'arcade' });
}

async function recordPhaserProfile(
  page: Page,
  options: {
    consoleMessages?: string[];
    durationMs: number;
    includeTrace?: boolean;
    scene: PhaserProfileScene;
    testInfo: TestInfo;
  },
): Promise<PhaserProfileReport> {
  const includeTrace = options.includeTrace ?? true;
  const traceMode: PhaserProfileTraceMode = includeTrace ? 'trace' : 'sample';
  const runMode = readProfileRunMode();
  const metadata = createProfileMetadata(options.scene, traceMode, runMode);
  const graphicsBeforeProfile = await collectGraphicsSummary(page);
  const startupSnapshot = await collectPerfSnapshot(page);
  await clearPerfSnapshot(page);

  let cdp: CDPSession | null = null;
  let tracePromise: Promise<TraceEvent[]> | null = null;
  if (includeTrace) {
    cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
    await cdp.send('Tracing.start', {
      categories: [
        'blink',
        'cc',
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'disabled-by-default-devtools.timeline.frame',
        'disabled-by-default-v8.cpu_profiler',
        'gpu',
        'loading',
        'renderer.scheduler',
        'toplevel',
        'v8',
      ].join(','),
      options: 'sampling-frequency=10000',
      transferMode: 'ReturnAsStream',
    });
  }

  await startFrameSampling(page);
  await page.waitForTimeout(options.durationMs);

  let traceEvents: TraceEvent[] = [];
  let profile: CpuProfile | null = null;
  if (cdp && includeTrace) {
    tracePromise = readTrace(cdp);
    await cdp.send('Tracing.end');
    traceEvents = await tracePromise;
    const profileResponse = (await cdp.send('Profiler.stop')) as { profile: CpuProfile };
    profile = profileResponse.profile;
  }

  const frameStats = await collectFrameStats(page);
  const frameSnapshot = await collectPerfSnapshot(page);
  const graphicsAfterProfile = await collectGraphicsSummary(page);
  const relativeArtifactPath = createProfileArtifactPath(metadata);
  const artifactPath = path.join(artifactRoot, relativeArtifactPath);
  const comparison =
    runMode === 'current'
      ? await compareWithLatestMilestone(options.scene, traceMode, metadata, {
          frameSnapshot,
          frameStats,
        })
      : null;
  const report: PhaserProfileReport = {
    artifactPath,
    comparison,
    consoleMessages: (options.consoleMessages ?? []).slice(-20),
    cpu: profile ? summarizeCpuProfile(profile) : null,
    durationMs: options.durationMs,
    frameSnapshot,
    frameStats,
    graphicsAfterProfile,
    graphicsBeforeProfile,
    metadata,
    startupSnapshot,
    timeline: includeTrace ? summarizeTrace(traceEvents) : null,
    traceMode,
    url: page.url(),
  };

  await writeJsonArtifact(relativeArtifactPath, report);
  await options.testInfo.attach(`${options.scene}-profile`, {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  return report;
}

function readProfileRunMode(): PhaserProfileRunMode {
  const raw = process.env.PROFILE_RUN_MODE;
  return raw === 'milestone' ? 'milestone' : 'current';
}

function createProfileMetadata(
  scene: PhaserProfileScene,
  traceMode: PhaserProfileTraceMode,
  runMode: PhaserProfileRunMode,
): ProfileMetadata {
  const cpus = os.cpus();
  return {
    git: {
      branch: readGitValue(['branch', '--show-current']),
      commit: readGitValue(['rev-parse', 'HEAD']),
      dirty: readGitDirty(),
    },
    machine: {
      arch: os.arch(),
      cpuModel: cpus[0]?.model ?? null,
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
    },
    pid: process.pid,
    runMode,
    scene,
    timestamp: new Date().toISOString(),
    traceMode,
  };
}

function createProfileArtifactPath(metadata: ProfileMetadata): string {
  const timestamp = metadata.timestamp.replace(/[:.]/g, '-');
  return `profiles/${metadata.scene}/${metadata.runMode}/${metadata.scene}-profile-${metadata.traceMode}-${timestamp}-${metadata.pid}.json`;
}

async function compareWithLatestMilestone(
  scene: PhaserProfileScene,
  traceMode: PhaserProfileTraceMode,
  metadata: ProfileMetadata,
  current: {
    frameSnapshot: unknown;
    frameStats: FrameStats | null;
  },
): Promise<ProfileComparison | null> {
  const milestone = await readLatestMatchingMilestone(scene, traceMode, metadata);
  if (!milestone) return null;

  return {
    frameStats: compareFrameStats(current.frameStats, milestone.report.frameStats ?? null),
    markerAverages: compareMarkerAverages(current.frameSnapshot, milestone.report.frameSnapshot),
    milestoneArtifactPath: milestone.artifactPath,
    milestoneTimestamp: milestone.report.metadata?.timestamp ?? '(unknown)',
  };
}

async function readLatestMatchingMilestone(
  scene: PhaserProfileScene,
  traceMode: PhaserProfileTraceMode,
  metadata: ProfileMetadata,
): Promise<{ artifactPath: string; report: Partial<PhaserProfileReport> } | null> {
  const milestoneDir = path.join(artifactRoot, 'profiles', scene, 'milestone');
  let entries: string[] = [];
  try {
    entries = await readdir(milestoneDir);
  } catch {
    entries = [];
  }

  const candidates: Array<{ artifactPath: string; report: Partial<PhaserProfileReport> }> = [];
  for (const entry of entries) {
    if (entry.endsWith('.json')) {
      const artifactPath = path.join(milestoneDir, entry);
      const report = await readProfileReport(artifactPath);
      if (isMatchingMilestone(report, scene, traceMode, metadata)) {
        candidates.push({ artifactPath, report });
      }
    }
  }

  candidates.sort((a, b) =>
    String(b.report.metadata?.timestamp ?? '').localeCompare(
      String(a.report.metadata?.timestamp ?? ''),
    ),
  );
  return candidates[0] ?? null;
}

async function readProfileReport(
  artifactPath: string,
): Promise<Partial<PhaserProfileReport> | null> {
  try {
    return JSON.parse(await readFile(artifactPath, 'utf8')) as Partial<PhaserProfileReport>;
  } catch {
    return null;
  }
}

function isMatchingMilestone(
  report: Partial<PhaserProfileReport> | null,
  scene: PhaserProfileScene,
  traceMode: PhaserProfileTraceMode,
  metadata: ProfileMetadata,
): report is Partial<PhaserProfileReport> {
  return (
    report?.metadata?.runMode === 'milestone' &&
    report.metadata.scene === scene &&
    report.metadata.traceMode === traceMode &&
    report.metadata.machine.hostname === metadata.machine.hostname
  );
}

function compareFrameStats(
  current: FrameStats | null,
  milestone: FrameStats | null,
): Record<keyof FrameStats, ProfileMetricComparison> {
  return {
    averageDeltaMs: compareMetric(
      current?.averageDeltaMs ?? null,
      milestone?.averageDeltaMs ?? null,
    ),
    averageFps: compareMetric(current?.averageFps ?? null, milestone?.averageFps ?? null),
    durationMs: compareMetric(current?.durationMs ?? null, milestone?.durationMs ?? null),
    frameCount: compareMetric(current?.frameCount ?? null, milestone?.frameCount ?? null),
    maxDeltaMs: compareMetric(current?.maxDeltaMs ?? null, milestone?.maxDeltaMs ?? null),
    minDeltaMs: compareMetric(current?.minDeltaMs ?? null, milestone?.minDeltaMs ?? null),
  };
}

function compareMarkerAverages(
  currentSnapshot: unknown,
  milestoneSnapshot: unknown,
): Record<string, ProfileMetricComparison> {
  const current = readMarkerAverages(currentSnapshot);
  const milestone = readMarkerAverages(milestoneSnapshot);
  const markerNames = [...new Set([...Object.keys(current), ...Object.keys(milestone)])].sort();
  return Object.fromEntries(
    markerNames.map((name) => [
      name,
      compareMetric(current[name] ?? null, milestone[name] ?? null),
    ]),
  );
}

function readMarkerAverages(snapshot: unknown): Record<string, number> {
  if (!snapshot || typeof snapshot !== 'object') return {};
  return Object.fromEntries(
    Object.entries(snapshot)
      .map(([name, value]) => [name, readAverageMetric(value)] as const)
      .filter((entry): entry is readonly [string, number] => typeof entry[1] === 'number'),
  );
}

function readAverageMetric(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const average = (value as { average?: unknown }).average;
  return typeof average === 'number' && Number.isFinite(average) ? average : null;
}

function compareMetric(current: number | null, milestone: number | null): ProfileMetricComparison {
  const delta = current !== null && milestone !== null ? current - milestone : null;
  return {
    current,
    delta,
    deltaPercent:
      delta !== null && milestone !== null && milestone !== 0 ? (delta / milestone) * 100 : null,
    milestone,
  };
}

function readGitValue(args: string[]): string | null {
  try {
    const value = execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function readGitDirty(): boolean | null {
  try {
    const value = execFileSync('git', ['status', '--porcelain'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return value.trim().length > 0;
  } catch {
    return null;
  }
}

export async function saveSandboxScreenshot(page: Page, testInfo: TestInfo): Promise<string> {
  return savePhaserScreenshot(page, testInfo, 'sandbox');
}

export async function saveArcadeScreenshot(page: Page, testInfo: TestInfo): Promise<string> {
  return savePhaserScreenshot(page, testInfo, 'arcade');
}

async function savePhaserScreenshot(
  page: Page,
  testInfo: TestInfo,
  scene: PhaserProfileScene,
): Promise<string> {
  const screenshotPath = await writeBinaryArtifact(
    `screenshots/${scene}.png`,
    await page.screenshot({ fullPage: true }),
  );
  await testInfo.attach(`${scene}-screenshot`, {
    contentType: 'image/png',
    path: screenshotPath,
  });
  return screenshotPath;
}

export function readProfileDurationMs(defaultValue: number): number {
  const raw = process.env.PROFILE_DURATION_MS;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function readProfileTraceEnabled(defaultValue: boolean): boolean {
  return readBooleanEnv('PROFILE_TRACE', defaultValue);
}

async function writeJsonArtifact(relativeFilePath: string, payload: unknown): Promise<string> {
  return writeBinaryArtifact(
    relativeFilePath,
    Buffer.from(`${JSON.stringify(payload, null, 2)}\n`),
  );
}

async function writeBinaryArtifact(relativeFilePath: string, payload: Buffer): Promise<string> {
  const targetPath = path.join(artifactRoot, relativeFilePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, payload);
  return targetPath;
}

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw !== 'false' && raw !== '0';
}

function readBooleanEnvCandidates(names: string[], defaultValue: boolean): boolean {
  for (const name of names) {
    const raw = process.env[name];
    if (raw !== undefined) return raw !== 'false' && raw !== '0';
  }
  return defaultValue;
}

function readTrace(cdp: CDPSession): Promise<TraceEvent[]> {
  return new Promise((resolve, reject) => {
    cdp.once('Tracing.tracingComplete', async ({ stream }) => {
      try {
        if (!stream) {
          reject(new Error('Tracing completed without an IO stream handle'));
          return;
        }
        let result = '';
        let eof = false;
        while (!eof) {
          const chunk = (await cdp.send('IO.read', { handle: stream })) as {
            data: string;
            eof: boolean;
          };
          result += chunk.data;
          eof = chunk.eof;
        }
        await cdp.send('IO.close', { handle: stream });
        const parsed = JSON.parse(result) as { traceEvents?: TraceEvent[] };
        resolve(parsed.traceEvents ?? []);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function summarizeTrace(events: TraceEvent[]): {
  eventTotals: DurationSummary[];
  gpuTotals: DurationSummary[];
  rendererMainTotals: DurationSummary[];
  topLongEvents: Array<{
    category?: string;
    durationMs: number;
    name?: string;
    thread?: number;
  }>;
} {
  const completeEvents = events.filter((event) => event.ph === 'X' && (event.dur ?? 0) > 0);
  const rendererMain = completeEvents.filter((event) => isRendererMainEvent(event));
  const gpu = completeEvents.filter((event) => String(event.cat ?? '').includes('gpu'));
  const topLongEvents = completeEvents
    .filter((event) => (event.dur ?? 0) >= 1000)
    .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
    .slice(0, 30)
    .map((event) => ({
      category: event.cat,
      durationMs: (event.dur ?? 0) / 1000,
      name: event.name,
      thread: event.tid,
    }));

  return {
    eventTotals: summarizeDurations(completeEvents, (event) => event.name ?? '(unknown)').slice(
      0,
      30,
    ),
    gpuTotals: summarizeDurations(gpu, (event) => event.name ?? '(unknown)').slice(0, 20),
    rendererMainTotals: summarizeDurations(
      rendererMain,
      (event) => event.name ?? '(unknown)',
    ).slice(0, 30),
    topLongEvents,
  };
}

function summarizeDurations(
  events: TraceEvent[],
  getKey: (event: TraceEvent) => string,
): DurationSummary[] {
  const totals = new Map<string, { count: number; totalMs: number }>();
  for (const event of events) {
    const key = getKey(event);
    const current = totals.get(key) ?? { count: 0, totalMs: 0 };
    current.count += 1;
    current.totalMs += (event.dur ?? 0) / 1000;
    totals.set(key, current);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

function isRendererMainEvent(event: TraceEvent): boolean {
  const name = String(event.name ?? '');
  const category = String(event.cat ?? '');
  return (
    category.includes('devtools.timeline') ||
    category.includes('renderer.scheduler') ||
    name === 'RunTask' ||
    name === 'FunctionCall' ||
    name === 'UpdateLayoutTree'
  );
}

function summarizeCpuProfile(profile: CpuProfile): Array<{ name: string; totalMs: number }> {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const samples = profile.samples ?? [];
  const timeDeltas = profile.timeDeltas ?? [];
  const totals = new Map<string, number>();
  for (let index = 0; index < samples.length; index += 1) {
    const node = nodes.get(samples[index]);
    if (node) {
      const callFrame = node.callFrame;
      const key = `${callFrame.functionName || '(anonymous)'} @ ${callFrame.url || '(unknown)'}`;
      totals.set(key, (totals.get(key) ?? 0) + (timeDeltas[index] ?? 0) / 1000);
    }
  }
  return [...totals.entries()]
    .map(([name, totalMs]) => ({ name, totalMs }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 40);
}
