import Phaser from 'phaser';

import { createCanvasTexture } from '../core/canvasTextures';
import { ENTITIES, type EntityKind } from './config';

export const ENTITY_TEXTURE_KEYS: Record<EntityKind, string> = {
  monolith: 'entity-monolith',
};

export function createEntityTextures(scene: Phaser.Scene): void {
  createMonolithTexture(scene);
}

function createMonolithTexture(scene: Phaser.Scene): void {
  const kind: EntityKind = 'monolith';
  const key = ENTITY_TEXTURE_KEYS[kind];
  if (scene.textures.exists(key)) return;

  const config = ENTITIES[kind];
  const size = config.size;
  createCanvasTexture(scene, key, size, size, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(4, Math.round(size * 0.075));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.18, size * 0.5);
    ctx.lineTo(size * 0.82, size * 0.5);
    ctx.stroke();
  });
}
