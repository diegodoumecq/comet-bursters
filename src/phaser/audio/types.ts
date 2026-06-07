import type Phaser from 'phaser';

import type { Vector } from '../core/types';
import type { DischargedWeaponKind } from '../weapons/types';

export type AudioBus = 'ambience' | 'master' | 'music' | 'sfx' | 'ui';

export type MusicKey =
  | 'music:arcade'
  | 'music:demo'
  | 'music:menu'
  | 'music:rift'
  | 'music:sandbox'
  | 'music:shipInterior';

export type AmbienceKey =
  | 'ambience:arcade'
  | 'ambience:rift'
  | 'ambience:sandbox'
  | 'ambience:shipInterior';

export type SfxKey =
  | 'sfx:asteroidDestroyed'
  | 'sfx:asteroidImpact'
  | 'sfx:fuelCollected'
  | 'sfx:playerDestroyed'
  | 'sfx:portalClosed'
  | 'sfx:portalOpened'
  | 'sfx:shieldHit'
  | 'sfx:uiSelect'
  | 'sfx:weaponBlackHole'
  | 'sfx:weaponFuelGun'
  | 'sfx:weaponInspectionProbe'
  | 'sfx:weaponPusher'
  | 'sfx:weaponShotgun'
  | 'sfx:weaponSmall';

export type AudioKey = AmbienceKey | MusicKey | SfxKey;

export type AudioSceneKey =
  | 'arcade'
  | 'demo'
  | 'rift-space'
  | 'sandbox'
  | 'scene-menu'
  | 'ship-interior';

export type AudioAsset = {
  key: AudioKey;
  urls: string[];
};

export type MusicTransition = {
  crossfade?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
};

export type AudioPlayOptions = {
  cooldownMs?: number;
  delay?: number;
  detune?: number;
  loop?: boolean;
  rate?: number;
  volume?: number;
};

export type WorldAudioOptions = AudioPlayOptions & {
  camera: Phaser.Cameras.Scene2D.Camera;
  listenerPosition?: Vector;
  maxDistance?: number;
  position: Vector;
};

export type AudioEvent =
  | { position?: Vector; type: 'asteroidDestroyed' }
  | { position?: Vector; type: 'asteroidImpact' }
  | { position?: Vector; type: 'fuelCollected' }
  | { position?: Vector; type: 'playerDestroyed' }
  | { position?: Vector; type: 'portalClosed' }
  | { position?: Vector; type: 'portalOpened' }
  | { position?: Vector; type: 'shieldHit' }
  | { type: 'uiSelect' }
  | { position?: Vector; type: 'weaponFired'; weapon: DischargedWeaponKind };

export type SceneAudioSnapshot = {
  listenerPosition?: Vector;
  playerSpeed?: number;
  riftVisible?: boolean;
  threatLevel?: number;
  timeDilation?: boolean;
};
