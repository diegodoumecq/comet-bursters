import type Phaser from 'phaser';

import { AUDIO_ASSETS } from './audioConfig';

export function preloadAudioAssets(scene: Phaser.Scene): void {
  for (const asset of AUDIO_ASSETS) {
    if (asset.urls.length > 0) scene.load.audio(asset.key, asset.urls);
  }
}
