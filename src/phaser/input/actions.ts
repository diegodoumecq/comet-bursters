import Phaser from 'phaser';

import type { Vector } from '../core/types';

export type ActionState = {
  aim: Vector;
  firePrimary: boolean;
  fireSecondary: boolean;
  move: Vector;
  shield: boolean;
  timeDilation: boolean;
};

export class ActionReader {
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'time' | 'primary' | 'secondary' | 'shield', Phaser.Input.Keyboard.Key>;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard plugin is unavailable');
    }
    this.keys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      time: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      primary: Phaser.Input.Keyboard.KeyCodes.SPACE,
      secondary: Phaser.Input.Keyboard.KeyCodes.E,
      shield: Phaser.Input.Keyboard.KeyCodes.F,
    }) as typeof this.keys;
    scene.input.mouse?.disableContextMenu();
  }

  read(origin: Vector): ActionState {
    const pointer = this.scene.input.activePointer;
    const camera = this.scene.cameras.main;
    const pad = this.scene.input.gamepad?.getPad(0);
    const rawPadMove = pad ? { x: pad.leftStick.x, y: pad.leftStick.y } : null;
    const move = rawPadMove && Math.hypot(rawPadMove.x, rawPadMove.y) > 0.15
      ? rawPadMove
      : {
          x: Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
          y: Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
        };
    const pointerAim = {
      x: pointer.x - (origin.x - camera.scrollX),
      y: pointer.y - (origin.y - camera.scrollY),
    };
    const padAim = pad ? { x: pad.rightStick.x, y: pad.rightStick.y } : null;
    const aim = padAim && Math.hypot(padAim.x, padAim.y) > 0.2 ? padAim : pointerAim;

    return {
      aim,
      firePrimary: pointer.leftButtonDown() || this.keys.primary.isDown || Boolean(pad?.L1),
      fireSecondary: pointer.rightButtonDown() || this.keys.secondary.isDown || Boolean(pad?.R1),
      move,
      shield: this.keys.shield.isDown || Boolean(pad?.R2),
      timeDilation: this.keys.time.isDown || Boolean(pad?.L2),
    };
  }
}
