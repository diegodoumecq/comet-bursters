import playwright from '@playwright/test';

import {
  applyArcadeRenderCase,
  collectArcadeRenderSummary,
  type ArcadeRenderCaseName,
} from '../support/arcadeRenderCases';
import { recordScenarioSample } from '../support/performanceScenarios';
import {
  captureConsoleDiagnostics,
  getArcadeProfileTogglesFromEnv,
  openArcadeGame,
} from '../support/sandboxHarness';

const playwrightApi = playwright as typeof playwright & { test?: typeof playwright };
const expect = playwrightApi.expect;
const test = playwrightApi.test ?? playwright;

const ARCADE_PERF_CASES: ArcadeRenderCaseName[] = [
  'blackHoleMetaballs',
  'portalBlackHoleCrossing',
  'fullIntersection',
];

test.describe('Arcade feature performance cases', () => {
  for (const caseName of ARCADE_PERF_CASES) {
    test(`profiles arcade ${caseName}`, async ({ page }, testInfo) => {
      const diagnostics = captureConsoleDiagnostics(page);
      const toggles = {
        ...getArcadeProfileTogglesFromEnv(),
        markers: true,
      };

      await openArcadeGame(page, { toggles });
      await applyArcadeRenderCase(page, caseName);
      const summary = await collectArcadeRenderSummary(page);
      const report = await recordScenarioSample(page, {
        consoleMessages: diagnostics.messages,
        counts: {
          arcadeAsteroids: summary.arcadeAsteroids,
          blackHoles: summary.blackHoles,
          fuelBlobs: summary.fuelBlobs,
          riftAsteroids: summary.riftAsteroids,
          riftBlackHoles: summary.riftBlackHoles,
          toroidalAsteroidCopies: summary.toroidalAsteroidCopyCount,
          wrappedBlackHoles: summary.wrappedBlackHoleCount,
        },
        granularity: 'case',
        metrics: {
          activePortal: summary.activePortal ? 1 : 0,
          sceneActive: summary.sceneActive ? 1 : 0,
        },
        samples: summary,
        scene: 'arcade',
        scenario: caseName,
        suite: 'arcade-feature-cases',
        tags: ['arcade', 'effects', 'portals'],
        testInfo,
        toggles,
      });
      diagnostics.stop();

      expect(summary.sceneActive).toBe(true);
      expect(summary.activeScenes).toContain('arcade');
      expect(report.frameStats.frameCount ?? 0).toBeGreaterThan(1);
      console.log(`Arcade ${caseName} performance: ${report.artifactPath}`);
      if (report.comparison) {
        console.log(`Arcade ${caseName} milestone: ${report.comparison.milestoneArtifactPath}`);
      }
    });
  }
});
