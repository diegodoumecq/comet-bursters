import type { PortalEntity } from '../dimensions/types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const CENTER_METABALLS = {
  angleJitter: 0.55,
  count: 8,
  radialBase: 0.4,
  radialJitter: 0.12,
  radialMax: 0.42,
  radialMin: 0.1,
  radialSpread: 0.26,
  radiusScaleMax: 1,
  radiusScaleMin: 0.7,
};

export const BORDER_METABALLS = {
  angleJitter: 0.6,
  count: 20,
  radialBase: 0.86,
  radialJitter: 0.18,
  radialMax: 1,
  radialMin: 0.7,
  radiusScaleMax: 0.6,
  radiusScaleMin: 0.1,
};

export const PORTAL_METABALL_COUNT = CENTER_METABALLS.count + BORDER_METABALLS.count;

type MetaballPlacementConfig = {
  angleJitter: number;
  count: number;
  radialBase: number;
  radialJitter: number;
  radialMax: number;
  radialMin: number;
  radiusScaleMax: number;
  radiusScaleMin: number;
};

export function buildPortalMetaballData(
  portal: PortalEntity,
  now: number,
  data = new Float32Array(PORTAL_METABALL_COUNT * 4),
  scale = 1,
): Float32Array {
  const visualScale = Math.max(0, scale);
  const portalRotation = seededUnit(portal.id, 0, 37) * Math.PI * 2;
  for (let index = 0; index < PORTAL_METABALL_COUNT; index += 1) {
    const placement = getMetaballPlacement(portal.id, index, portalRotation);
    const { radial, radiusScale, theta } = placement;
    const side = Math.sin(theta) * radial;
    const along = Math.cos(theta) * radial;
    const noise = seededUnit(portal.id, index, 3);
    const pulse = Math.sin(now * 0.004 + noise * Math.PI * 2) * 0.035;
    const jag = 1 + (noise - 0.5) * 0.08 + pulse;
    const radius = portal.visualRadiusY * radiusScale;

    data[index * 4] = along * portal.visualRadiusX * jag;
    data[index * 4 + 1] = side * portal.visualRadiusY * jag;
    data[index * 4 + 2] = radius * visualScale;
    data[index * 4 + 3] = side;
  }
  return data;
}

function getMetaballPlacement(
  portalId: number,
  index: number,
  portalRotation: number,
): { radial: number; radiusScale: number; theta: number } {
  if (index < CENTER_METABALLS.count) {
    return createPlacement(
      portalId,
      index,
      portalRotation,
      CENTER_METABALLS,
      getCenterRadialBase(index),
    );
  }

  const borderIndex = index - CENTER_METABALLS.count;
  return createPlacement(
    portalId,
    index,
    portalRotation,
    BORDER_METABALLS,
    BORDER_METABALLS.radialBase,
    borderIndex,
  );
}

function createPlacement(
  portalId: number,
  seedIndex: number,
  portalRotation: number,
  config: MetaballPlacementConfig,
  radialBase: number,
  sequenceIndex = seedIndex,
): { radial: number; radiusScale: number; theta: number } {
  const theta =
    portalRotation +
    sequenceIndex * GOLDEN_ANGLE +
    (seededUnit(portalId, seedIndex, 71) - 0.5) * config.angleJitter;
  const radial = clamp(
    radialBase + (seededUnit(portalId, seedIndex, 89) - 0.5) * config.radialJitter,
    config.radialMin,
    config.radialMax,
  );
  const radiusScale = lerp(
    config.radiusScaleMin,
    config.radiusScaleMax,
    seededUnit(portalId, seedIndex, 13),
  );
  return { radial, radiusScale, theta };
}

function getCenterRadialBase(index: number): number {
  return (
    CENTER_METABALLS.radialBase +
    Math.sqrt((index + 0.35) / CENTER_METABALLS.count) * CENTER_METABALLS.radialSpread
  );
}

function seededUnit(portalId: number, index: number, seed: number): number {
  return Math.abs(Math.sin((portalId * 97 + index + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
