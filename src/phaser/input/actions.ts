import Phaser from 'phaser';
import { createJoymap, createQueryModule, type Joymap, type QueryModule } from 'joymap';

import type { Vector } from '../core/types';

type KeyboardActionKeys =
  | 'down'
  | 'left'
  | 'primary'
  | 'right'
  | 'secondary'
  | 'shield'
  | 'time'
  | 'up';

export type ActionState = {
  aim: Vector;
  firePrimary: boolean;
  fireSecondary: boolean;
  move: Vector;
  shield: boolean;
  timeDilation: boolean;
};

export class ActionReader {
  private readonly gamepad = new JoymapActionLayer();
  private readonly keys: Record<KeyboardActionKeys, Phaser.Input.Keyboard.Key>;

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
    this.gamepad.poll();
    const pointer = this.scene.input.activePointer;
    const camera = this.scene.cameras.main;
    const gamepad = this.gamepad.read();
    const keyboardMove = {
      x: Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      y: Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
    };
    const move = vectorHasInput(gamepad.move) ? gamepad.move : keyboardMove;
    const pointerAim = {
      x: pointer.x - (origin.x - camera.scrollX),
      y: pointer.y - (origin.y - camera.scrollY),
    };
    const aim = vectorHasInput(gamepad.aim) ? gamepad.aim : pointerAim;

    return {
      aim,
      firePrimary: pointer.leftButtonDown() || this.keys.primary.isDown || gamepad.firePrimary,
      fireSecondary:
        pointer.rightButtonDown() || this.keys.secondary.isDown || gamepad.fireSecondary,
      move,
      shield: this.keys.shield.isDown || gamepad.shield,
      timeDilation: this.keys.time.isDown || gamepad.timeDilation,
    };
  }
}

class JoymapActionLayer {
  private readonly joymap: Joymap | null = null;
  private readonly module: QueryModule | null = null;

  constructor() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    this.joymap = createJoymap({ autoConnect: true });
    this.module = createQueryModule({ clampThreshold: true, threshold: 0.2 });
    this.module.setButton('primaryFire', [4]);
    this.module.setButton('secondaryFire', [5]);
    this.module.setButton('timeDilation', [6]);
    this.module.setButton('shield', [7]);
    this.module.setStick('move', [[0, 1]]);
    this.module.setStick('aim', [[2, 3]]);
    this.joymap.addModule(this.module);
  }

  poll(): void {
    this.joymap?.poll();
  }

  read(): ActionState {
    if (!this.module?.isConnected()) return EMPTY_ACTION_STATE;
    return {
      aim: stickValueToVector(this.module.getStick('aim').value),
      firePrimary: this.module.getButton('primaryFire').pressed,
      fireSecondary: this.module.getButton('secondaryFire').pressed,
      move: stickValueToVector(this.module.getStick('move').value),
      shield: this.module.getButton('shield').pressed,
      timeDilation: this.module.getButton('timeDilation').pressed,
    };
  }
}

const EMPTY_ACTION_STATE: ActionState = {
  aim: { x: 0, y: 0 },
  firePrimary: false,
  fireSecondary: false,
  move: { x: 0, y: 0 },
  shield: false,
  timeDilation: false,
};

function stickValueToVector(value: number[]): Vector {
  return {
    x: value[0] ?? 0,
    y: value[1] ?? 0,
  };
}

function vectorHasInput(vector: Vector): boolean {
  return Math.hypot(vector.x, vector.y) > 0;
}
