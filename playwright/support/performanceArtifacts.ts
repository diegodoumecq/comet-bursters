import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';

export type PerformanceRunMode = 'current' | 'milestone';
export type PerformanceTraceMode = 'sample' | 'trace';
export type PerformanceGranularity = 'case' | 'feature' | 'scene' | 'system' | 'technique';
export type PerformanceScene = 'arcade' | 'demo' | 'global' | 'sandbox';

export type PerformanceMetricComparison = {
  current: number | null;
  delta: number | null;
  deltaPercent: number | null;
  milestone: number | null;
};

export type PerformanceArtifactMetadata = {
  artifactVersion: 1;
  git: {
    branch: string | null;
    commit: string | null;
    dirty: boolean | null;
  };
  granularity: PerformanceGranularity;
  machine: {
    arch: string;
    cpuModel: string | null;
    hostname: string;
    platform: string;
    release: string;
  };
  pid: number;
  runMode: PerformanceRunMode;
  scene: PerformanceScene;
  scenario: string;
  suite: string;
  tags: string[];
  timestamp: string;
  traceMode: PerformanceTraceMode;
  viewport: {
    deviceScaleFactor: number | null;
    height: number | null;
    width: number | null;
  };
};

export type PerformanceComparison = {
  metricComparisons: Record<string, PerformanceMetricComparison>;
  milestoneArtifactPath: string;
  milestoneTimestamp: string;
};

export type PerformanceArtifactReport = {
  artifactPath: string;
  comparison: PerformanceComparison | null;
  consoleMessages: string[];
  counts: Record<string, number>;
  durationMs: number;
  frameStats: Record<string, number | null>;
  markers: Record<
    string,
    { average: number; count: number; max: number; min: number; total: number }
  >;
  metadata: PerformanceArtifactMetadata;
  metrics: Record<string, number | null>;
  notes: string[];
  samples: unknown;
  toggles: Record<string, boolean>;
  url: string;
};

export type PerformanceArtifactInput = {
  consoleMessages?: string[];
  counts?: Record<string, number>;
  durationMs: number;
  frameStats?: Record<string, number | null>;
  granularity: PerformanceGranularity;
  markers?: Record<
    string,
    { average: number; count: number; max: number; min: number; total: number }
  >;
  metrics?: Record<string, number | null>;
  notes?: string[];
  samples?: unknown;
  scene: PerformanceScene;
  scenario: string;
  suite: string;
  tags?: string[];
  testInfo: TestInfo;
  toggles?: Record<string, boolean>;
  traceMode?: PerformanceTraceMode;
  url: string;
  viewport?: {
    deviceScaleFactor?: number | null;
    height?: number | null;
    width?: number | null;
  };
};

type PerformanceArtifactIndex = {
  artifacts: PerformanceArtifactIndexEntry[];
  updatedAt: string;
  version: 1;
};

type PerformanceArtifactIndexEntry = {
  artifactPath: string;
  averageFps: number | null;
  durationMs: number;
  granularity: PerformanceGranularity;
  runMode: PerformanceRunMode;
  scene: PerformanceScene;
  scenario: string;
  suite: string;
  timestamp: string;
  traceMode: PerformanceTraceMode;
};

const artifactRoot = path.resolve(process.cwd(), 'artifacts/playwright');
const performanceRoot = path.join(artifactRoot, 'performance');
const maxIndexEntries = 500;

