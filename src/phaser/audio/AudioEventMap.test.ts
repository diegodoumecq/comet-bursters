import { describe, expect, it } from 'vitest';

import { AUDIO_KEYS } from './audioKeys';
import { resolveAudioEvent } from './AudioEventMap';

describe('audio event map', () => {
  it('maps weapon events to projectile-specific cues', () => {
    expect(resolveAudioEvent({ projectile: 'shotgun', type: 'weaponFired' })).toEqual([
      expect.objectContaining({ key: AUDIO_KEYS.sfx.weaponShotgun }),
    ]);
    expect(resolveAudioEvent({ projectile: 'blackHole', type: 'weaponFired' })).toEqual([
      expect.objectContaining({ key: AUDIO_KEYS.sfx.weaponBlackHole }),
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
