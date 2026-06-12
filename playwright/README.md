# Playwright Harness

This folder is the repo-native path for browser screenshots, smoke checks, and Phaser profiling.

## Setup

Use Node 20 or newer.

```bash
pnpm install
pnpm playwright:install
```

## Commands

```bash
pnpm e2e
pnpm e2e:rendering
pnpm screenshot:arcade
pnpm screenshot:sandbox
pnpm profile:milestone
pnpm profile:current
pnpm profile:current -- -g crowded-effects
pnpm profile:current -- playwright/tests/sandbox-performance-cases.spec.ts
```

Playwright starts the Vite dev server on `http://127.0.0.1:9001` by default. If a server is already running, it reuses it. Override the target with:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:9001 PLAYWRIGHT_SKIP_WEBSERVER=true pnpm profile:current
```

## Profiling Knobs

The screenshot specs write:

- `artifacts/playwright/screenshots/arcade.png`
- `artifacts/playwright/screenshots/sandbox.png`

The rendering case specs write per-case screenshots and summaries:

- `artifacts/playwright/screenshots/arcade-render-cases/*.png`
- `artifacts/playwright/profiles/arcade-render-cases/*.json`

The granular performance specs write scenario artifacts:

- `artifacts/playwright/performance/{suite}/{scenario}/{current|milestone}/*.json`
- `artifacts/playwright/performance/latest/{suite}/{scenario}-{current|milestone}.json`
- `artifacts/playwright/performance/index.json`

Use `pnpm profile:milestone` on a known-good build before a milestone, release, or large
rendering change. Use `pnpm profile:current` while developing. Current scenario artifacts include
a `comparison.metricComparisons` block when a matching milestone exists for the same host,
viewport, suite, scenario, scene, granularity, and trace mode.
Milestone JSON files are intentionally unignored so they can be committed as repo baselines;
current runs, latest pointers, screenshots, traces, and test results remain local-only.

Both profile scripts run the full granular suite by default. Pass Playwright args after `--` to
narrow the run:

```bash
pnpm profile:current -- -g crowded-effects
pnpm profile:milestone -- playwright/tests/demo-render-techniques.spec.ts
```

The performance suites intentionally use different scopes:

- `phaser-systems`: general arcade/sandbox startup, frame-loop, render-tree, texture, and canvas telemetry.
- `arcade-feature-cases`: focused black hole, metaball, portal, wrapping, and intersection states.
- `sandbox-feature-cases`: sandbox free-flight, navigation overlay, minimap/biome, and crowded effects states.
- `render-techniques`: demo-scene fixture profiles for planet texture caching and asteroid atlas rotation. These profile the rendering techniques only; they do not test demo gameplay.

Useful environment variables:

```bash
PERF_DURATION_MS=2500 pnpm profile:current
ARCADE_BLACK_HOLES=false pnpm profile:current
SANDBOX_MINIMAP=false pnpm profile:current
```

Use `PERF_DURATION_MS` to change the sample window for the granular performance suite.