export async function writePerformanceArtifact(
  input: PerformanceArtifactInput,
): Promise<PerformanceArtifactReport> {
  const runMode = readPerformanceRunMode();
  const traceMode = input.traceMode ?? 'sample';
  const timestamp = new Date().toISOString();
  const metadata: PerformanceArtifactMetadata = {
    artifactVersion: 1,
    git: {
      branch: readGitValue(['branch', '--show-current']),
      commit: readGitValue(['rev-parse', 'HEAD']),
      dirty: readGitDirty(),
    },
    granularity: input.granularity,
    machine: createMachineMetadata(),
    pid: process.pid,
    runMode,
    scene: input.scene,
    scenario: input.scenario,
    suite: input.suite,
    tags: input.tags ?? [],
    timestamp,
    traceMode,
    viewport: {
      deviceScaleFactor: input.viewport?.deviceScaleFactor ?? null,
      height: input.viewport?.height ?? null,
      width: input.viewport?.width ?? null,
    },
  };
  const metrics = {
    ...prefixMetrics('frame', input.frameStats ?? {}),
    ...prefixMetrics('count', input.counts ?? {}),
    ...prefixMetrics('markerAverage', readMarkerAverages(input.markers ?? {})),
    ...(input.metrics ?? {}),
  };
  const relativeArtifactPath = createPerformanceArtifactPath(metadata);
  const artifactPath = path.join(performanceRoot, relativeArtifactPath);
  const comparison =
    runMode === 'current' ? await compareWithLatestMilestone(metadata, metrics) : null;
  const report: PerformanceArtifactReport = {
    artifactPath,
    comparison,
    consoleMessages: (input.consoleMessages ?? []).slice(-20),
    counts: input.counts ?? {},
    durationMs: input.durationMs,
    frameStats: input.frameStats ?? {},
    markers: input.markers ?? {},
    metadata,
    metrics,
    notes: input.notes ?? [],
    samples: input.samples ?? null,
    toggles: input.toggles ?? {},
    url: input.url,
  };

  await writeJson(artifactPath, report);
  await writeLatestArtifactPointer(metadata, report);
  await updatePerformanceIndex(report);
  await input.testInfo.attach(`${input.suite}-${input.scenario}-performance`, {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  return report;
}

export function readPerformanceDurationMs(defaultValue: number): number {
  const raw = process.env.PERF_DURATION_MS ?? process.env.PROFILE_DURATION_MS;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function readPerformanceRunMode(): PerformanceRunMode {
  return process.env.PROFILE_RUN_MODE === 'milestone' ? 'milestone' : 'current';
}

function createPerformanceArtifactPath(metadata: PerformanceArtifactMetadata): string {
  const timestamp = metadata.timestamp.replace(/[:.]/g, '-');
  const scenario = sanitizePathPart(metadata.scenario);
  return [
    sanitizePathPart(metadata.suite),
    scenario,
    metadata.runMode,
    `${scenario}-${metadata.traceMode}-${timestamp}-${metadata.pid}.json`,
  ].join('/');
}

async function compareWithLatestMilestone(
  metadata: PerformanceArtifactMetadata,
  currentMetrics: Record<string, number | null>,
): Promise<PerformanceComparison | null> {
  const milestone = await readLatestMatchingMilestone(metadata);
  if (!milestone) return null;

  const metricNames = [
    ...new Set([...Object.keys(currentMetrics), ...Object.keys(milestone.report.metrics ?? {})]),
  ].sort();
  return {
    metricComparisons: Object.fromEntries(
      metricNames.map((name) => [
        name,
        compareMetric(currentMetrics[name] ?? null, milestone.report.metrics?.[name] ?? null),
      ]),
    ),
    milestoneArtifactPath: milestone.artifactPath,
    milestoneTimestamp: milestone.report.metadata?.timestamp ?? '(unknown)',
  };
}

async function readLatestMatchingMilestone(metadata: PerformanceArtifactMetadata): Promise<{
  artifactPath: string;
  report: Partial<PerformanceArtifactReport>;
} | null> {
  const milestoneDir = path.join(
    performanceRoot,
    sanitizePathPart(metadata.suite),
    sanitizePathPart(metadata.scenario),
    'milestone',
  );
  let entries: string[] = [];
  try {
    entries = await readdir(milestoneDir);
  } catch {
    entries = [];
  }

  const candidates: Array<{ artifactPath: string; report: Partial<PerformanceArtifactReport> }> =
    [];
  for (const entry of entries.filter((value) => value.endsWith('.json'))) {
    const artifactPath = path.join(milestoneDir, entry);
    const report = await readReport(artifactPath);
    if (isMatchingMilestone(report, metadata)) candidates.push({ artifactPath, report });
  }

  candidates.sort((a, b) =>
    String(b.report.metadata?.timestamp ?? '').localeCompare(
      String(a.report.metadata?.timestamp ?? ''),
    ),
  );
  return candidates[0] ?? null;
}

async function readReport(
  artifactPath: string,
): Promise<Partial<PerformanceArtifactReport> | null> {
  try {
    return JSON.parse(await readFile(artifactPath, 'utf8')) as Partial<PerformanceArtifactReport>;
  } catch {
    return null;
  }
}

function isMatchingMilestone(
  report: Partial<PerformanceArtifactReport> | null,
  metadata: PerformanceArtifactMetadata,
): report is Partial<PerformanceArtifactReport> {
  const milestone = report?.metadata;
  return (
    milestone?.runMode === 'milestone' &&
    milestone.suite === metadata.suite &&
    milestone.scenario === metadata.scenario &&
    milestone.scene === metadata.scene &&
    milestone.granularity === metadata.granularity &&
    milestone.traceMode === metadata.traceMode &&
    milestone.machine.hostname === metadata.machine.hostname &&
    milestone.viewport.width === metadata.viewport.width &&
    milestone.viewport.height === metadata.viewport.height &&
    milestone.viewport.deviceScaleFactor === metadata.viewport.deviceScaleFactor
  );
}

async function writeLatestArtifactPointer(
  metadata: PerformanceArtifactMetadata,
  report: PerformanceArtifactReport,
): Promise<void> {
  const latestPath = path.join(
    performanceRoot,
    'latest',
    sanitizePathPart(metadata.suite),
    `${sanitizePathPart(metadata.scenario)}-${metadata.runMode}.json`,
  );
  await writeJson(latestPath, {
    artifactPath: report.artifactPath,
    comparison: report.comparison,
    durationMs: report.durationMs,
    metrics: report.metrics,
    metadata,
  });
}

async function updatePerformanceIndex(report: PerformanceArtifactReport): Promise<void> {
  const indexPath = path.join(performanceRoot, 'index.json');
  const existing = await readPerformanceIndex(indexPath);
  const nextEntry: PerformanceArtifactIndexEntry = {
    artifactPath: report.artifactPath,
    averageFps: report.metrics['frame.averageFps'] ?? null,
    durationMs: report.durationMs,
    granularity: report.metadata.granularity,
    runMode: report.metadata.runMode,
    scene: report.metadata.scene,
    scenario: report.metadata.scenario,
    suite: report.metadata.suite,
    timestamp: report.metadata.timestamp,
    traceMode: report.metadata.traceMode,
  };
  const artifacts = [
    nextEntry,
    ...existing.artifacts.filter((entry) => entry.artifactPath !== report.artifactPath),
  ]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, maxIndexEntries);
  await writeJson(indexPath, {
    artifacts,
    updatedAt: new Date().toISOString(),
    version: 1,
  } satisfies PerformanceArtifactIndex);
}

async function readPerformanceIndex(indexPath: string): Promise<PerformanceArtifactIndex> {
  try {
    const parsed = JSON.parse(
      await readFile(indexPath, 'utf8'),
    ) as Partial<PerformanceArtifactIndex>;
    return {
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      version: 1,
    };
  } catch {
    return {
      artifacts: [],
      updatedAt: new Date(0).toISOString(),
      version: 1,
    };
  }
}

function prefixMetrics(
  prefix: string,
  metrics: Record<string, number | null>,
): Record<string, number | null> {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [`${prefix}.${key}`, value]),
  );
}

function readMarkerAverages(
  markers: Record<
    string,
    { average: number; count: number; max: number; min: number; total: number }
  >,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(markers)
      .map(([name, marker]) => [name, marker.average] as const)
      .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1])),
  );
}

function compareMetric(
  current: number | null,
  milestone: number | null,
): PerformanceMetricComparison {
  const delta = current !== null && milestone !== null ? current - milestone : null;
  return {
    current,
    delta,
    deltaPercent:
      delta !== null && milestone !== null && milestone !== 0 ? (delta / milestone) * 100 : null,
    milestone,
  };
}

function createMachineMetadata(): PerformanceArtifactMetadata['machine'] {
  const cpus = os.cpus();
  return {
    arch: os.arch(),
    cpuModel: cpus[0]?.model ?? null,
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
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

function sanitizePathPart(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'unnamed';
}

async function writeJson(artifactPath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
