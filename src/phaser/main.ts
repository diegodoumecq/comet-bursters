import Phaser from 'phaser';

import { createPhaserConfig } from './runtime/config';
import { createFpsOverlay } from './runtime/fpsOverlay';

const game = new Phaser.Game(createPhaserConfig('app'));
createFpsOverlay(game);
