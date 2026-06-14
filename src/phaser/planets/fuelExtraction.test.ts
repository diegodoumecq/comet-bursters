import { describe, expect, it } from 'vitest';

import {
  getFuelExtractorBlobPosition,
  getFuelExtractorPosition,
  updateFuelExtractionPlanets,
  type FuelExtractionPlanetEntity,
} from './fuelExtraction';

describe('planet fuel extraction', () => {
  it('anchors extractor position to the planet rotation', () => {
    const planet = createPlanet({
      extractorAngle: 0,
      radius: 100,
      rotation: Math.PI * 0.5,
    });

    expect(getFuelExtractorPosition(planet)).toEqual({
      x: expect.closeTo(10, 5),
      y: expect.closeTo(118, 5),
    });
  });

  it('moves extracted blobs with the rotating surface site', () => {
    const planet = createPlanet({
      extractorAngle: 0,
      radius: 100,
      rotation: Math.PI,
    });
    const position = getFuelExtractorBlobPosition(
      planet,
      { localOffsetX: 0, localOffsetY: 0, wobbleSeed: 0 },
      0,
    );

    expect(position).toEqual({
      x: expect.closeTo(-182, 5),
      y: expect.closeTo(10, 5),
    });
  });

  it('updates planet rotation before resolving extractor positions', () => {
    const planet = createPlanet({
      extractorAngle: 0,
      radius: 100,
      rotation: 0,
      rotationSpeed: Math.PI / 1000,
    });

    updateFuelExtractionPlanets([planet], 100, 0.5, fixedRandom);

    expect(getFuelExtractorPosition(planet)).toEqual({
      x: expect.closeTo(10, 5),
      y: expect.closeTo(118, 5),
    });
  });
});

function createPlanet(input: {
  extractorAngle: number;
  radius: number;
  rotation: number;
  rotationSpeed?: number;
}): FuelExtractionPlanetEntity {
  return {
    altitudeVariations: [],
    color: 0xffffff,
    colorHex: '#ffffff',
    extractor: {
      angle: input.extractorAngle,
      blobs: [],
      nextExtractAt: 0,
    },
    fuelReserve: 0,
    gravityStrength: 0,
    id: 1,
    inspectedUntil: 0,
    kind: 'lush',
    position: { x: 10, y: 10 },
    radius: input.radius,
    rotation: input.rotation,
    rotationSpeed: input.rotationSpeed ?? 0,
    visualSeed: 0,
  };
}

const fixedRandom = {
  between: (min: number) => min,
  float: () => 0,
  floatBetween: (min: number) => min,
  pick: <T>(items: T[]) => items[0],
};
