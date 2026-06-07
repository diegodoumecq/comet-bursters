import Phaser from 'phaser';

import { getSandboxPerfToggles } from '../runtime/startup';
import { withPerformanceMeasure } from './performance';

export function createCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Phaser.Textures.CanvasTexture {
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Unable to create canvas texture ${key}`);
  try {
    withPerformanceMeasure(`texture.canvas.${key}`, getSandboxPerfToggles().markers, () => {
      texture.context.save();
      try {
        texture.context.clearRect(0, 0, width, height);
        draw(texture.context);
      } finally {
        texture.context.restore();
      }
      texture.refresh();
    });
    return texture;
  } catch (error) {
    scene.textures.remove(key);
    throw error;
  }
}
