import { createJoymap, createQueryModule, type Joymap, type QueryModule } from 'joymap';
import Phaser from 'phaser';

import type { Vector } from '../core/types';
import {
  cloneBindings,
  cloneGamepadConfig,
  cloneVerbBindings,
  createVerbRecord,
  DEFAULT_GAMEPAD_CONFIG,
  normalizeGamepadConfig,
  PHASER_INPUT_VERBS,
  readStoredGamepadConfig,
  readStoredPhaserInputBindings,
  resetStoredPhaserInput,
  resolveInputFrame,
  writeStoredGamepadConfig,
  writeStoredPhaserInputBindings,
  type GamepadButtonInputTerm,
  type GamepadStickDirectionInputTerm,
  type KeyboardInputTerm,
  type MouseButtonInputTerm,
  type PhaserInputBindings,
  type PhaserInputTerm,
  type PhaserInputVerb,
  type PhaserVectorVerb,
  type StoredGamepadConfig,
} from './bindings';

export {
  DEFAULT_GAMEPAD_CONFIG,
  DEFAULT_INPUT_BINDINGS,
  GAMEPAD_BUTTON_LABELS,
  GAMEPAD_CONFIG_STORAGE_KEY,
  INPUT_BINDINGS_STORAGE_KEY,
  KEY_CODE_LABELS,
  PHASER_INPUT_VERB_LABELS,
  PHASER_INPUT_VERBS,
  cloneBindings,
  cloneGamepadConfig,
  cloneVerbBindings,
  createKeyboardChord,
  createMouseButtonChord,
  createVerbRecord,
  describeInputChord,
  describeInputTerm,
  getMouseButtonName,
  normalizeGamepadConfig,
  normalizeInputBindings,
  parseGamepadConfig,
  parsePhaserInputBindings,
  readStoredGamepadConfig,
  readStoredPhaserInputBindings,
  resetStoredPhaserInput,
  resolveInputFrame,
  writeStoredGamepadConfig,
  writeStoredPhaserInputBindings,
  type GamepadButtonInputTerm,
  type GamepadStickDirectionInputTerm,
  type KeyboardInputTerm,
  type MouseButtonInputTerm,
  type MouseButtonName,
  type PhaserInputBindings,
  type PhaserInputChord,
  type PhaserInputTerm,
  type PhaserInputVerb,
  type PhaserVectorVerb,
  type StoredGamepadConfig,
} from './bindings';

export type ActionState = {
  aim: Vector;
  debugRiftCameraJustPressed: boolean;
  debugRiftWindowJustPressed: boolean;
  firePrimary: boolean;
  fireSecondary: boolean;
  move: Vector;
  shield: boolean;
  timeDilation: boolean;
};

type GlobalGamepadInput = {
  joymap: Joymap;
  module: QueryModule;
};

let inputBindings: PhaserInputBindings = readStoredPhaserInputBindings();
let gamepadConfig: StoredGamepadConfig = readStoredGamepadConfig();
let globalGamepadInput: GlobalGamepadInput | null = null;

export function getPhaserInputBindings(): PhaserInputBindings {
  return cloneBindings(inputBindings);
}

export function setPhaserInputBindings(bindings: Partial<PhaserInputBindings>): void {
  inputBindings = {
    ...inputBindings,
    ...clonePartialBindings(bindings),
  };
  writeStoredPhaserInputBindings(inputBindings);
}

export function setPhaserVerbBindings(
  verb: PhaserInputVerb,
  bindings: readonly PhaserInputTerm[][],
): void {
  inputBindings = {
    ...inputBindings,
    [verb]: cloneVerbBindings(bindings),
  };
  writeStoredPhaserInputBindings(inputBindings);
}

export function resetPhaserInputBindings(): void {
  resetStoredPhaserInput();
  inputBindings = readStoredPhaserInputBindings();
  gamepadConfig = cloneGamepadConfig(DEFAULT_GAMEPAD_CONFIG);
  if (globalGamepadInput) applyGamepadConfig(globalGamepadInput.module, gamepadConfig);
}

export function getPhaserGamepadConfig(): string {
  return JSON.stringify(gamepadConfig);
}

export function setPhaserGamepadConfig(serializedConfig: string): void {
  gamepadConfig = normalizeGamepadConfig(
    JSON.parse(serializedConfig) as Partial<StoredGamepadConfig>,
  );
  writeStoredGamepadConfig(gamepadConfig);
  if (globalGamepadInput) applyGamepadConfig(globalGamepadInput.module, gamepadConfig);
}

export function bindPhaserGamepadButtonOnPress(
  verb: PhaserInputVerb,
  callback: (previousButtonName?: string) => void,
  allowDuplication = true,
): void {
  getGlobalGamepadInput().module.buttonBindOnPress(
    verb,
    (previousButtonName) => {
      gamepadConfig = readGamepadModuleConfig(getGlobalGamepadInput().module);
      writeStoredGamepadConfig(gamepadConfig);
      callback(previousButtonName);
    },
    allowDuplication,
  );
}

export function bindPhaserGamepadStickOnPress(
  verb: PhaserVectorVerb,
  callback: (previousStickName?: string) => void,
  allowDuplication = true,
): void {
  getGlobalGamepadInput().module.stickBindOnPress(
    verb,
    (previousStickName) => {
      gamepadConfig = readGamepadModuleConfig(getGlobalGamepadInput().module);
      writeStoredGamepadConfig(gamepadConfig);
      callback(previousStickName);
    },
    allowDuplication,
  );
}

