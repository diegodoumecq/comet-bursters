import Phaser from 'phaser';

import { initializeGameAudio } from '../audio/AudioManager';
import { preloadAudioAssets } from '../audio/audioLoader';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    preloadAudioAssets(this);
  }

  create(): void {
    initializeGameAudio(this);
    this.scene.start('scene-menu');
  }
}
