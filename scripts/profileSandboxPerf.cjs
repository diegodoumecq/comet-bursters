const { chromium } = require('@playwright/test');
const { writeProfileArtifact } = require('./profileArtifacts.cjs');

const DEFAULT_URL = process.env.PROFILE_URL ?? 'http://127.0.0.1:9001/phaser-game.html';
const DEFAULT_DURATION_MS = 5000;

async function main() {
  const args = readScriptArgs();
  const url = args[0] ?? DEFAULT_URL;
  const durationMs = Number.parseInt(args[1] ?? '', 10) || DEFAULT_DURATION_MS;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 },
  });
  const consoleMessages = [];

  page.on('console', (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      sessionStorage.setItem('comet-bursters-sandboxPerfMarkers', 'true');
      sessionStorage.setItem('comet-bursters-sandboxBiomeDebug', 'false');
      sessionStorage.setItem('comet-bursters-sandboxBlackHoles', 'true');
      sessionStorage.setItem('comet-bursters-sandboxFuelMetaballs', 'true');
      sessionStorage.setItem('comet-bursters-sandboxMinimap', 'true');
      sessionStorage.setItem('comet-bursters-sandboxNebulaRegions', 'true');
      sessionStorage.setItem('comet-bursters-sandboxStarfield', 'true');
      sessionStorage.setItem('comet-bursters-sandboxThreeBackground', 'true');
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('canvas').waitFor({ state: 'visible' });
    await page.mouse.click(640, 484);
    await page.waitForTimeout(1000);
    const startupSnapshot = await page.evaluate(
      () => window.__cometBurstersPerf?.snapshot?.() ?? null,
    );
    await page.evaluate(() => window.__cometBurstersPerf?.clear());
    await page.evaluate(() => {
      window.__cometBurstersFrameSample = {
        frames: [],
        start: performance.now(),
      };
      const sample = () => {
        const state = window.__cometBurstersFrameSample;
        if (!state) return;
        state.frames.push(performance.now());
        window.requestAnimationFrame(sample);
      };
      window.requestAnimationFrame(sample);
    });
    await page.waitForTimeout(durationMs);

    const frameSnapshot = await page.evaluate(
      () => window.__cometBurstersPerf?.snapshot?.() ?? null,
    );
    const frameStats = await page.evaluate(() => {
      const sample = window.__cometBurstersFrameSample;
      if (!sample || sample.frames.length < 2) return null;
      const frames = sample.frames;
      const deltas = [];
      for (let index = 1; index < frames.length; index += 1) {
        deltas.push(frames[index] - frames[index - 1]);
      }
      const totalMs = frames[frames.length - 1] - frames[0];
      const averageDeltaMs = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
      return {
        averageDeltaMs,
        averageFps: 1000 / averageDeltaMs,
        durationMs: totalMs,
        frameCount: frames.length,
        maxDeltaMs: Math.max(...deltas),
        minDeltaMs: Math.min(...deltas),
      };
    });
    const report = await writeProfileArtifact({
      report: {
        consoleMessages: consoleMessages.slice(-20),
        durationMs,
        frameStats,
        frameSnapshot,
        startupSnapshot,
        url,
      },
      scene: 'sandbox',
      traceMode: 'sample',
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function readScriptArgs() {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}
