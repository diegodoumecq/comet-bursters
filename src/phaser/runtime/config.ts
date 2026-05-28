import Phaser from 'phaser';

import { PhaserArcadeScene } from '../scenes/ArcadeScene';
import { BootScene } from '../scenes/BootScene';
import { PhaserDemoScene } from '../scenes/DemoScene';
import { PhaserRiftSpaceScene } from '../scenes/RiftSpaceScene';
import { PhaserSandboxScene } from '../scenes/SandboxScene';
import { SceneMenuScene } from '../scenes/SceneMenuScene';
import { PhaserShipInteriorScene } from '../scenes/ShipInteriorScene';

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
      gamepad: true,
    },
    render: {
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
