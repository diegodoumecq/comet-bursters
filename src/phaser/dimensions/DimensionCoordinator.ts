import type { DetachedSpaceEntity, SpaceWorldRuntime } from '../world/SpaceWorldRuntime';
import { portalBecameActive, portalFinishedClosing, syncPortalLifecycle } from './PortalLifecycle';
import { getPortalTransferCommands } from './PortalTransferSystem';
import type {
  ActiveViewState,
  DimensionCommand,
  PortalDirectorPlan,
  PortalEntity,
  SpaceId,
} from './types';
import { getOppositeSpace } from './types';

const CAMERA_TRANSITION_MS = 360;

export class DimensionCoordinator {
  private activePortal: PortalEntity | null = null;
  private activeView: ActiveViewState = { space: 'arcade', type: 'stable' };
  private pendingSpawnPlan: PortalDirectorPlan | null = null;
  private readonly worlds = new Map<SpaceId, SpaceWorldRuntime>();

  registerWorld(runtime: SpaceWorldRuntime): void {
    this.worlds.set(runtime.space, runtime);
  }

  getWorld(space: SpaceId): SpaceWorldRuntime | null {
    return this.worlds.get(space) ?? null;
  }

  getActivePortal(): PortalEntity | null {
    return this.activePortal;
  }

  getActiveViewSpace(now: number): SpaceId {
    if (this.activeView.type === 'stable') return this.activeView.space;
    if (now - this.activeView.startedAt >= this.activeView.durationMs) {
      this.activeView = { space: this.activeView.to, type: 'stable' };
      return this.activeView.space;
    }
    return this.activeView.from;
  }

  openPortal(plan: PortalDirectorPlan): void {
    this.activePortal = plan.portal;
    this.pendingSpawnPlan = plan;
  }

  update(now: number): DimensionCommand[] {
    const commands: DimensionCommand[] = [];
    const portal = this.activePortal;
    if (!portal) {
      this.syncWorldPreviousPositions();
      return commands;
    }

    const previousLifecycle = portal.lifecycle;
    const nextLifecycle = syncPortalLifecycle(portal, now);
    if (portalBecameActive(previousLifecycle, nextLifecycle) && this.pendingSpawnPlan) {
      commands.push({ plan: this.pendingSpawnPlan, portal, type: 'spawnPortal' });
    }

    if (nextLifecycle === 'active') {
      commands.push(...this.processTransfers(portal, now));
    }

    if (portalFinishedClosing(previousLifecycle, nextLifecycle)) {
      const hiddenSpace = getOppositeSpace(this.getActiveViewSpace(now));
      commands.push({ hiddenSpace, type: 'cleanupHiddenWorld' });
      this.worlds.get(hiddenSpace)?.clearNonShipEntities();
      this.activePortal = null;
      this.pendingSpawnPlan = null;
    }

    this.syncWorldPreviousPositions();
    return commands;
  }

  private processTransfers(portal: PortalEntity, now: number): DimensionCommand[] {
    const commands: DimensionCommand[] = [];
    const snapshots = [...this.worlds.values()].flatMap((world) => world.getTransferSnapshots());
    for (const transfer of getPortalTransferCommands({ portal, snapshots })) {
      const fromWorld = this.worlds.get(transfer.from);
      const toWorld = this.worlds.get(transfer.to);
      if (fromWorld && toWorld) {
        const detached = fromWorld.detachTransferEntity(transfer.entity);
        if (detached) {
          this.attachDetached(toWorld, detached);
          commands.push({
            entity: transfer.entity,
            from: transfer.from,
            to: transfer.to,
            type: 'transferEntity',
          });
          if (detached.kind === 'player' && portal.viewPolicy === 'cameraTransfer') {
            this.activeView = {
              durationMs: CAMERA_TRANSITION_MS,
              from: transfer.from,
              startedAt: now,
              to: transfer.to,
              type: 'transition',
            };
            commands.push({
              from: transfer.from,
              to: transfer.to,
              type: 'startCameraTransition',
            });
          }
        }
      }
    }
    return commands;
  }

  private syncWorldPreviousPositions(): void {
    for (const world of this.worlds.values()) world.syncPreviousPositions();
  }

  private attachDetached(runtime: SpaceWorldRuntime, detached: DetachedSpaceEntity): void {
    runtime.attachTransferredEntity(detached);
  }
}
