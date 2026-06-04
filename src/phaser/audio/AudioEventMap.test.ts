import { describe, expect, it } from 'vitest';

import { AUDIO_KEYS } from './audioKeys';
import { resolveAudioEvent } from './AudioEventMap';

describe('audio event map', () => {
  it('maps weapon events to projectile-specific cues', () => {
    expect(resolveAudioEvent({ type: 'weaponFired', weapon: 'shotgun' })).toEqual([
      expect.objectContaining({ key: AUDIO_KEYS.sfx.weaponShotgun }),
    ]);
    expect(resolveAudioEvent({ type: 'weaponFired', weapon: 'blackHole' })).toEqual([
      expect.objectContaining({ key: AUDIO_KEYS.sfx.weaponBlackHole }),
    ]);
    expect(resolveAudioEvent({ type: 'weaponFired', weapon: 'fuelGun' })).toEqual([
      expect.objectContaining({ key: AUDIO_KEYS.sfx.weaponFuelGun }),
    ]);
  });

  it('maps world events to configured sfx cues', () => {
    expect(resolveAudioEvent({ type: 'portalOpened' })).toEqual([
      expect.objectContaining({ key: AUDIO_KEYS.sfx.portalOpened }),
    ]);
    expect(resolveAudioEvent({ type: 'asteroidDestroyed' })).toEqual([
      expect.objectContaining({ key: AUDIO_KEYS.sfx.asteroidDestroyed }),
    ]);
  });
});
