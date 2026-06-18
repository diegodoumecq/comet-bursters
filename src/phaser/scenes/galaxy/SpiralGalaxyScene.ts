import Phaser from 'phaser';

import { createSpiralGalaxyShaderTexture, SPIRAL_GALAXY_TEXTURE_KEY } from './spiralGalaxyShader';

const MAX_GALAXY_TEXTURE_SIZE = 2048;
const MIN_GALAXY_TEXTURE_SIZE = 768;
const GALAXY_TEXTURE_SIZE_STEP = 128;
const GALAXY_DRIFT_RADIUS = 4;

export class PhaserSpiralGalaxyScene extends Phaser.Scene {
  private galaxyImage: Phaser.GameObjects.Image | null = null;
  private fallbackGraphics: Phaser.GameObjects.Graphics | null = null;
  private textureSize = 0;

  constructor() {
    super('spiral-galaxy');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#02030a');
    this.renderGalaxyTexture();
    this.scale.on('resize', this.handleResize, this);
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.input.keyboard?.on('keydown-BACKSPACE', this.returnToMenu, this);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  update(time: number): void {
    if (!this.galaxyImage) return;

    this.galaxyImage.setPosition(
      this.scale.width * 0.5 + Math.cos(time * 0.00004) * GALAXY_DRIFT_RADIUS,
      this.scale.height * 0.5 + Math.sin(time * 0.000031) * GALAXY_DRIFT_RADIUS,
    );
  }

  private handleResize(): void {
    this.renderGalaxyTexture();
  }

  private renderGalaxyTexture(): void {
    const nextTextureSize = getGalaxyTextureSize(this.scale.width, this.scale.height);
    if (this.galaxyImage && nextTextureSize === this.textureSize) {
      this.layoutGalaxyImage(this.galaxyImage, nextTextureSize);
      return;
    }

    this.galaxyImage?.destroy();
    this.galaxyImage = null;
    this.fallbackGraphics?.destroy();
    this.fallbackGraphics = null;
    if (this.textures.exists(SPIRAL_GALAXY_TEXTURE_KEY))
      this.textures.remove(SPIRAL_GALAXY_TEXTURE_KEY);

    if (
      createSpiralGalaxyShaderTexture(this, SPIRAL_GALAXY_TEXTURE_KEY, nextTextureSize, {
        height: this.scale.height,
        width: this.scale.width,
      })
    ) {
      this.textureSize = nextTextureSize;
      this.galaxyImage = this.add.image(0, 0, SPIRAL_GALAXY_TEXTURE_KEY).setDepth(0);
      this.layoutGalaxyImage(this.galaxyImage, nextTextureSize);
      return;
    }

    this.textureSize = 0;
    this.createFallbackGalaxy();
  }

  private layoutGalaxyImage(image: Phaser.GameObjects.Image, _textureSize: number): void {
    image
      .setOrigin(0.5)
      .setPosition(this.scale.width * 0.5, this.scale.height * 0.5)
      .setDisplaySize(this.scale.width, this.scale.height);
  }

  private createFallbackGalaxy(): void {
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;
    const radius = Math.max(this.scale.width, this.scale.height) * 0.48;
    const graphics = this.add.graphics().setDepth(0);
    graphics.fillStyle(0x02030a, 1);
    graphics.fillRect(0, 0, this.scale.width, this.scale.height);
    graphics.fillStyle(0x2d335f, 0.42);
    graphics.fillEllipse(centerX, centerY, radius * 1.7, radius * 0.74);
    graphics.fillStyle(0xffd48a, 0.72);
    graphics.fillEllipse(centerX, centerY, radius * 0.26, radius * 0.2);
    this.fallbackGraphics = graphics;
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
    this.fallbackGraphics?.destroy();
    this.fallbackGraphics = null;
    if (this.textures.exists(SPIRAL_GALAXY_TEXTURE_KEY))
      this.textures.remove(SPIRAL_GALAXY_TEXTURE_KEY);
  }
}

function getGalaxyTextureSize(width: number, height: number): number {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const rawSize = Math.max(width, height) * pixelRatio;
  const steppedSize = Math.ceil(rawSize / GALAXY_TEXTURE_SIZE_STEP) * GALAXY_TEXTURE_SIZE_STEP;
  return Phaser.Math.Clamp(steppedSize, MIN_GALAXY_TEXTURE_SIZE, MAX_GALAXY_TEXTURE_SIZE);
}
