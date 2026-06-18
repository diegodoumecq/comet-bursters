import playwright from '@playwright/test';

import { PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS } from '../../src/phaser/player/shipHeightmapControls';
import { PLAYER_SHIP_MATERIAL_DEBUG_COLORS } from '../../src/phaser/player/shipHeightmapMaterials';

const { expect, test } = playwright;

async function openShipHeightmapEditor(page: playwright.Page): Promise<void> {
  await page.goto('/ship-heightmap-editor.html');
  await expect(page.getByRole('heading', { name: 'Heightmap Editor' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
}

async function getCanvasPixelChecksum(page: playwright.Page): Promise<number> {
  return page.locator('canvas').evaluate((canvasElement) => {
    const canvas = canvasElement as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to read ship heightmap canvas');

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let checksum = 0;
    for (let index = 0; index < imageData.data.length; index += 4) {
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      const alpha = imageData.data[index + 3];
      const pixel = index / 4;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      const positionWeight = ((x + 1) * 17 + (y + 1) * 31) % 1_000_003;
      checksum =
        (checksum + (red * 3 + green * 5 + blue * 7 + alpha * 11) * positionWeight) %
        1_000_000_007;
    }
    return checksum;
  });
}

async function getCanvasPixelColor(
  page: playwright.Page,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  return page.locator('canvas').evaluate(
    (canvasElement, samplePoint) => {
      const canvas = canvasElement as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to read ship heightmap canvas');

      return Array.from(
        context.getImageData(samplePoint.x, samplePoint.y, 1, 1).data,
      ) as [number, number, number, number];
    },
    { x, y },
  );
}

async function expectInputChangesCanvas(
  page: playwright.Page,
  label: string,
  value: string,
): Promise<void> {
  await openShipHeightmapEditor(page);
  const slider = page.getByRole('slider', { exact: true, name: label });
  const valueInput = page.getByRole('spinbutton', { exact: true, name: `Value for ${label}` });
  const before = await getCanvasPixelChecksum(page);
  await slider.fill(value);
  await expect(slider).toHaveValue(value);
  await expect(valueInput).toHaveValue(value);
  await expect.poll(() => getCanvasPixelChecksum(page)).not.toBe(before);
}

function getControlTestValue(control: { max: number }): string {
  return String(control.max);
}

function getMaterialCssColor(material: keyof typeof PLAYER_SHIP_MATERIAL_DEBUG_COLORS): string {
  const [red, green, blue] = PLAYER_SHIP_MATERIAL_DEBUG_COLORS[material];
  return `rgb(${red}, ${green}, ${blue})`;
}

test('heightmap view buttons change the rendered canvas mode', async ({ page }) => {
  await openShipHeightmapEditor(page);

  const modeLabels = {
    Alpha: 'alpha',
    Height: 'height',
    Material: 'material',
    Normals: 'normal',
  };
  const checksums: number[] = [];
  for (const [buttonLabel, modeLabel] of Object.entries(modeLabels)) {
    const mode = buttonLabel;
    await page.getByRole('button', { name: mode }).click();
    await expect(page.locator('main')).toContainText(modeLabel);
    checksums.push(await getCanvasPixelChecksum(page));
  }

  expect(new Set(checksums).size).toBe(checksums.length);
});

test('sidebar sections show their material colors', async ({ page }) => {
  await openShipHeightmapEditor(page);

  const swatchCases = PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS.flatMap((section) =>
    section.materials.map((material) => ({
      color: getMaterialCssColor(material),
      label: `${section.title} material ${material}`,
    })),
  );

  for (const swatchCase of swatchCases) {
    await expect(page.getByRole('img', { name: swatchCase.label })).toHaveCSS(
      'background-color',
      swatchCase.color,
    );
  }
});

test('sidebar sections collapse and reopen', async ({ page }) => {
  await openShipHeightmapEditor(page);

  await expect(page.getByRole('button', { name: 'Save to Game' })).toBeVisible();
  await page.getByRole('button', { name: 'Output' }).click();
  await expect(page.getByRole('button', { name: 'Save to Game' })).toBeHidden();
  await page.getByRole('button', { name: 'Output' }).click();
  await expect(page.getByRole('button', { name: 'Save to Game' })).toBeVisible();
});

test('lit preview uses final ship colors instead of material debug colors', async ({ page }) => {
  await openShipHeightmapEditor(page);

  await page.getByRole('button', { name: 'Material' }).click();
  const materialColor = await getCanvasPixelColor(page, 154, 120);
  expect(materialColor).toEqual([...PLAYER_SHIP_MATERIAL_DEBUG_COLORS.canopy, 255]);

  await page.getByRole('button', { name: 'Lit' }).click();
  const litColor = await getCanvasPixelColor(page, 141, 120);
  expect(litColor).not.toEqual(materialColor);
});

const heightmapInputCases = PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS.flatMap((section) =>
  section.controls.map((control) => ({
    label: control.label,
    value: getControlTestValue(control),
  })),
);

for (const inputCase of heightmapInputCases) {
  test(`${inputCase.label} changes the rendered heightmap`, async ({ page }) => {
    await expectInputChangesCanvas(page, inputCase.label, inputCase.value);
  });
}

test('ship rotation slider rotates every heightmap view', async ({ page }) => {
  await openShipHeightmapEditor(page);

  const initialChecksum = await getCanvasPixelChecksum(page);
  await page.getByRole('slider', { name: 'Ship Rotation' }).fill('90');
  await expect(page.getByText('90 deg')).toBeVisible();
  const rotatedChecksum = await getCanvasPixelChecksum(page);
  expect(rotatedChecksum).not.toBe(initialChecksum);

  await page.getByRole('button', { name: 'Reset ship rotation' }).click();
  await expect(page.getByText('0 deg')).toBeVisible();
  const resetChecksum = await getCanvasPixelChecksum(page);
  expect(resetChecksum).toBe(initialChecksum);
});

test('light controls are always available and switch to lit preview', async ({ page }) => {
  await openShipHeightmapEditor(page);
  await expect(page.locator('main')).toContainText('height');

  const initialChecksum = await getCanvasPixelChecksum(page);
  await page.getByRole('slider', { name: 'Light Angle' }).fill('45');
  await expect(page.getByText('45 deg')).toBeVisible();
  await expect(page.locator('main')).toContainText('lit');
  const angleChecksum = await getCanvasPixelChecksum(page);
  expect(angleChecksum).not.toBe(initialChecksum);

  await page.getByRole('slider', { name: 'Light Elevation' }).fill('0.75');
  await expect(page.getByText('0.750')).toBeVisible();
  const elevationChecksum = await getCanvasPixelChecksum(page);
  expect(elevationChecksum).not.toBe(angleChecksum);
});

test('save sends the editable heightmap config to the game asset endpoint', async ({ page }) => {
  let savedPayload: {
    config?: {
      body?: {
        height?: number;
      };
    };
    fileName?: string;
  } | null = null;

  await page.route('**/__editor/save-ship-heightmap', async (route) => {
    savedPayload = JSON.parse(route.request().postData() ?? '{}') as typeof savedPayload;
    await route.fulfill({
      body: JSON.stringify({ fileName: 'shipHeightmap.json', ok: true }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await openShipHeightmapEditor(page);
  await page.getByRole('slider', { exact: true, name: 'Body Lift' }).fill('0.9');
  await page.getByRole('button', { name: 'Save to Game' }).click();

  await expect(page.getByText('Saved shipHeightmap.json.')).toBeVisible();
  expect(savedPayload?.fileName).toBe('shipHeightmap.json');
  expect(savedPayload?.config?.body?.height).toBe(0.9);
});
