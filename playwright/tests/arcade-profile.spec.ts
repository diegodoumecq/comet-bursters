import playwright from '@playwright/test';

import {
  captureConsoleDiagnostics,
  getArcadeProfileTogglesFromEnv,
  openArcadeGame,
  readProfileDurationMs,
  readProfileTraceEnabled,
  recordArcadeProfile,
} from '../support/sandboxHarness';

const { expect, test } = playwright;

test('profiles the Phaser arcade scene', async ({ page }, testInfo) => {
  const diagnostics = captureConsoleDiagnostics(page);
  const durationMs = readProfileDurationMs(5000);
  const includeTrace = readProfileTraceEnabled(true);
  const toggles = getArcadeProfileTogglesFromEnv();

  await openArcadeGame(page, { toggles });
  const report = await recordArcadeProfile(page, {
    consoleMessages: diagnostics.messages,
    durationMs,
    includeTrace,
    testInfo,
  });
  diagnostics.stop();

  expect(report).toBeTruthy();
  console.log(`Arcade profile: ${report.artifactPath}`);
  if (report.comparison) {
    console.log(`Arcade milestone: ${report.comparison.milestoneArtifactPath}`);
  }
});
