const { chromium } = require('@playwright/test');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const DEFAULT_URL = process.env.PLAYWRIGHT_BASE_URL
  ? `${process.env.PLAYWRIGHT_BASE_URL.replace(/\/$/, '')}/phaser-game.html`
  : 'http://127.0.0.1:9001/phaser-game.html';
const DEFAULT_DURATION_MS = 3500;
const artifactRoot = path.resolve(process.cwd(), 'artifacts/playwright/minimap-profile');

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const durationMs =
    Number.parseInt(process.env.MINIMAP_PROFILE_DURATION_MS ?? '', 10) || DEFAULT_DURATION_MS;
  const url = process.env.MINIMAP_PROFILE_URL ?? DEFAULT_URL;
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=CalculateNativeWinOcclusion',
    ],
  });

  try {
    const off = await runScenario(browser, { durationMs, minimap: false, url });
    const on = await runScenario(browser, { durationMs, minimap: true, url });
    const report = {
      createdAt: new Date().toISOString(),
      durationMs,
      off,
      on,
      onMinusOff: diffReports(on, off),
      url,
    };
    mkdirSync(artifactRoot, { recursive: true });
    const artifactPath = path.join(
      artifactRoot,
      `minimap-profile-${report.createdAt.replace(/[:.]/g, '-')}-${process.pid}.json`,
    );
    writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Minimap profile: ${artifactPath}`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

async function runScenario(browser, options) {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 },
  });
  try {
    await page.addInitScript((minimap) => {
      const toggles = {
        sandboxBiomeDebug: true,
        sandboxBlackHoles: false,
        sandboxFuelMetaballs: false,
        sandboxGrid: true,
        sandboxMinimap: minimap,
        sandboxNebulaRegions: true,
        sandboxPerfMarkers: true,
        sandboxPlayerHud: true,
        sandboxStarfield: true,
        sandboxThreeBackground: false,
        sandboxTrajectoryPreview: true,
      };
      for (const [key, value] of Object.entries(toggles)) {
        window.sessionStorage.setItem(`comet-bursters-${key}`, String(value));
      }
    }, options.minimap);

    await openSandbox(page, options.url);
    const telemetryBefore = await collectTelemetry(page);
    await clearPerfSnapshot(page);
    await startFrameSampling(page);
    await page.waitForTimeout(options.durationMs);
    const telemetryAfter = await collectTelemetry(page);
    const frameStats = await collectFrameStats(page);
    const markers = await collectPerfSnapshot(page);
    return {
      frameStats,
      markers,
      minimap: options.minimap,
      telemetryAfter,
      telemetryBefore,
    };
  } finally {
    await page.close();
  }
}

async function openSandbox(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => window.__cometBurstersGame?.scene?.getScene?.('scene-menu')?.scene?.isActive?.() === true,
  );
  await page.mouse.click(640, 484);
  await page.waitForFunction(
    () => window.__cometBurstersGame?.scene?.getScene?.('sandbox')?.scene?.isActive?.() === true,
  );
  await page.waitForTimeout(1400);
}

async function collectTelemetry(page) {
  return page.evaluate(() => {
    const game = window.__cometBurstersGame;
    const scenes = game?.scene?.getScenes?.(true) ?? [];
    const textureKeys = Object.keys(game?.textures?.list ?? {});
    const children = scenes.flatMap((scene) =>
      (scene.children?.list ?? []).map((child) => ({
        commandBufferLength: Array.isArray(child.commandBuffer) ? child.commandBuffer.length : null,
        name: child.name || '(unnamed)',
        sceneKey: scene.scene.key,
        type: child.type,
        visible: child.visible,
      })),
    );
    return {
      displayObjects: children.length,
      graphics: children.filter((child) => child.type === 'Graphics').length,
      minimapChildren: children.filter((child) => child.name.startsWith('minimap-')),
      minimapTextureKeys: textureKeys.filter((key) => key.includes('minimap')),
      renderTextures: children
        .filter((child) => child.type === 'RenderTexture')
        .map((child) => child.name),
      textureCount: textureKeys.length,
    };
  });
}

async function clearPerfSnapshot(page) {
  await page.evaluate(() => window.__cometBurstersPerf?.clear?.());
}

async function collectPerfSnapshot(page) {
  return page.evaluate(() => window.__cometBurstersPerf?.snapshot?.() ?? null);
}

async function startFrameSampling(page) {
  await page.evaluate(() => {
    window.__cometBurstersMinimapFrameSample = [];
    const sample = () => {
      const frames = window.__cometBurstersMinimapFrameSample;
      if (frames) {
        frames.push(performance.now());
        window.requestAnimationFrame(sample);
      }
    };
    window.requestAnimationFrame(sample);
  });
}

async function collectFrameStats(page) {
  return page.evaluate(() => {
    const frames = window.__cometBurstersMinimapFrameSample ?? [];
    if (frames.length < 2) return null;
    const deltas = [];
    for (let index = 1; index < frames.length; index += 1) {
      deltas.push(frames[index] - frames[index - 1]);
    }
    const averageDeltaMs = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    return {
      averageDeltaMs,
      averageFps: 1000 / averageDeltaMs,
      frameCount: frames.length,
      maxDeltaMs: Math.max(...deltas),
      minDeltaMs: Math.min(...deltas),
    };
  });
}

function diffReports(on, off) {
  return {
    averageDeltaMs: diffMetric(on.frameStats?.averageDeltaMs, off.frameStats?.averageDeltaMs),
    averageFps: diffMetric(on.frameStats?.averageFps, off.frameStats?.averageFps),
    displayObjects: diffMetric(on.telemetryAfter.displayObjects, off.telemetryAfter.displayObjects),
    graphics: diffMetric(on.telemetryAfter.graphics, off.telemetryAfter.graphics),
    minimapRenderAverageMs: diffMetric(
      on.markers?.['sandbox.render.minimap']?.average,
      off.markers?.['sandbox.render.minimap']?.average ?? 0,
    ),
    renderTextures: diffMetric(
      on.telemetryAfter.renderTextures.length,
      off.telemetryAfter.renderTextures.length,
    ),
  };
}

function diffMetric(current, baseline) {
  if (typeof current !== 'number' || typeof baseline !== 'number') return null;
  return current - baseline;
}
