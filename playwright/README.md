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
pnpm profile:arcade
pnpm profile:sandbox
pnpm profile:arcade:milestone
pnpm profile:arcade:current
pnpm profile:sandbox:milestone
pnpm profile:sandbox:current
pnpm profile:sandbox:perf -- http://127.0.0.1:9001/phaser-game.html 5000
pnpm profile:sandbox:perf:milestone -- http://127.0.0.1:9001/phaser-game.html 5000
pnpm profile:sandbox:trace -- http://127.0.0.1:9001/phaser-game.html 8000
pnpm profile:sandbox:trace:milestone -- http://127.0.0.1:9001/phaser-game.html 8000
```

Playwright starts the Vite dev server on `http://127.0.0.1:9001` by default. If a server is already running, it reuses it. Override the target with:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:9001 PLAYWRIGHT_SKIP_WEBSERVER=true pnpm profile:arcade
```

## Profiling Knobs

The arcade profiler writes:

- `artifacts/playwright/profiles/arcade/{current|milestone}/arcade-profile-{trace|sample}-*.json`

The sandbox profiler writes:

- `artifacts/playwright/profiles/sandbox/{current|milestone}/sandbox-profile-{trace|sample}-*.json`
- Playwright traces, screenshots, and videos on failure under `artifacts/playwright/test-results`

Use `pnpm profile:*:milestone` after a known-good version. Use `pnpm profile:*:current`
while developing; current reports include a `comparison` block against the newest matching
milestone from the same machine, scene, and trace mode.

The screenshot specs write:

- `artifacts/playwright/screenshots/arcade.png`
- `artifacts/playwright/screenshots/sandbox.png`

The rendering case specs write per-case screenshots and summaries:

- `artifacts/playwright/screenshots/arcade-render-cases/*.png`
- `artifacts/playwright/profiles/arcade-render-cases/*.json`

Useful environment variables:

```bash
PROFILE_DURATION_MS=10000 pnpm profile:arcade
PROFILE_TRACE=false pnpm profile:arcade
PROFILE_RUN_MODE=milestone pnpm profile:arcade
ARCADE_THREE_BACKGROUND=false pnpm profile:arcade
ARCADE_STARFIELD=false pnpm profile:arcade
ARCADE_BLACK_HOLES=false pnpm profile:arcade
ARCADE_FUEL_METABALLS=false pnpm profile:arcade
ARCADE_GRID=false pnpm profile:arcade

PROFILE_DURATION_MS=10000 pnpm profile:sandbox
PROFILE_TRACE=false pnpm profile:sandbox
PROFILE_RUN_MODE=milestone pnpm profile:sandbox
SANDBOX_THREE_BACKGROUND=false pnpm profile:sandbox
SANDBOX_STARFIELD=false pnpm profile:sandbox
SANDBOX_BLACK_HOLES=false pnpm profile:sandbox
SANDBOX_FUEL_METABALLS=false pnpm profile:sandbox
SANDBOX_MINIMAP=false pnpm profile:sandbox
SANDBOX_NEBULA_REGIONS=false pnpm profile:sandbox
SANDBOX_TRAJECTORY_PREVIEW=false pnpm profile:sandbox
```

Use `PROFILE_TRACE=false` for quick FPS/perf-marker samples. Keep tracing enabled when you need CPU, GPU, and renderer timeline summaries.