export class ActionReader {
  private readonly keys = new Map<number, Phaser.Input.Keyboard.Key>();
  private readonly previousPressed = createVerbRecord(false);

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.mouse?.disableContextMenu();
  }

  read(origin: Vector): ActionState {
    getGlobalGamepadInput().joymap.poll();
    const frame = resolveInputFrame({
      bindings: inputBindings,
      previousPressed: this.previousPressed,
      readTermValue: (term) => this.readTermValue(term),
    });
    for (const verb of PHASER_INPUT_VERBS) {
      this.previousPressed[verb] = frame.pressed[verb];
    }

    return {
      aim: this.getAim(origin),
      debugRiftCameraJustPressed: frame.justPressed.debugRiftCamera,
      debugRiftWindowJustPressed: frame.justPressed.debugRiftWindow,
      firePrimary: frame.pressed.firePrimary,
      fireSecondary: frame.pressed.fireSecondary,
      move: this.getVector('move', frame.pressed),
      shield: frame.pressed.shield,
      timeDilation: frame.pressed.timeDilation,
    };
  }

  private getAim(origin: Vector): Vector {
    const pointer = this.scene.input.activePointer;
    const camera = this.scene.cameras.main;
    const gamepadAim = getGlobalGamepadInput().module.getStick('aim');
    if (gamepadAim.pressed) {
      return {
        x: gamepadAim.value[0] ?? 0,
        y: gamepadAim.value[1] ?? 0,
      };
    }

    return {
      x: pointer.x - (origin.x - camera.scrollX),
      y: pointer.y - (origin.y - camera.scrollY),
    };
  }

  private getVector(verb: PhaserVectorVerb, pressed: Record<PhaserInputVerb, boolean>): Vector {
    if (verb === 'move') {
      const stick = getGlobalGamepadInput().module.getStick('move');
      if (stick.pressed) {
        return {
          x: stick.value[0] ?? 0,
          y: stick.value[1] ?? 0,
        };
      }
      return {
        x: Number(pressed.right) - Number(pressed.left),
        y: Number(pressed.down) - Number(pressed.up),
      };
    }
    return { x: 0, y: 0 };
  }

  private readTermValue(term: PhaserInputTerm): number {
    if (term.source === 'keyboard') {
      return this.readKeyboardTerm(term);
    }
    if (term.source === 'mouseButton') {
      return this.readMouseButtonTerm(term);
    }
    if (term.source === 'gamepadButton') {
      return readGamepadButtonTerm(term);
    }
    return readGamepadStickDirectionTerm(term);
  }

  private readKeyboardTerm(term: KeyboardInputTerm): number {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return 0;

    let keyObject = this.keys.get(term.code);
    if (!keyObject) {
      keyObject = keyboard.addKey(term.code);
      this.keys.set(term.code, keyObject);
    }
    return keyObject.isDown ? 1 : 0;
  }

  private readMouseButtonTerm(term: MouseButtonInputTerm): number {
    const pointer = this.scene.input.activePointer;
    if (term.button === 'left') return pointer.leftButtonDown() ? 1 : 0;
    if (term.button === 'middle') return pointer.middleButtonDown() ? 1 : 0;
    if (term.button === 'right') return pointer.rightButtonDown() ? 1 : 0;
    if (term.button === 'back') return pointer.backButtonDown() ? 1 : 0;
    return pointer.forwardButtonDown() ? 1 : 0;
  }
}

function getGlobalGamepadInput(): GlobalGamepadInput {
  if (globalGamepadInput) return globalGamepadInput;

  const joymap = createJoymap({ autoConnect: true });
  const module = createQueryModule({
    clampThreshold: gamepadConfig.clampThreshold,
    threshold: gamepadConfig.threshold,
  });
  applyGamepadConfig(module, gamepadConfig);
  joymap.addModule(module);
  globalGamepadInput = { joymap, module };
  return globalGamepadInput;
}

function applyGamepadConfig(module: QueryModule, config: StoredGamepadConfig): void {
  for (const [name, indexes] of Object.entries(config.buttons)) {
    module.setButton(name, indexes);
  }
  for (const [name, stick] of Object.entries(config.sticks)) {
    module.setStick(name, stick.indexes, stick.inverts);
  }
}

function readGamepadModuleConfig(module: QueryModule): StoredGamepadConfig {
  return normalizeGamepadConfig(JSON.parse(module.getConfig()) as Partial<StoredGamepadConfig>);
}

function readGamepadButtonTerm(term: GamepadButtonInputTerm): number {
  const button = getGlobalGamepadInput().module.getButton(term.name);
  return button.pressed ? button.value : 0;
}

function readGamepadStickDirectionTerm(term: GamepadStickDirectionInputTerm): number {
  const stick = getGlobalGamepadInput().module.getStick(term.name);
  const axisIndex = term.axis === 'x' ? 0 : 1;
  const value = stick.value[axisIndex] ?? 0;
  if (term.direction < 0 && value < 0) return Math.abs(value);
  if (term.direction > 0 && value > 0) return value;
  return 0;
}

function clonePartialBindings(
  bindings: Partial<PhaserInputBindings>,
): Partial<PhaserInputBindings> {
  return Object.fromEntries(
    Object.entries(bindings).map(([verb, verbBindings]) => [
      verb,
      cloneVerbBindings(verbBindings ?? []),
    ]),
  ) as Partial<PhaserInputBindings>;
}
