import type { PortalEntity } from '../dimensions/types';

export const PORTAL_METABALL_COUNT = 28;

export function buildPortalMetaballData(
  portal: PortalEntity,
  now: number,
  data = new Float32Array(PORTAL_METABALL_COUNT * 4),
  scale = 1,
): Float32Array {
  const visualScale = Math.max(0, scale);
  for (let index = 0; index < PORTAL_METABALL_COUNT; index += 1) {
    const noise = seededUnit(portal.id, index, 3);
    const theta = seededUnit(portal.id, index, 11) * Math.PI * 2;
    const radial = Math.sqrt(seededUnit(portal.id, index, 23)) * 0.95;
    const side = Math.sin(theta) * radial;
    const along = Math.cos(theta) * radial;
    const pulse = Math.sin(now * 0.004 + noise * Math.PI * 2) * 0.075;
    const jag = 1 + (noise - 0.5) * 0.16 + pulse;
    const radius =
      lerp(portal.visualRadiusY * 0.42, portal.visualRadiusY * 0.68, noise) *
      (1 + Math.max(side / Math.max(radial, 0.001), 0) * 0.16);

    data[index * 4] = along * portal.visualRadiusX * jag;
    data[index * 4 + 1] = side * portal.visualRadiusY * jag;
    data[index * 4 + 2] = radius * visualScale;
    data[index * 4 + 3] = side;
  }
  return data;
}

function seededUnit(portalId: number, index: number, seed: number): number {
  return Math.abs(Math.sin((portalId * 97 + index + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
