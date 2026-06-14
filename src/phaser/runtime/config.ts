import Phaser from 'phaser';

import { PhaserArcadeScene } from '../scenes/arcade/ArcadeScene';
import { BootScene } from '../scenes/boot/BootScene';
import { PhaserDemoScene } from '../scenes/demo/DemoScene';
import { PhaserRiftSpaceScene } from '../scenes/arcade/rift/RiftSpaceScene';
import { PhaserSandboxScene } from '../scenes/sandbox/SandboxScene';
import { SceneMenuScene } from '../scenes/menu/SceneMenuScene';
import { PhaserShipInteriorScene } from '../scenes/shipInterior/ShipInteriorScene';

export function createPhaserConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#05070d',
    transparent: true,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      gamepad: false,
    },
    render: {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    },
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [
      BootScene,
      SceneMenuScene,
      PhaserDemoScene,
      PhaserArcadeScene,
      PhaserRiftSpaceScene,
      PhaserSandboxScene,
      PhaserShipInteriorScene,
    ],
  };
}
