import Phaser from 'phaser';

import { initializeGameAudio } from '../../audio/AudioManager';
import { preloadAudioAssets } from '../../audio/audioLoader';
import { ensureBootGeneratedTextures } from './generatedTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    preloadAudioAssets(this);
  }

  async create(): Promise<void> {
    initializeGameAudio(this);
    await ensureBootGeneratedTextures(this);
    this.scene.start('scene-menu');
  }
}
