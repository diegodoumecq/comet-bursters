import playwright, { type Page } from '@playwright/test';

import {
  collectSceneTelemetry,
  recordScenarioSample,
  sceneTelemetryCounts,
} from '../support/performanceScenarios';
import {
  captureConsoleDiagnostics,
  getArcadeProfileTogglesFromEnv,
  getSandboxProfileTogglesFromEnv,
  openArcadeGame,
  openSandboxGame,
  type SandboxProfileToggles,
} from '../support/sandboxHarness';

const playwrightApi = playwright as typeof playwright & { test?: typeof playwright };
const expect = playwrightApi.expect;
const test = playwrightApi.test ?? playwright;

type GeneralSystemCase = {
  name: 'arcade-systems' | 'sandbox-systems';
  open: (page: Page, toggles: SandboxProfileToggles) => Promise<void>;
  scene: 'arcade' | 'sandbox';
  toggles: () => SandboxProfileToggles;
};

const GENERAL_SYSTEM_CASES: GeneralSystemCase[] = [
  {
    name: 'arcade-systems',
    open: (page, toggles) => openArcadeGame(page, { settleMs: 900, toggles }),
    scene: 'arcade',
    toggles: getArcadeProfileTogglesFromEnv,
  },
  {
    name: 'sandbox-systems',
    open: (page, toggles) => openSandboxGame(page, { settleMs: 900, toggles }),
    scene: 'sandbox',
    toggles: getSandboxProfileTogglesFromEnv,
  },
];

test.describe('Phaser performance systems', () => {
  for (const systemCase of GENERAL_SYSTEM_CASES) {
    test(`tracks ${systemCase.name}`, async ({ page }, testInfo) => {
      const diagnostics = captureConsoleDiagnostics(page);
      const toggles = {
        ...systemCase.toggles(),
        markers: true,
      };

      await systemCase.open(page, toggles);
      const telemetry = await collectSceneTelemetry(page);
      const report = await recordScenarioSample(page, {
        consoleMessages: diagnostics.messages,
        counts: sceneTelemetryCounts(telemetry),
        granularity: 'system',
        metrics: {
          activeScenePresent: telemetry.activeScenes.includes(systemCase.scene) ? 1 : 0,
          textureTotal: telemetry.textures.total,
        },
        samples: telemetry,
        scene: systemCase.scene,
        scenario: systemCase.name,
        suite: 'phaser-systems',
        tags: ['startup', 'frame-loop', 'render-tree'],
        testInfo,
        toggles,
      });
      diagnostics.stop();

      expect(telemetry.activeScenes).toContain(systemCase.scene);
      expect(telemetry.canvases.some((canvas) => canvas.visible && canvas.width > 0)).toBe(true);
      expect(report.frameStats.frameCount ?? 0).toBeGreaterThan(1);
      console.log(`${systemCase.name} performance: ${report.artifactPath}`);
      if (report.comparison) {
        console.log(`${systemCase.name} milestone: ${report.comparison.milestoneArtifactPath}`);
      }
    });
  }
});
