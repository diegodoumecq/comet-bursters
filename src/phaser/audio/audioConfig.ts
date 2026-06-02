import { AUDIO_KEYS } from './audioKeys';
import type {
  AmbienceKey,
  AudioAsset,
  AudioBus,
  AudioKey,
  AudioSceneKey,
  MusicKey,
  MusicTransition,
  SfxKey,
} from './types';

export const AUDIO_ASSETS: AudioAsset[] = [
  { key: AUDIO_KEYS.music.menu, urls: [] },
  { key: AUDIO_KEYS.music.demo, urls: [] },
  { key: AUDIO_KEYS.music.arcade, urls: [] },
  { key: AUDIO_KEYS.music.rift, urls: [] },
  { key: AUDIO_KEYS.music.sandbox, urls: [] },
  { key: AUDIO_KEYS.music.shipInterior, urls: [] },
  { key: AUDIO_KEYS.ambience.arcade, urls: [] },
  { key: AUDIO_KEYS.ambience.rift, urls: [] },
  { key: AUDIO_KEYS.ambience.sandbox, urls: [] },
  { key: AUDIO_KEYS.ambience.shipInterior, urls: [] },
  {
    key: AUDIO_KEYS.sfx.asteroidDestroyed,
    urls: ['audio/placeholder/asteroid-destroyed.wav'],
  },
  { key: AUDIO_KEYS.sfx.asteroidImpact, urls: [] },
  { key: AUDIO_KEYS.sfx.fuelCollected, urls: [] },
  { key: AUDIO_KEYS.sfx.playerDestroyed, urls: ['audio/placeholder/player-destroyed.wav'] },
  { key: AUDIO_KEYS.sfx.portalClosed, urls: [] },
  { key: AUDIO_KEYS.sfx.portalOpened, urls: ['audio/placeholder/portal-opened.wav'] },
  { key: AUDIO_KEYS.sfx.shieldHit, urls: [] },
  { key: AUDIO_KEYS.sfx.uiSelect, urls: [] },
  { key: AUDIO_KEYS.sfx.weaponBlackHole, urls: ['audio/placeholder/weapon-black-hole.wav'] },
  {
    key: AUDIO_KEYS.sfx.weaponInspectionProbe,
    urls: ['audio/placeholder/weapon-inspection-probe.wav'],
  },
  { key: AUDIO_KEYS.sfx.weaponPusher, urls: ['audio/placeholder/weapon-pusher.wav'] },
  { key: AUDIO_KEYS.sfx.weaponShotgun, urls: ['audio/placeholder/weapon-shotgun.wav'] },
  { key: AUDIO_KEYS.sfx.weaponSmall, urls: ['audio/placeholder/weapon-small.wav'] },
];

export const DEFAULT_BUS_VOLUMES: Record<AudioBus, number> = {
  ambience: 0.8,
  master: 1,
  music: 0.72,
  sfx: 0.9,
  ui: 0.85,
};

export const AUDIO_KEY_BUSES: Record<AudioKey, AudioBus> = {
  [AUDIO_KEYS.music.menu]: 'music',
  [AUDIO_KEYS.music.demo]: 'music',
  [AUDIO_KEYS.music.arcade]: 'music',
  [AUDIO_KEYS.music.rift]: 'music',
  [AUDIO_KEYS.music.sandbox]: 'music',
  [AUDIO_KEYS.music.shipInterior]: 'music',
  [AUDIO_KEYS.ambience.arcade]: 'ambience',
  [AUDIO_KEYS.ambience.rift]: 'ambience',
  [AUDIO_KEYS.ambience.sandbox]: 'ambience',
  [AUDIO_KEYS.ambience.shipInterior]: 'ambience',
  [AUDIO_KEYS.sfx.asteroidDestroyed]: 'sfx',
  [AUDIO_KEYS.sfx.asteroidImpact]: 'sfx',
  [AUDIO_KEYS.sfx.fuelCollected]: 'sfx',
  [AUDIO_KEYS.sfx.playerDestroyed]: 'sfx',
  [AUDIO_KEYS.sfx.portalClosed]: 'sfx',
  [AUDIO_KEYS.sfx.portalOpened]: 'sfx',
  [AUDIO_KEYS.sfx.shieldHit]: 'sfx',
  [AUDIO_KEYS.sfx.uiSelect]: 'ui',
  [AUDIO_KEYS.sfx.weaponBlackHole]: 'sfx',
  [AUDIO_KEYS.sfx.weaponInspectionProbe]: 'sfx',
  [AUDIO_KEYS.sfx.weaponPusher]: 'sfx',
  [AUDIO_KEYS.sfx.weaponShotgun]: 'sfx',
  [AUDIO_KEYS.sfx.weaponSmall]: 'sfx',
};

