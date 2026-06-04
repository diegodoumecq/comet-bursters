import { AUDIO_KEYS } from './audioKeys';
import { SFX_CUE_CONFIG } from './audioConfig';
import type { DischargedWeaponKind } from '../weapons/types';
import type { AudioEvent, SfxKey } from './types';

export type ResolvedAudioEvent = {
  key: SfxKey;
  cooldownMs?: number;
  maxDistance?: number;
  volume: number;
};

export function resolveAudioEvent(event: AudioEvent): ResolvedAudioEvent[] {
  const key = getEventSfxKey(event);
  if (!key) return [];
  const config = SFX_CUE_CONFIG[key];
  return [{ key, ...config }];
}

function getEventSfxKey(event: AudioEvent): SfxKey | null {
  if (event.type === 'weaponFired') return getWeaponSfxKey(event.weapon);
  if (event.type === 'asteroidDestroyed') return AUDIO_KEYS.sfx.asteroidDestroyed;
  if (event.type === 'asteroidImpact') return AUDIO_KEYS.sfx.asteroidImpact;
  if (event.type === 'fuelCollected') return AUDIO_KEYS.sfx.fuelCollected;
  if (event.type === 'playerDestroyed') return AUDIO_KEYS.sfx.playerDestroyed;
  if (event.type === 'portalClosed') return AUDIO_KEYS.sfx.portalClosed;
  if (event.type === 'portalOpened') return AUDIO_KEYS.sfx.portalOpened;
  if (event.type === 'shieldHit') return AUDIO_KEYS.sfx.shieldHit;
  if (event.type === 'uiSelect') return AUDIO_KEYS.sfx.uiSelect;
  return null;
}

function getWeaponSfxKey(weapon: DischargedWeaponKind): SfxKey {
  if (weapon === 'blackHole') return AUDIO_KEYS.sfx.weaponBlackHole;
  if (weapon === 'fuelGun') return AUDIO_KEYS.sfx.weaponFuelGun;
  if (weapon === 'inspectionProbe') return AUDIO_KEYS.sfx.weaponInspectionProbe;
  if (weapon === 'pusher') return AUDIO_KEYS.sfx.weaponPusher;
  if (weapon === 'shotgun') return AUDIO_KEYS.sfx.weaponShotgun;
  return AUDIO_KEYS.sfx.weaponSmall;
}
