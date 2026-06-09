import playwright from '@playwright/test';

import { openSandboxGame, saveSandboxScreenshot } from '../support/sandboxHarness';

const { expect, test } = playwright;

test('captures the current Phaser sandbox frame', async ({ page }, testInfo) => {
  await openSandboxGame(page);

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  const screenshotPath = await saveSandboxScreenshot(page, testInfo);
  console.log(`Sandbox screenshot: ${screenshotPath}`);
});
