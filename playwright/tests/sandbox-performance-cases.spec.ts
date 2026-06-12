import playwright from '@playwright/test';

import {
  applySandboxPerfCase,
  collectSandboxFeatureSummary,
  recordScenarioSample,
  sandboxFeatureCounts,
} from '../support/performanceScenarios';
import {
  captureConsoleDiagnostics,
  getSandboxProfileTogglesFromEnv,
  openSandboxGame,
  type SandboxProfileToggles,
} from '../support/sandboxHarness';

const playwrightApi = playwright as typeof playwright & { test?: typeof playwright };
const expect = playwrightApi.expect;
const test = playwrightApi.test ?? playwright;

type SandboxPerfCase = {
  apply?: 'crowdedEffects' | 'freeFlight';
  granularity: 'case' | 'feature';
  name: string;
  tags: string[];
  toggles: Partial<SandboxProfileToggles>;
};

const SANDBOX_PERF_CASES: SandboxPerfCase[] = [
  {
    apply: 'freeFlight',
    granularity: 'feature',
    name: 'free-flight-all-systems',
    tags: ['sandbox', 'background', 'hud', 'minimap'],
    toggles: {},
  },
  {
    apply: 'freeFlight',
    granularity: 'feature',
    name: 'navigation-overlays',
    tags: ['sandbox', 'minimap', 'trajectory', 'biomes'],
    toggles: {
      biomeDebug: true,
      blackHoles: false,
      fuelMetaballs: false,
      nebulaRegions: true,
      threeBackground: false,
    },
  },
  {
    apply: 'crowdedEffects',
    granularity: 'case',
    name: 'crowded-effects',
    tags: ['sandbox', 'black-holes', 'metaballs'],
    toggles: {
      minimap: false,
      trajectoryPreview: false,
    },
  },
];

test.describe('Sandbox feature performance cases', () => {
  for (const sandboxCase of SANDBOX_PERF_CASES) {
    test(`profiles sandbox ${sandboxCase.name}`, async ({ page }, testInfo) => {
      const diagnostics = captureConsoleDiagnostics(page);
      const toggles = {
        ...getSandboxProfileTogglesFromEnv(),
        ...sandboxCase.toggles,
        markers: true,
      };

      await openSandboxGame(page, { toggles });
      if (sandboxCase.apply) await applySandboxPerfCase(page, sandboxCase.apply);
      const summary = await collectSandboxFeatureSummary(page);
      const report = await recordScenarioSample(page, {
        consoleMessages: diagnostics.messages,
        counts: sandboxFeatureCounts(summary),
        granularity: sandboxCase.granularity,
        metrics: {
          controlsEnabled: summary.controlsEnabled ? 1 : 0,
          playerDocked: summary.playerDocked ? 1 : 0,
        },
        samples: summary,
        scene: 'sandbox',
        scenario: sandboxCase.name,
        suite: 'sandbox-feature-cases',
        tags: sandboxCase.tags,
        testInfo,
        toggles,
      });
      diagnostics.stop();

      expect(summary.activeScenes).toContain('sandbox');
      expect(summary.counts.asteroids).toBeGreaterThan(0);
      expect(report.frameStats.frameCount ?? 0).toBeGreaterThan(1);
      console.log(`Sandbox ${sandboxCase.name} performance: ${report.artifactPath}`);
      if (report.comparison) {
        console.log(
          `Sandbox ${sandboxCase.name} milestone: ${report.comparison.milestoneArtifactPath}`,
        );
      }
    });
  }
});