export const DEFAULT_MUSIC_TRANSITION: Required<MusicTransition> = {
  crossfade: true,
  fadeInMs: 1200,
  fadeOutMs: 900,
};

export type SceneAudioProfile = {
  ambience?: AmbienceKey;
  ambienceVolume?: number;
  music: MusicKey;
  musicVolume?: number;
  transition?: MusicTransition;
};

export const SCENE_AUDIO_PROFILES: Record<AudioSceneKey, SceneAudioProfile> = {
  arcade: {
    ambience: AUDIO_KEYS.ambience.arcade,
    ambienceVolume: 0.5,
    music: AUDIO_KEYS.music.arcade,
  },
  demo: {
    music: AUDIO_KEYS.music.demo,
    musicVolume: 0.55,
  },
  'rift-space': {
    ambience: AUDIO_KEYS.ambience.rift,
    ambienceVolume: 0.65,
    music: AUDIO_KEYS.music.rift,
    transition: { fadeInMs: 700, fadeOutMs: 500 },
  },
  sandbox: {
    ambience: AUDIO_KEYS.ambience.sandbox,
    ambienceVolume: 0.72,
    music: AUDIO_KEYS.music.sandbox,
  },
  'scene-menu': {
    music: AUDIO_KEYS.music.menu,
    musicVolume: 0.55,
  },
  'ship-interior': {
    ambience: AUDIO_KEYS.ambience.shipInterior,
    ambienceVolume: 0.45,
    music: AUDIO_KEYS.music.shipInterior,
    musicVolume: 0.5,
  },
};

export type SfxCueConfig = {
  cooldownMs?: number;
  maxDistance?: number;
  volume: number;
};

export const SFX_CUE_CONFIG: Record<SfxKey, SfxCueConfig> = {
  [AUDIO_KEYS.sfx.asteroidDestroyed]: { maxDistance: 1400, volume: 0.85 },
  [AUDIO_KEYS.sfx.asteroidImpact]: { cooldownMs: 35, maxDistance: 900, volume: 0.62 },
  [AUDIO_KEYS.sfx.fuelCollected]: { cooldownMs: 45, maxDistance: 650, volume: 0.42 },
  [AUDIO_KEYS.sfx.playerDestroyed]: { volume: 1 },
  [AUDIO_KEYS.sfx.portalClosed]: { maxDistance: 1200, volume: 0.68 },
  [AUDIO_KEYS.sfx.portalOpened]: { maxDistance: 1200, volume: 0.78 },
  [AUDIO_KEYS.sfx.shieldHit]: { cooldownMs: 70, maxDistance: 800, volume: 0.56 },
  [AUDIO_KEYS.sfx.uiSelect]: { cooldownMs: 40, volume: 0.45 },
  [AUDIO_KEYS.sfx.weaponBlackHole]: { cooldownMs: 120, maxDistance: 1000, volume: 0.8 },
  [AUDIO_KEYS.sfx.weaponInspectionProbe]: { cooldownMs: 80, maxDistance: 900, volume: 0.5 },
  [AUDIO_KEYS.sfx.weaponPusher]: { cooldownMs: 30, maxDistance: 900, volume: 0.42 },
  [AUDIO_KEYS.sfx.weaponShotgun]: { cooldownMs: 80, maxDistance: 900, volume: 0.72 },
  [AUDIO_KEYS.sfx.weaponSmall]: { cooldownMs: 80, maxDistance: 900, volume: 0.48 },
};
