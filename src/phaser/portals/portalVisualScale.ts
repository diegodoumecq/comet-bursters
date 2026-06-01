import type { PortalEntity } from '../dimensions/types';

export function getPortalVisualScale(portal: PortalEntity, now: number): number {
  const age = Math.max(0, now - portal.openedAt);
  const opening = clamp01(age / Math.max(1, portal.openingDurationMs));
  const closing =
    portal.closeStartedAt === null
      ? 0
      : clamp01((now - portal.closeStartedAt) / Math.max(1, portal.closingDurationMs));
  return smoothStep(opening) * (1 - smoothStep(closing));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}
