import playwright from '@playwright/test';

import { openSandboxGame } from '../support/sandboxHarness';

const { expect, test } = playwright;

test('Phaser sandbox boots to a visible canvas', async ({ page }) => {
  await openSandboxGame(page, { settleMs: 800 });

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
});
