const { chromium } = require('@playwright/test');
const { writeProfileArtifact } = require('./profileArtifacts.cjs');

const DEFAULT_URL = process.env.PROFILE_URL ?? 'http://127.0.0.1:9001/phaser-game.html';
const DEFAULT_DURATION_MS = 8000;

async function main() {
  const args = readScriptArgs();
  const url = args[0] ?? DEFAULT_URL;
  const durationMs = Number.parseInt(args[1] ?? '', 10) || DEFAULT_DURATION_MS;
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 },
  });
  const cdp = await page.context().newCDPSession(page);
  const consoleMessages = [];

  page.on('console', (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    await page.addInitScript((toggles) => {
      window.__profileSandboxBiomeDebug = toggles.biomeDebug;
      window.__profileSandboxBlackHoles = toggles.blackHoles;
      window.__profileSandboxFuelMetaballs = toggles.fuelMetaballs;
      window.__profileSandboxGrid = toggles.grid;
      window.__profileSandboxMinimap = toggles.minimap;
      window.__profileSandboxNebulaRegions = toggles.nebulaRegions;
      window.__profileSandboxPlayerHud = toggles.playerHud;
      window.__profileSandboxStarfield = toggles.starfield;
      window.__profileSandboxThreeBackground = toggles.threeBackground;
      window.__profileSandboxTrajectoryPreview = toggles.trajectoryPreview;
    }, getProfileToggles());

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      sessionStorage.setItem('comet-bursters-sandboxPerfMarkers', 'false');
      sessionStorage.setItem('comet-bursters-sandboxBiomeDebug', window.__profileSandboxBiomeDebug);
      sessionStorage.setItem('comet-bursters-sandboxBlackHoles', window.__profileSandboxBlackHoles);
      sessionStorage.setItem(
        'comet-bursters-sandboxFuelMetaballs',
        window.__profileSandboxFuelMetaballs,
      );
      sessionStorage.setItem('comet-bursters-sandboxGrid', window.__profileSandboxGrid);
      sessionStorage.setItem('comet-bursters-sandboxMinimap', window.__profileSandboxMinimap);
      sessionStorage.setItem(
        'comet-bursters-sandboxNebulaRegions',
        window.__profileSandboxNebulaRegions,
      );
      sessionStorage.setItem('comet-bursters-sandboxPlayerHud', window.__profileSandboxPlayerHud);
      sessionStorage.setItem('comet-bursters-sandboxStarfield', window.__profileSandboxStarfield);
      sessionStorage.setItem(
        'comet-bursters-sandboxThreeBackground',
        window.__profileSandboxThreeBackground,
      );
      sessionStorage.setItem(
        'comet-bursters-sandboxTrajectoryPreview',
        window.__profileSandboxTrajectoryPreview,
      );
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('canvas').waitFor({ state: 'visible' });
    await page.mouse.click(640, 484);
    await page.waitForTimeout(1200);
    const graphicsBeforeProfile = await collectGraphicsSummary(page);

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

    const tracePromise = readTrace(cdp);
    await cdp.send('Tracing.end');
    const traceEvents = await tracePromise;
    const { profile } = await cdp.send('Profiler.stop');
    const frameStats = await page.evaluate(() => {
      const sample = window.__cometBurstersFrameSample;
      if (!sample || sample.frames.length < 2) return null;
      const frames = sample.frames;
      const deltas = [];
      for (let index = 1; index < frames.length; index += 1) {
        deltas.push(frames[index] - frames[index - 1]);
      }
      const averageDeltaMs = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
      return {
        averageDeltaMs,
        averageFps: 1000 / averageDeltaMs,
        frameCount: frames.length,
        maxDeltaMs: Math.max(...deltas),
        minDeltaMs: Math.min(...deltas),
      };
    });
    const graphicsAfterProfile = await collectGraphicsSummary(page);

    const timeline = summarizeTrace(traceEvents);
    const cpu = summarizeCpuProfile(profile);
    const report = await writeProfileArtifact({
      report: {
        consoleMessages: consoleMessages.slice(-20),
        cpu,
        durationMs,
        frameStats,
        graphicsAfterProfile,
        graphicsBeforeProfile,
        timeline,
        url,
      },
      scene: 'sandbox',
      traceMode: 'trace',
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

async function collectGraphicsSummary(page) {
  return page.evaluate(() => {
    const game = window.__cometBurstersGame;
    const scenes = game?.scene?.getScenes?.(true) ?? [];
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

function readTrace(cdp) {
  return new Promise((resolve, reject) => {
    cdp.once('Tracing.tracingComplete', async ({ stream }) => {
      try {
        let result = '';
        let eof = false;
        while (!eof) {
          const chunk = await cdp.send('IO.read', { handle: stream });
          result += chunk.data;
          eof = chunk.eof;
        }
        await cdp.send('IO.close', { handle: stream });
        const parsed = JSON.parse(result);
        resolve(parsed.traceEvents ?? []);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function summarizeTrace(events) {
  const completeEvents = events.filter((event) => event.ph === 'X' && event.dur > 0);
  const byName = summarizeDurations(completeEvents, (event) => event.name);
  const rendererMain = completeEvents.filter((event) => isRendererMainEvent(event));
  const gpu = completeEvents.filter((event) => String(event.cat ?? '').includes('gpu'));
  const topLongEvents = completeEvents
    .filter((event) => event.dur >= 1000)
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 30)
    .map((event) => ({
      category: event.cat,
      durationMs: event.dur / 1000,
      name: event.name,
      thread: event.tid,
    }));

  return {
    eventTotals: byName.slice(0, 30),
    gpuTotals: summarizeDurations(gpu, (event) => event.name).slice(0, 20),
    rendererMainTotals: summarizeDurations(rendererMain, (event) => event.name).slice(0, 30),
    topLongEvents,
  };
}

function getProfileToggles() {
  return {
    biomeDebug: getBooleanEnv('SANDBOX_BIOME_DEBUG', false),
    blackHoles: getBooleanEnv('SANDBOX_BLACK_HOLES', true),
    fuelMetaballs: getBooleanEnv('SANDBOX_FUEL_METABALLS', true),
    grid: getBooleanEnv('SANDBOX_GRID', true),
    minimap: getBooleanEnv('SANDBOX_MINIMAP', true),
    nebulaRegions: getBooleanEnv('SANDBOX_NEBULA_REGIONS', true),
    playerHud: getBooleanEnv('SANDBOX_PLAYER_HUD', true),
    starfield: getBooleanEnv('SANDBOX_STARFIELD', true),
    threeBackground: getBooleanEnv('SANDBOX_THREE_BACKGROUND', true),
    trajectoryPreview: getBooleanEnv('SANDBOX_TRAJECTORY_PREVIEW', true),
  };
}

function readScriptArgs() {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

function getBooleanEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined) return String(defaultValue);
  return raw !== 'false' && raw !== '0' ? 'true' : 'false';
}

function summarizeDurations(events, getKey) {
  const totals = new Map();
  for (const event of events) {
    const key = getKey(event);
    const current = totals.get(key) ?? { count: 0, totalMs: 0 };
    current.count += 1;
    current.totalMs += event.dur / 1000;
    totals.set(key, current);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

function isRendererMainEvent(event) {
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

function summarizeCpuProfile(profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const samples = profile.samples ?? [];
  const timeDeltas = profile.timeDeltas ?? [];
  const totals = new Map();
  for (let index = 0; index < samples.length; index += 1) {
    const node = nodes.get(samples[index]);
    if (!node) {
      // no-op
    } else {
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
