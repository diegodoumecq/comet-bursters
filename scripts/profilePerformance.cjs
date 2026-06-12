const { spawnSync } = require('node:child_process');

const DEFAULT_PERFORMANCE_SPECS = [
  'playwright/tests/performance-general.spec.ts',
  'playwright/tests/arcade-performance-cases.spec.ts',
  'playwright/tests/sandbox-performance-cases.spec.ts',
  'playwright/tests/demo-render-techniques.spec.ts',
];

const PLAYWRIGHT_DEFAULT_ARGS = ['--project=profile-chromium', '--workers=1', '--reporter=line'];

const OPTIONS_WITH_VALUE = new Set([
  '-c',
  '--config',
  '-g',
  '--grep',
  '--grep-invert',
  '--global-timeout',
  '--max-failures',
  '--output',
  '--project',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--shard',
  '--timeout',
  '--trace',
  '--update-snapshots',
  '--workers',
]);

const mode = process.argv[2];
const userArgs = process.argv.slice(3).filter((arg) => arg !== '--');

if (mode !== 'current' && mode !== 'milestone') {
  console.error('Usage: node scripts/profilePerformance.cjs <current|milestone> [playwright args]');
  process.exitCode = 1;
} else {
  const testSelection = hasPositionalTestTarget(userArgs)
    ? userArgs
    : [...DEFAULT_PERFORMANCE_SPECS, ...userArgs];
  const result = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', ...testSelection, ...PLAYWRIGHT_DEFAULT_ARGS],
    {
      env: {
        ...process.env,
        PROFILE_RUN_MODE: mode,
      },
      stdio: 'inherit',
    },
  );
  process.exitCode = result.status ?? 1;
}

function hasPositionalTestTarget(args) {
  let skipNext = false;
  for (const arg of args) {
    if (skipNext) {
      skipNext = false;
    } else if (OPTIONS_WITH_VALUE.has(arg)) {
      skipNext = true;
    } else if (!arg.startsWith('-')) {
      return true;
    }
  }
  return false;
}
