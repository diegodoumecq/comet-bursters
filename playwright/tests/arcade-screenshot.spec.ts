import playwright from '@playwright/test';

import { openArcadeGame, saveArcadeScreenshot } from '../support/sandboxHarness';

const { expect, test } = playwright;

test('captures the current Phaser arcade frame', async ({ page }, testInfo) => {
  await openArcadeGame(page);

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  const screenshotPath = await saveArcadeScreenshot(page, testInfo);
  console.log(`Arcade screenshot: ${screenshotPath}`);
});
