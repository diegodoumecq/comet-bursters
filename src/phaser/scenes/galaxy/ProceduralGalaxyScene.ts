import Phaser from 'phaser';

import {
  createProceduralGalaxyTexture,
  PROCEDURAL_GALAXY_TEXTURE_KEY,
} from './proceduralGalaxyTexture';

const MAX_TEXTURE_SIZE = 1024;
const MIN_TEXTURE_SIZE = 640;
const TEXTURE_SIZE_STEP = 128;
const DRIFT_RADIUS = 5;

export class PhaserProceduralGalaxyScene extends Phaser.Scene {
  private galaxyImage: Phaser.GameObjects.Image | null = null;
  private textureSize = 0;

  constructor() {
    super('math-galaxy');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#02030c');
    this.renderGalaxyTexture();
    this.scale.on('resize', this.handleResize, this);
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.input.keyboard?.on('keydown-BACKSPACE', this.returnToMenu, this);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  update(time: number): void {
    if (this.galaxyImage) {
      this.galaxyImage.setPosition(
        this.scale.width * 0.5 + Math.cos(time * 0.000035) * DRIFT_RADIUS,
        this.scale.height * 0.5 + Math.sin(time * 0.000027) * DRIFT_RADIUS,
      );
    }
  }

  private handleResize(): void {
    this.renderGalaxyTexture();
  }

  private renderGalaxyTexture(): void {
    const nextTextureSize = getTextureSize(this.scale.width, this.scale.height);
    if (this.galaxyImage && nextTextureSize === this.textureSize) {
      this.layoutGalaxyImage(this.galaxyImage);
      return;
    }

    this.galaxyImage?.destroy();
    this.galaxyImage = null;
    if (this.textures.exists(PROCEDURAL_GALAXY_TEXTURE_KEY)) {
      this.textures.remove(PROCEDURAL_GALAXY_TEXTURE_KEY);
    }

    createProceduralGalaxyTexture(this, PROCEDURAL_GALAXY_TEXTURE_KEY, nextTextureSize);
    this.textureSize = nextTextureSize;
    this.galaxyImage = this.add.image(0, 0, PROCEDURAL_GALAXY_TEXTURE_KEY).setDepth(0);
    this.layoutGalaxyImage(this.galaxyImage);
  }

  private layoutGalaxyImage(image: Phaser.GameObjects.Image): void {
    const scale = Math.max(this.scale.width, this.scale.height) / this.textureSize;
    image
      .setOrigin(0.5)
      .setPosition(this.scale.width * 0.5, this.scale.height * 0.5)
      .setDisplaySize(this.textureSize * scale, this.textureSize * scale);
  }

  private returnToMenu(): void {
    this.scene.start('scene-menu');
  }

  private handleShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    this.input.keyboard?.off('keydown-BACKSPACE', this.returnToMenu, this);
    this.galaxyImage?.destroy();
    this.galaxyImage = null;
    if (this.textures.exists(PROCEDURAL_GALAXY_TEXTURE_KEY)) {
      this.textures.remove(PROCEDURAL_GALAXY_TEXTURE_KEY);
    }
  }
}

function getTextureSize(width: number, height: number): number {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const rawSize = Math.max(width, height) * pixelRatio;
  const steppedSize = Math.ceil(rawSize / TEXTURE_SIZE_STEP) * TEXTURE_SIZE_STEP;
  return Phaser.Math.Clamp(steppedSize, MIN_TEXTURE_SIZE, MAX_TEXTURE_SIZE);
}
