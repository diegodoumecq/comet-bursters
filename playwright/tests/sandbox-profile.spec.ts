import playwright from '@playwright/test';

import {
  captureConsoleDiagnostics,
  getSandboxProfileTogglesFromEnv,
  openSandboxGame,
  readProfileDurationMs,
  readProfileTraceEnabled,
  recordSandboxProfile,
} from '../support/sandboxHarness';

const { expect, test } = playwright;

test('profiles the Phaser sandbox', async ({ page }, testInfo) => {
  const diagnostics = captureConsoleDiagnostics(page);
  const durationMs = readProfileDurationMs(5000);
  const includeTrace = readProfileTraceEnabled(true);
  const toggles = getSandboxProfileTogglesFromEnv();

  await openSandboxGame(page, { toggles });
  const report = await recordSandboxProfile(page, {
    consoleMessages: diagnostics.messages,
    durationMs,
    includeTrace,
    testInfo,
  });
  diagnostics.stop();

  expect(report).toBeTruthy();
  console.log(`Sandbox profile: ${report.artifactPath}`);
  if (report.comparison) {
    console.log(`Sandbox milestone: ${report.comparison.milestoneArtifactPath}`);
  }
});
