import Phaser from 'phaser';

import type { ActionState } from '../input/actions';

export abstract class BaseGameScene extends Phaser.Scene {
  update(time: number, delta: number): void {
    const input = this.readFrameInput();
    this.updateState(input, time, delta);
    this.renderState(input, time);
  }

  protected abstract readFrameInput(): ActionState;
  protected abstract updateState(input: ActionState, time: number, delta: number): void;
  protected abstract renderState(input: ActionState, time: number): void;
}
