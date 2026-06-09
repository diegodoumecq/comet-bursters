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
```

Playwright starts the Vite dev server on `http://127.0.0.1:9001` by default. If a server is already running, it reuses it. Override the target with:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:9001 PLAYWRIGHT_SKIP_WEBSERVER=true pnpm profile:arcade
```

## Profiling Knobs

The arcade profiler writes:

- `artifacts/playwright/profiles/arcade-profile.json`
- `artifacts/playwright/screenshots/arcade.png`

The sandbox profiler writes:

- `artifacts/playwright/profiles/sandbox-profile.json`
- `artifacts/playwright/screenshots/sandbox.png`
- Playwright traces, screenshots, and videos on failure under `artifacts/playwright/test-results`

The rendering case specs write per-case screenshots and summaries:

- `artifacts/playwright/screenshots/arcade-render-cases/*.png`
- `artifacts/playwright/profiles/arcade-render-cases/*.json`

Useful environment variables:

```bash
PROFILE_DURATION_MS=10000 pnpm profile:arcade
PROFILE_TRACE=false pnpm profile:arcade
ARCADE_THREE_BACKGROUND=false pnpm profile:arcade
ARCADE_STARFIELD=false pnpm profile:arcade
ARCADE_BLACK_HOLES=false pnpm profile:arcade
ARCADE_FUEL_METABALLS=false pnpm profile:arcade
ARCADE_GRID=false pnpm profile:arcade

PROFILE_DURATION_MS=10000 pnpm profile:sandbox
PROFILE_TRACE=false pnpm profile:sandbox
SANDBOX_THREE_BACKGROUND=false pnpm profile:sandbox
SANDBOX_STARFIELD=false pnpm profile:sandbox
SANDBOX_BLACK_HOLES=false pnpm profile:sandbox
SANDBOX_FUEL_METABALLS=false pnpm profile:sandbox
SANDBOX_MINIMAP=false pnpm profile:sandbox
SANDBOX_NEBULA_REGIONS=false pnpm profile:sandbox
SANDBOX_TRAJECTORY_PREVIEW=false pnpm profile:sandbox
```

Use `PROFILE_TRACE=false` for quick FPS/perf-marker samples. Keep tracing enabled when you need CPU, GPU, and renderer timeline summaries.
