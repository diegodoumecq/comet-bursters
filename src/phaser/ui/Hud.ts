import Phaser from 'phaser';

export class Hud {
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(20, 20, '', { color: '#ffffff', fontFamily: 'monospace', fontSize: '18px' })
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(values: { asteroids: number; fuel?: number; lives?: number; primary?: string; projectiles: number; score?: number; secondary?: string; timeDilation: boolean; wave?: number }): void {
    this.text.setText([
      values.wave === undefined ? 'Phaser Demo Scene' : 'Phaser Arcade Scene',
      ...(values.wave === undefined ? [] : [
        `Wave ${values.wave}`,
        `Score ${values.score ?? 0}`,
        `Lives ${values.lives ?? 0}`,
        `Fuel ${Math.round(values.fuel ?? 0)}`,
        `${values.primary ?? 'small'} / ${values.secondary ?? 'pusher'}`,
      ]),
      `Asteroids ${values.asteroids}`,
      `Projectiles ${values.projectiles}`,
      `Time ${values.timeDilation ? '0.5x' : '1x'}`,
    ]);
  }
}
