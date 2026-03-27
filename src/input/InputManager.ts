import type { QueryModule } from 'joymap';

import type { ButtonResult, InputState, StickResult } from './types';
import { emptyButton, emptyStick } from './types';

class InputManagerImpl {
  private keyboardState = {
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false,
    space: false,
    enter: false,
  };

  private mousePos = { x: 0, y: 0 };

  private mouseButtons = {
    left: false,
    right: false,
  };

  private prevMouseButtons = {
    left: false,
    right: false,
  };

  private prevKeyboardState = { ...this.keyboardState };

  private gamepadConnected = false;

  constructor() {
    this.setupKeyboardListeners();
    this.setupMouseListeners();
    this.setupGamepadListeners();
  }

  private setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key in this.keyboardState) {
        this.keyboardState[key as keyof typeof this.keyboardState] = true;
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        this.keyboardState.space = true;
      } else if (e.key === 'Enter') {
        this.keyboardState.enter = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key in this.keyboardState) {
        this.keyboardState[key as keyof typeof this.keyboardState] = false;
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        this.keyboardState.space = false;
      } else if (e.key === 'Enter') {
        this.keyboardState.enter = false;
      }
    });
  }

  private setupMouseListeners() {
    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseButtons.left = true;
      } else if (e.button === 2) {
        this.mouseButtons.right = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseButtons.left = false;
      } else if (e.button === 2) {
        this.mouseButtons.right = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private setupGamepadListeners() {
    window.addEventListener('gamepadconnected', () => {
      this.gamepadConnected = true;
    });

    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadConnected = false;
    });
  }

  private getKeyboardMove(): StickResult {
    let x = 0;
    let y = 0;

    if (this.keyboardState.a) x -= 1;
    if (this.keyboardState.d) x += 1;
    if (this.keyboardState.w) y -= 1;
    if (this.keyboardState.s) y += 1;

    const pressed = x !== 0 || y !== 0;

    if (pressed) {
      const mag = Math.sqrt(x * x + y * y);
      x /= mag;
      y /= mag;
    }

    return {
      type: 'stick',
      value: [x, y],
      pressed,
      justChanged: false,
      inverts: [false, false],
    };
  }

  private getKeyboardFireReallyHard(): ButtonResult {
    const pressed = this.keyboardState.q;
    return {
      type: 'button',
      value: pressed ? 1 : 0,
      pressed,
      justChanged: pressed && !this.prevKeyboardState.q,
    };
  }

  private getKeyboardChaosFire(): ButtonResult {
    const pressed = this.keyboardState.e;
    return {
      type: 'button',
      value: pressed ? 1 : 0,
      pressed,
      justChanged: pressed && !this.prevKeyboardState.e,
    };
  }

  private getMouseAim(playerX: number, playerY: number): StickResult {
    const dx = this.mousePos.x - playerX;
    const dy = this.mousePos.y - playerY;

    return {
      type: 'stick',
      value: [dx, dy],
      pressed: true,
      justChanged: false,
      inverts: [false, false],
    };
  }

  private getMouseFire(): ButtonResult {
    const pressed = this.mouseButtons.left;
    return {
      type: 'button',
      value: pressed ? 1 : 0,
      pressed,
      justChanged: pressed && !this.prevMouseButtons.left,
    };
  }

  private getMouseFireSpecial(): ButtonResult {
    const pressed = this.mouseButtons.right;
    return {
      type: 'button',
      value: pressed ? 1 : 0,
      pressed,
      justChanged: pressed && !this.prevMouseButtons.right,
    };
  }

  private getGamepadInput(module: QueryModule | undefined): Partial<InputState> {
    if (!this.gamepadConnected || !module) {
      return {};
    }

    const sticks = module.getSticks('L', 'R');
    const buttons = module.getButtons('R1', 'L1', 'R2', 'L2', 'A');

    return {
      move: {
        type: 'stick' as const,
        value: (sticks.L?.value || [0, 0]) as [number, number],
        pressed: sticks.L?.pressed || false,
        justChanged: sticks.L?.justChanged || false,
        inverts: (sticks.L?.inverts || [false, false]) as [boolean, boolean],
      },
      aim: {
        type: 'stick' as const,
        value: (sticks.R?.value || [0, 0]) as [number, number],
        pressed: sticks.R?.pressed || false,
        justChanged: sticks.R?.justChanged || false,
        inverts: (sticks.R?.inverts || [false, false]) as [boolean, boolean],
      },
      fire: {
        type: 'button' as const,
        value: buttons.R1?.value || 0,
        pressed: buttons.R1?.pressed || false,
        justChanged: buttons.R1?.justChanged || false,
      },
      fireSpecial: {
        type: 'button' as const,
        value: buttons.L1?.value || 0,
        pressed: buttons.L1?.pressed || false,
        justChanged: buttons.L1?.justChanged || false,
      },
      fireReallyHard: {
        type: 'button' as const,
        value: buttons.R2?.value || 0,
        pressed: buttons.R2?.pressed || false,
        justChanged: buttons.R2?.justChanged || false,
      },
      chaosFire: {
        type: 'button' as const,
        value: buttons.L2?.value || 0,
        pressed: buttons.L2?.pressed || false,
        justChanged: buttons.L2?.justChanged || false,
      },
      shield: {
        type: 'button' as const,
        value: buttons.A?.value || 0,
        pressed: buttons.A?.pressed || false,
        justChanged: buttons.A?.justChanged || false,
      },
    };
  }

  private mergeSticks(keyboard: StickResult, gamepad: StickResult): StickResult {
    const kx = keyboard.value[0];
    const ky = keyboard.value[1];
    const gx = gamepad.value[0];
    const gy = gamepad.value[1];

    let x = kx + gx;
    let y = ky + gy;

    const pressed = keyboard.pressed || gamepad.pressed;
    const justChanged = keyboard.justChanged || gamepad.justChanged;

    if (pressed) {
      const mag = Math.sqrt(x * x + y * y);
      if (mag > 1) {
        x /= mag;
        y /= mag;
      }
    } else {
      x = 0;
      y = 0;
    }

    return {
      type: 'stick',
      value: [x, y],
      pressed,
      justChanged,
      inverts: [false, false],
    };
  }

  private mergeButtons(
    keyboard: ButtonResult,
    gamepad: ButtonResult,
    mouse: ButtonResult,
  ): ButtonResult {
    const pressed = keyboard.pressed || gamepad.pressed || mouse.pressed;
    const value = pressed ? 1 : 0;
    const justChanged = keyboard.justChanged || gamepad.justChanged || mouse.justChanged;

    return {
      type: 'button',
      value,
      pressed,
      justChanged,
    };
  }

  getInputState(module?: QueryModule, playerX = 0, playerY = 0): InputState {
    const gamepadInput = this.getGamepadInput(module);

    const keyboardMove = this.getKeyboardMove();
    const keyboardFireReallyHard = this.getKeyboardFireReallyHard();
    const keyboardChaosFire = this.getKeyboardChaosFire();

    const mouseAim = this.getMouseAim(playerX, playerY);
    const mouseFire = this.getMouseFire();
    const mouseFireSpecial = this.getMouseFireSpecial();

    const gamepadMove = gamepadInput.move || emptyStick;
    const gamepadAim = gamepadInput.aim || emptyStick;
    const gamepadFire = gamepadInput.fire || emptyButton;
    const gamepadFireSpecial = gamepadInput.fireSpecial || emptyButton;
    const gamepadFireReallyHard = gamepadInput.fireReallyHard || emptyButton;
    const gamepadChaosFire = gamepadInput.chaosFire || emptyButton;
    const gamepadShield = gamepadInput.shield || emptyButton;

    const mergedMove = this.mergeSticks(keyboardMove, gamepadMove);

    let mergedAim: StickResult;
    if (gamepadAim.pressed) {
      mergedAim = gamepadAim;
    } else {
      mergedAim = mouseAim;
    }

    const mergedFire = this.mergeButtons(emptyButton, gamepadFire, mouseFire);
    const mergedFireSpecial = this.mergeButtons(emptyButton, gamepadFireSpecial, mouseFireSpecial);
    const mergedFireReallyHard = this.mergeButtons(
      keyboardFireReallyHard,
      gamepadFireReallyHard,
      emptyButton,
    );
    const mergedChaosFire = this.mergeButtons(keyboardChaosFire, gamepadChaosFire, emptyButton);
    const mergedShield = this.mergeButtons(emptyButton, gamepadShield, emptyButton);

    return {
      move: mergedMove,
      aim: mergedAim,
      fire: mergedFire,
      fireSpecial: mergedFireSpecial,
      fireReallyHard: mergedFireReallyHard,
      chaosFire: mergedChaosFire,
      shield: mergedShield,
    };
  }

  getMousePosition() {
    return { ...this.mousePos };
  }

  wasAnyKeyJustPressed(): boolean {
    const justPressed =
      (this.keyboardState.space && !this.prevKeyboardState.space) ||
      (this.keyboardState.enter && !this.prevKeyboardState.enter) ||
      (this.mouseButtons.left && !this.prevMouseButtons.left) ||
      (this.mouseButtons.right && !this.prevMouseButtons.right);

    this.prevKeyboardState = { ...this.keyboardState };
    this.prevMouseButtons = { ...this.mouseButtons };
    return justPressed;
  }

  isAnyGamepadConnected(): boolean {
    return this.gamepadConnected;
  }

  isAnyInputJustPressed(module?: QueryModule): boolean {
    const keyJustPressed = this.wasAnyKeyJustPressed();
    if (keyJustPressed) return true;

    if (module && module.isConnected()) {
      const buttons = module.getAllButtons();
      for (const button of Object.values(buttons)) {
        if (button.pressed && button.justChanged) {
          return true;
        }
      }
    }

    return false;
  }
}

export const InputManager = new InputManagerImpl();
