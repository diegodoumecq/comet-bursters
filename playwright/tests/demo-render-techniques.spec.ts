import playwright from '@playwright/test';

import {
  demoTechniqueCounts,
  focusDemoTechnique,
  openDemoGame,
  recordScenarioSample,
} from '../support/performanceScenarios';
import { captureConsoleDiagnostics } from '../support/sandboxHarness';

const playwrightApi = playwright as typeof playwright & { test?: typeof playwright };
const expect = playwrightApi.expect;
const test = playwrightApi.test ?? playwright;

const DEMO_TECHNIQUES = ['planet-texture-cache', 'asteroid-atlas-rotation'] as const;

test.describe('Focused render technique performance', () => {
  for (const technique of DEMO_TECHNIQUES) {
    test(`profiles ${technique}`, async ({ page }, testInfo) => {
      const diagnostics = captureConsoleDiagnostics(page);

      await openDemoGame(page);
      const summary = await focusDemoTechnique(page, technique);
      const report = await recordScenarioSample(page, {
        consoleMessages: diagnostics.messages,
        counts: demoTechniqueCounts(summary),
        granularity: 'technique',
        metrics: {
          asteroidAtlasTextures: summary.textures.asteroidAtlases,
          planetTextures: summary.textures.planetTextures,
        },
        notes: ['Demo scene is used as a controlled fixture; this does not test demo gameplay.'],
        samples: summary,
        scene: 'demo',
        scenario: technique,
        suite: 'render-techniques',
        tags: ['demo-fixture', 'textures'],
        testInfo,
      });
      diagnostics.stop();

      expect(summary.activeScenes).toContain('demo');
      expect(summary.canvases.some((canvas) => canvas.visible && canvas.width > 0)).toBe(true);
      expect(report.frameStats.frameCount ?? 0).toBeGreaterThan(1);
      console.log(`${technique} performance: ${report.artifactPath}`);
      if (report.comparison) {
        console.log(`${technique} milestone: ${report.comparison.milestoneArtifactPath}`);
      }
    });
  }
});
