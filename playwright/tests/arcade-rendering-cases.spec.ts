import playwright from '@playwright/test';

import {
  applyArcadeRenderCase,
  ARCADE_RENDER_CASES,
  collectArcadeRenderSummary,
  saveArcadeRenderCaseArtifacts,
  type ArcadeRenderCaseExpectation,
} from '../support/arcadeRenderCases';
import { getArcadeProfileTogglesFromEnv, openArcadeGame } from '../support/sandboxHarness';

const { expect, test } = playwright;

test.describe('Arcade rendering cases', () => {
  for (const renderCase of ARCADE_RENDER_CASES) {
    test(`renders ${renderCase.name}`, async ({ page }, testInfo) => {
      await openArcadeGame(page, {
        toggles: getArcadeProfileTogglesFromEnv(),
      });
      await applyArcadeRenderCase(page, renderCase.name);

      const summary = await collectArcadeRenderSummary(page);
      await saveArcadeRenderCaseArtifacts(page, testInfo, renderCase.name, summary);

      expect(summary.sceneActive).toBe(true);
      expect(summary.activeScenes).toContain('arcade');
      expect(
        summary.domCanvases.some(
          (canvas) => canvas.visible && canvas.width > 0 && canvas.height > 0,
        ),
      ).toBe(true);
      expectRenderCase(summary, renderCase.expected);
    });
  }
});

function expectRenderCase(
  summary: Awaited<ReturnType<typeof collectArcadeRenderSummary>>,
  expected: ArcadeRenderCaseExpectation,
): void {
  if (expected.activePortal !== undefined) expect(summary.activePortal).toBe(expected.activePortal);
  if (expected.arcadeAsteroids !== undefined)
    expect(summary.arcadeAsteroids).toBeGreaterThanOrEqual(expected.arcadeAsteroids);
  if (expected.blackHoles !== undefined)
    expect(summary.blackHoles).toBeGreaterThanOrEqual(expected.blackHoles);
  if (expected.fuelBlobs !== undefined)
    expect(summary.fuelBlobs).toBeGreaterThanOrEqual(expected.fuelBlobs);
  if (expected.playerNearEdge !== undefined)
    expect(summary.player.nearEdge).toBe(expected.playerNearEdge);
  if (expected.wrappedAsteroids !== undefined)
    expect(summary.toroidalAsteroidCopyCount).toBeGreaterThanOrEqual(expected.wrappedAsteroids);
  if (expected.wrappedBlackHoles !== undefined)
    expect(summary.wrappedBlackHoleCount).toBeGreaterThanOrEqual(expected.wrappedBlackHoles);
}
