import type Phaser from 'phaser';

import type { AudioManager } from './AudioManager';
import type { AudioEvent, AudioSceneKey, SceneAudioSnapshot } from './types';

export class SceneAudioDirector {
  private active = false;

  constructor(
    private readonly audio: AudioManager,
    private readonly scene: Phaser.Scene,
    private readonly sceneKey: AudioSceneKey,
  ) {}

  enter(): void {
    this.active = true;
    this.audio.enterScene(this.sceneKey, this.scene);
  }

  update(snapshot: SceneAudioSnapshot): void {
    if (this.active) this.audio.updateScene(this.sceneKey, snapshot);
  }

  emit(event: AudioEvent): void {
    if (this.active) this.audio.emit(event, this.scene);
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.audio.exitScene(this.sceneKey);
  }
}
