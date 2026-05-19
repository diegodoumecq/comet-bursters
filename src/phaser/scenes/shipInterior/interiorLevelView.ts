import Phaser from 'phaser';

import type { LoadedShipInteriorLayer, ShipInteriorLevel } from '../../../scenes/ShipInteriorScene/level';

export function renderShipInteriorLayers(
  scene: Phaser.Scene,
  level: ShipInteriorLevel,
  overhead: boolean,
  depth: number,
): void {
  for (const layer of level.layers) {
    if (layer.overhead === overhead) renderLayer(scene, layer, depth);
  }
}

export function buildShipInteriorCollision(scene: Phaser.Scene, level: ShipInteriorLevel): void {
  for (const layer of level.layers) {
    if (layer.hasCollision) addLayerCollision(scene, layer);
  }
}

function renderLayer(scene: Phaser.Scene, layer: LoadedShipInteriorLayer, depth: number): void {
  const textureKey = getTextureKey(layer);
  if (!scene.textures.exists(textureKey)) scene.textures.addImage(textureKey, layer.sheet.image);
  for (const tile of layer.tilemap.tiles) {
    const frame = layer.sheet.getFrame(tile.frame);
    const width = tile.width ?? layer.tilemap.tileWidth;
    const height = tile.height ?? layer.tilemap.tileHeight;
    const x = (layer.tilemap.offsetX ?? 0) + tile.tileX * layer.tilemap.tileWidth;
    const y = (layer.tilemap.offsetY ?? 0) + tile.tileY * layer.tilemap.tileHeight;
    scene.add.image(x + width * 0.5, y + height * 0.5, textureKey)
      .setOrigin(0.5)
      .setCrop(frame.x, frame.y, frame.width, frame.height)
      .setDisplaySize(width, height)
      .setAlpha(layer.opacity)
      .setDepth(depth + y * 0.0001);
  }
}

function addLayerCollision(scene: Phaser.Scene, layer: LoadedShipInteriorLayer): void {
  for (const tile of layer.tilemap.tiles) {
    const width = tile.width ?? layer.tilemap.tileWidth;
    const height = tile.height ?? layer.tilemap.tileHeight;
    const x = (layer.tilemap.offsetX ?? 0) + tile.tileX * layer.tilemap.tileWidth;
    const y = (layer.tilemap.offsetY ?? 0) + tile.tileY * layer.tilemap.tileHeight;
    scene.matter.add.rectangle(x + width * 0.5, y + height * 0.5, width, height, {
      isStatic: true,
    });
  }
}

function getTextureKey(layer: LoadedShipInteriorLayer): string {
  return `ship-interior-tileset:${layer.tilesetId}`;
}
