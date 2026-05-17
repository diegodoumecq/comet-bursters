import Phaser from 'phaser';

import { ASTEROID_TEXTURES, createAsteroidTextures } from '../services/asteroidTextures';
import { ASTEROIDS } from '../services/asteroids';

export class AsteroidDebugScene extends Phaser.Scene {
  constructor() {
    super('asteroid-debug');
  }

  create(): void {
    createAsteroidTextures(this);
    const tiers = Object.keys(ASTEROIDS) as Array<keyof typeof ASTEROIDS>;
    tiers.forEach((tier, row) => {
      ASTEROID_TEXTURES[tier].forEach((texture, column) => {
        const x = 180 + column * 280;
        const y = 140 + row * 220;
        this.add.image(x, y, texture);
        this.add.circle(x, y, ASTEROIDS[tier].collisionRadius).setStrokeStyle(2, 0xffffff, 0.9);
        this.add.text(x, y + ASTEROIDS[tier].radius + 18, `${tier} / variant ${column}`, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '16px',
        }).setOrigin(0.5);
      });
    });
  }
}
