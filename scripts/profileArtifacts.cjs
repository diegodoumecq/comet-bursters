const { execFileSync } = require('node:child_process');
const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const artifactRoot = path.resolve(process.cwd(), 'artifacts/playwright');

async function writeProfileArtifact({ report, scene, traceMode }) {
  const metadata = createProfileMetadata(scene, traceMode, readProfileRunMode());
  const relativeArtifactPath = createProfileArtifactPath(metadata);
  const artifactPath = path.join(artifactRoot, relativeArtifactPath);
  const fullReport = {
    ...report,
    artifactPath,
    comparison:
      metadata.runMode === 'current'
        ? await compareWithLatestMilestone(scene, traceMode, metadata, report)
        : null,
    metadata,
    traceMode,
  };
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(fullReport, null, 2)}\n`, 'utf8');
  return fullReport;
}

function readProfileRunMode() {
  return process.env.PROFILE_RUN_MODE === 'milestone' ? 'milestone' : 'current';
}

function createProfileMetadata(scene, traceMode, runMode) {
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

function createProfileArtifactPath(metadata) {
  const timestamp = metadata.timestamp.replace(/[:.]/g, '-');
  return `profiles/${metadata.scene}/${metadata.runMode}/${metadata.scene}-profile-${metadata.traceMode}-${timestamp}-${metadata.pid}.json`;
}

async function compareWithLatestMilestone(scene, traceMode, metadata, currentReport) {
  const milestone = await readLatestMatchingMilestone(scene, traceMode, metadata);
  if (!milestone) return null;

  return {
    frameStats: compareFrameStats(
      currentReport.frameStats ?? null,
      milestone.report.frameStats ?? null,
    ),
    markerAverages: compareMarkerAverages(
      currentReport.frameSnapshot,
      milestone.report.frameSnapshot,
    ),
    milestoneArtifactPath: milestone.artifactPath,
    milestoneTimestamp: milestone.report.metadata?.timestamp ?? '(unknown)',
  };
}

async function readLatestMatchingMilestone(scene, traceMode, metadata) {
  const milestoneDir = path.join(artifactRoot, 'profiles', scene, 'milestone');
  let entries = [];
  try {
    entries = await readdir(milestoneDir);
  } catch {
    entries = [];
  }

  const candidates = [];
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

async function readProfileReport(artifactPath) {
  try {
    return JSON.parse(await readFile(artifactPath, 'utf8'));
  } catch {
    return null;
  }
}

function isMatchingMilestone(report, scene, traceMode, metadata) {
  return (
    report?.metadata?.runMode === 'milestone' &&
    report.metadata.scene === scene &&
    report.metadata.traceMode === traceMode &&
    report.metadata.machine.hostname === metadata.machine.hostname
  );
}

function compareFrameStats(current, milestone) {
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

function compareMarkerAverages(currentSnapshot, milestoneSnapshot) {
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

function readMarkerAverages(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  return Object.fromEntries(
    Object.entries(snapshot)
      .map(([name, value]) => [name, readAverageMetric(value)])
      .filter((entry) => typeof entry[1] === 'number'),
  );
}

function readAverageMetric(value) {
  if (!value || typeof value !== 'object') return null;
  const average = value.average;
  return typeof average === 'number' && Number.isFinite(average) ? average : null;
}

function compareMetric(current, milestone) {
  const delta = current !== null && milestone !== null ? current - milestone : null;
  return {
    current,
    delta,
    deltaPercent:
      delta !== null && milestone !== null && milestone !== 0 ? (delta / milestone) * 100 : null,
    milestone,
  };
}

function readGitValue(args) {
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

function readGitDirty() {
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

module.exports = {
  writeProfileArtifact,
};
