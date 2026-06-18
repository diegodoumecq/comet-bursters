import type Phaser from 'phaser';

import type { WorldSize } from '../core/types';
import type { ActionState } from '../input/actions';
import type { ShipState } from '../player/shipState';
import type { PlayerState } from '../player/state';
import type { PortalEntity, PortalViewPolicy } from './types';

export type RiftSpaceSceneBridge = {
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  captureTextureKey: () => string;
  events: Phaser.Events.EventEmitter;
  renderDimensionDebug: (input: { enabled: boolean }) => void;
  renderGameOver: (input: { visible: boolean; world: WorldSize }) => void;
  renderPlayerOverlay: (input: {
    action: ActionState;
    alive: boolean;
    now: number;
    player: PlayerState;
    ship: ShipState;
  }) => void;
  setActiveView: (active: boolean) => void;
  setPortalDestinationTextureKeyProvider: (getDestinationTextureKey: () => string | null) => void;
  setPortals: (portals: PortalEntity[]) => void;
  setTimeScale: (timeScale: number) => void;
  setMonolithRiftIntensity: (initialIntensity: number) => void;
  updateMonolithRift: (input: {
    activePortal: PortalEntity | null;
    forcePortal?: boolean;
    forcedViewPolicy?: PortalViewPolicy;
    now: number;
    playerPosition: { x: number; y: number };
    portalId: number;
    world: WorldSize;
  }) => { burstCount: number; portal: PortalEntity } | null;
};
