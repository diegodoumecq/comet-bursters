import type { PortalEntity, PortalLifecycle } from './types';

export function getPortalLifecycle(portal: PortalEntity, now: number): PortalLifecycle {
  if (portal.lifecycle === 'closed') return 'closed';
  const activeStartedAt = portal.openedAt + portal.openingDurationMs;
  const activeEndsAt = activeStartedAt + portal.activeDurationMs;
  const closedAt = activeEndsAt + portal.closingDurationMs;
  if (now < activeStartedAt) return 'openingVisual';
  if (now < activeEndsAt) return 'active';
  if (now < closedAt) return 'closingVisual';
  return 'closed';
}

export function syncPortalLifecycle(portal: PortalEntity, now: number): PortalLifecycle {
  const lifecycle = getPortalLifecycle(portal, now);
  portal.lifecycle = lifecycle;
  if (lifecycle === 'closingVisual' && portal.closeStartedAt === null) {
    portal.closeStartedAt = portal.openedAt + portal.openingDurationMs + portal.activeDurationMs;
  }
  return lifecycle;
}

export function portalBecameActive(previous: PortalLifecycle, next: PortalLifecycle): boolean {
  return previous === 'openingVisual' && next === 'active';
}

export function portalFinishedClosing(previous: PortalLifecycle, next: PortalLifecycle): boolean {
  return previous !== 'closed' && next === 'closed';
}
