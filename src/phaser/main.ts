import Phaser from 'phaser';

import { createPhaserConfig } from './runtime/config';

new Phaser.Game(createPhaserConfig('app'));
