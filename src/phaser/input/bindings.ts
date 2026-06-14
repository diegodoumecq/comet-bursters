export const PHASER_INPUT_VERBS = [
  'up',
  'down',
  'left',
  'right',
  'firePrimary',
  'fireSecondary',
  'shield',
  'timeDilation',
  'debugRiftWindow',
  'debugRiftCamera',
] as const;

export type PhaserInputVerb = (typeof PHASER_INPUT_VERBS)[number];
export type PhaserVectorVerb = 'move';
export type GamepadStickName = PhaserVectorVerb | 'aim';
export type MouseButtonName = 'left' | 'middle' | 'right' | 'back' | 'forward';

export type KeyboardInputTerm = {
  code: number;
  source: 'keyboard';
};

export type MouseButtonInputTerm = {
  button: MouseButtonName;
  source: 'mouseButton';
};

export type GamepadButtonInputTerm = {
  name: string;
  source: 'gamepadButton';
};

export type GamepadStickDirectionInputTerm = {
  axis: 'x' | 'y';
  direction: -1 | 1;
  name: string;
  source: 'gamepadStickDirection';
};

export type PhaserInputTerm =
  | KeyboardInputTerm
  | MouseButtonInputTerm
  | GamepadButtonInputTerm
  | GamepadStickDirectionInputTerm;

export type PhaserInputChord = readonly PhaserInputTerm[];
export type PhaserInputBindings = Record<PhaserInputVerb, readonly PhaserInputChord[]>;

export type StoredGamepadConfig = {
  buttons: Record<string, number[]>;
  clampThreshold: boolean;
  sticks: Record<string, { indexes: number[][]; inverts: boolean[] }>;
  threshold: number;
};

export const INPUT_BINDINGS_STORAGE_KEY = 'comet-bursters-input-bindings-v1';
export const GAMEPAD_CONFIG_STORAGE_KEY = 'comet-bursters-gamepad-config-v1';

export const PHASER_INPUT_VERB_LABELS: Record<PhaserInputVerb, string> = {
  debugRiftCamera: 'Debug camera rift',
  debugRiftWindow: 'Debug window rift',
  down: 'Down',
  firePrimary: 'Primary fire',
  fireSecondary: 'Secondary fire',
  left: 'Left',
  right: 'Right',
  shield: 'Shield',
  timeDilation: 'Time dilation',
  up: 'Up',
};

const KEY_CODES = {
  A: 65,
  D: 68,
  E: 69,
  F: 70,
  G: 71,
  S: 83,
  SPACE: 32,
  SHIFT: 16,
  T: 84,
  W: 87,
} as const;

export const KEY_CODE_LABELS: Record<number, string> = {
  8: 'Backspace',
  9: 'Tab',
  13: 'Enter',
  [KEY_CODES.A]: 'A',
  [KEY_CODES.D]: 'D',
  [KEY_CODES.E]: 'E',
  [KEY_CODES.F]: 'F',
  [KEY_CODES.G]: 'G',
  [KEY_CODES.S]: 'S',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  19: 'Pause',
  20: 'Caps Lock',
  27: 'Escape',
  [KEY_CODES.SPACE]: 'Space',
  33: 'Page Up',
  34: 'Page Down',
  35: 'End',
  36: 'Home',
  37: 'Arrow Left',
  38: 'Arrow Up',
  39: 'Arrow Right',
  40: 'Arrow Down',
  45: 'Insert',
  46: 'Delete',
  [KEY_CODES.T]: 'T',
  [KEY_CODES.W]: 'W',
  91: 'Meta',
  93: 'Context Menu',
  96: 'Numpad 0',
  97: 'Numpad 1',
  98: 'Numpad 2',
  99: 'Numpad 3',
  100: 'Numpad 4',
  101: 'Numpad 5',
  102: 'Numpad 6',
  103: 'Numpad 7',
  104: 'Numpad 8',
  105: 'Numpad 9',
  106: 'Numpad *',
  107: 'Numpad +',
  109: 'Numpad -',
  110: 'Numpad .',
  111: 'Numpad /',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
};

export const GAMEPAD_BUTTON_LABELS: Record<string, string> = {
  down: 'D-pad down',
  firePrimary: 'L1',
  fireSecondary: 'R1',
  left: 'D-pad left',
  right: 'D-pad right',
  shield: 'R2',
  timeDilation: 'L2',
  up: 'D-pad up',
};

export const STANDARD_GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'L1',
  5: 'R1',
  6: 'L2',
  7: 'R2',
  8: 'Select',
  9: 'Start',
  10: 'L3',
  11: 'R3',
  12: 'D-pad up',
  13: 'D-pad down',
  14: 'D-pad left',
  15: 'D-pad right',
  16: 'Home',
};

export const GAMEPAD_STICK_LABELS: Record<GamepadStickName, string> = {
  aim: 'Aim stick',
  move: 'Move stick',
};

const key = (code: number): KeyboardInputTerm => ({ code, source: 'keyboard' });
const mouse = (button: MouseButtonName): MouseButtonInputTerm => ({
  button,
  source: 'mouseButton',
});
const gamepadButton = (name: string): GamepadButtonInputTerm => ({ name, source: 'gamepadButton' });
const gamepadStickDirection = (
  name: string,
  axis: 'x' | 'y',
  direction: -1 | 1,
): GamepadStickDirectionInputTerm => ({
  axis,
  direction,
  name,
  source: 'gamepadStickDirection',
});

export const DEFAULT_INPUT_BINDINGS: PhaserInputBindings = {
  debugRiftCamera: [[key(KEY_CODES.G)]],
  debugRiftWindow: [[key(KEY_CODES.T)]],
  down: [[key(KEY_CODES.S)], [gamepadButton('down')], [gamepadStickDirection('move', 'y', 1)]],
  firePrimary: [[key(KEY_CODES.SPACE)], [mouse('left')], [gamepadButton('firePrimary')]],
  fireSecondary: [[key(KEY_CODES.E)], [mouse('right')], [gamepadButton('fireSecondary')]],
  left: [[key(KEY_CODES.A)], [gamepadButton('left')], [gamepadStickDirection('move', 'x', -1)]],
  right: [[key(KEY_CODES.D)], [gamepadButton('right')], [gamepadStickDirection('move', 'x', 1)]],
  shield: [[key(KEY_CODES.F)], [gamepadButton('shield')]],
  timeDilation: [[key(KEY_CODES.SHIFT)], [gamepadButton('timeDilation')]],
  up: [[key(KEY_CODES.W)], [gamepadButton('up')], [gamepadStickDirection('move', 'y', -1)]],
};

export const DEFAULT_GAMEPAD_CONFIG: StoredGamepadConfig = {
  buttons: {
    down: [13],
    firePrimary: [4],
    fireSecondary: [5],
    left: [14],
    right: [15],
    shield: [7],
    timeDilation: [6],
    up: [12],
  },
  clampThreshold: true,
  sticks: {
    aim: { indexes: [[2, 3]], inverts: [false, false] },
    move: { indexes: [[0, 1]], inverts: [false, false] },
  },
  threshold: 0.2,
};

export function readStoredPhaserInputBindings(
  storage: Storage = window.localStorage,
): PhaserInputBindings {
  return parsePhaserInputBindings(storage.getItem(INPUT_BINDINGS_STORAGE_KEY));
}

export function writeStoredPhaserInputBindings(
  bindings: PhaserInputBindings,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(INPUT_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
}

export function readStoredGamepadConfig(
  storage: Storage = window.localStorage,
): StoredGamepadConfig {
  return parseGamepadConfig(storage.getItem(GAMEPAD_CONFIG_STORAGE_KEY));
}

export function writeStoredGamepadConfig(
  config: StoredGamepadConfig,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(GAMEPAD_CONFIG_STORAGE_KEY, JSON.stringify(normalizeGamepadConfig(config)));
}

export function resetStoredPhaserInput(storage: Storage = window.localStorage): void {
  storage.removeItem(INPUT_BINDINGS_STORAGE_KEY);
  storage.removeItem(GAMEPAD_CONFIG_STORAGE_KEY);
}

export function parsePhaserInputBindings(serialized: string | null): PhaserInputBindings {
  if (!serialized) return cloneBindings(DEFAULT_INPUT_BINDINGS);

  try {
    const parsed = JSON.parse(serialized) as Partial<PhaserInputBindings>;
    return normalizeInputBindings(parsed);
  } catch {
    return cloneBindings(DEFAULT_INPUT_BINDINGS);
  }
}

export function parseGamepadConfig(serialized: string | null): StoredGamepadConfig {
  if (!serialized) return cloneGamepadConfig(DEFAULT_GAMEPAD_CONFIG);

  try {
    return normalizeGamepadConfig(JSON.parse(serialized) as Partial<StoredGamepadConfig>);
  } catch {
    return cloneGamepadConfig(DEFAULT_GAMEPAD_CONFIG);
  }
}

export function normalizeInputBindings(input: Partial<PhaserInputBindings>): PhaserInputBindings {
  const bindings = cloneBindings(DEFAULT_INPUT_BINDINGS);
  for (const verb of PHASER_INPUT_VERBS) {
    const verbBindings = input[verb];
    if (Array.isArray(verbBindings)) {
      const normalizedBindings = verbBindings
        .map((chord) => normalizeChord(chord))
        .filter((chord) => chord.length > 0);
      bindings[verb] =
        verbBindings.length > 0 && normalizedBindings.length === 0
          ? bindings[verb]
          : normalizedBindings;
    }
  }
  return bindings;
}

export function normalizeGamepadConfig(input: Partial<StoredGamepadConfig>): StoredGamepadConfig {
  const config = cloneGamepadConfig(DEFAULT_GAMEPAD_CONFIG);
  if (typeof input.threshold === 'number' && Number.isFinite(input.threshold)) {
    config.threshold = Math.max(0, Math.min(1, input.threshold));
  }
  if (typeof input.clampThreshold === 'boolean') {
    config.clampThreshold = input.clampThreshold;
  }
  if (input.buttons && typeof input.buttons === 'object' && !Array.isArray(input.buttons)) {
    for (const [name, indexes] of Object.entries(input.buttons)) {
      if (Array.isArray(indexes)) {
        config.buttons[name] = indexes.filter(isValidGamepadIndex);
      }
    }
  }
  if (input.sticks && typeof input.sticks === 'object' && !Array.isArray(input.sticks)) {
    for (const [name, stick] of Object.entries(input.sticks)) {
      if (stick && Array.isArray(stick.indexes)) {
        config.sticks[name] = {
          indexes: stick.indexes
            .filter((indexes) => Array.isArray(indexes))
            .map((indexes) => indexes.filter(isValidGamepadIndex))
            .filter((indexes) => indexes.length > 0),
          inverts: Array.isArray(stick.inverts) ? stick.inverts.map(Boolean) : [],
        };
      }
    }
  }
  return config;
}

export function cloneBindings(bindings: PhaserInputBindings): PhaserInputBindings {
  return Object.fromEntries(
    PHASER_INPUT_VERBS.map((verb) => [verb, cloneVerbBindings(bindings[verb])]),
  ) as unknown as PhaserInputBindings;
}

export function cloneVerbBindings(bindings: readonly PhaserInputChord[]): PhaserInputChord[] {
  return bindings.map((binding) => binding.map((term) => ({ ...term })));
}

export function cloneGamepadConfig(config: StoredGamepadConfig): StoredGamepadConfig {
  return {
    buttons: Object.fromEntries(
      Object.entries(config.buttons).map(([name, indexes]) => [name, [...indexes]]),
    ),
    clampThreshold: config.clampThreshold,
    sticks: Object.fromEntries(
      Object.entries(config.sticks).map(([name, stick]) => [
        name,
        {
          indexes: stick.indexes.map((indexes) => [...indexes]),
          inverts: [...stick.inverts],
        },
      ]),
    ),
    threshold: config.threshold,
  };
}

export function describeInputChord(chord: PhaserInputChord): string {
  return chord.map(describeInputTerm).join(' + ');
}

export function describeInputTerm(term: PhaserInputTerm): string {
  if (term.source === 'keyboard') {
    return describeKeyboardCode(term.code);
  }
  if (term.source === 'mouseButton') {
    return `${capitalize(term.button)} mouse`;
  }
  if (term.source === 'gamepadButton') {
    return `Gamepad ${GAMEPAD_BUTTON_LABELS[term.name] ?? term.name}`;
  }
  const axis = term.axis.toUpperCase();
  const sign = term.direction > 0 ? '+' : '-';
  return `Gamepad ${term.name} ${axis}${sign}`;
}

export function describeKeyboardCode(code: number): string {
  if (KEY_CODE_LABELS[code]) return KEY_CODE_LABELS[code];
  if (code >= 48 && code <= 57) return String(code - 48);
  if (code >= 65 && code <= 90) return String.fromCharCode(code);
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return `Key ${code}`;
}

export function describeGamepadButtonIndex(index: number): string {
  return STANDARD_GAMEPAD_BUTTON_LABELS[index] ?? `button ${index}`;
}

export function describeGamepadStickIndexes(indexes: number[][] | undefined): string {
  const first = indexes?.[0];
  if (!first || first.length === 0) return 'unmapped';
  return `axes ${first.join(', ')}`;
}

export function createKeyboardChord(code: number): PhaserInputChord {
  return [{ code, source: 'keyboard' }];
}

export function createMouseButtonChord(button: MouseButtonName): PhaserInputChord {
  return [{ button, source: 'mouseButton' }];
}

export function getMouseButtonName(button: number): MouseButtonName | null {
  if (button === 0) return 'left';
  if (button === 1) return 'middle';
  if (button === 2) return 'right';
  if (button === 3) return 'back';
  if (button === 4) return 'forward';
  return null;
}

export function resolveInputFrame(input: {
  bindings: PhaserInputBindings;
  previousPressed: Record<PhaserInputVerb, boolean>;
  readTermValue: (term: PhaserInputTerm) => number;
}): {
  pressed: Record<PhaserInputVerb, boolean>;
  values: Record<PhaserInputVerb, number>;
  justPressed: Record<PhaserInputVerb, boolean>;
  justReleased: Record<PhaserInputVerb, boolean>;
} {
  const pressed = createVerbRecord(false);
  const values = createVerbRecord(0);
  const justPressed = createVerbRecord(false);
  const justReleased = createVerbRecord(false);

  for (const verb of PHASER_INPUT_VERBS) {
    const value = resolveVerbValue(input.bindings[verb], input.readTermValue);
    values[verb] = value;
    pressed[verb] = value > 0;
    justPressed[verb] = pressed[verb] && !input.previousPressed[verb];
    justReleased[verb] = !pressed[verb] && input.previousPressed[verb];
  }

  return { justPressed, justReleased, pressed, values };
}

export function createVerbRecord<T>(value: T): Record<PhaserInputVerb, T> {
  return Object.fromEntries(PHASER_INPUT_VERBS.map((verb) => [verb, value])) as Record<
    PhaserInputVerb,
    T
  >;
}

function resolveVerbValue(
  bindings: readonly PhaserInputChord[],
  readTermValue: (term: PhaserInputTerm) => number,
): number {
  let value = 0;
  for (const binding of bindings) {
    value = Math.max(value, resolveChordValue(binding, readTermValue));
  }
  return value;
}

function resolveChordValue(
  chord: PhaserInputChord,
  readTermValue: (term: PhaserInputTerm) => number,
): number {
  if (chord.length === 0) return 0;

  let value = 1;
  for (const term of chord) {
    const termValue = readTermValue(term);
    if (termValue <= 0) return 0;
    value = Math.min(value, termValue);
  }
  return value;
}

function normalizeChord(chord: unknown): PhaserInputChord {
  if (!Array.isArray(chord)) return [];
  return chord.map(normalizeTerm).filter((term) => term !== null);
}

function normalizeTerm(term: unknown): PhaserInputTerm | null {
  if (!term || typeof term !== 'object') return null;
  const value = term as Partial<PhaserInputTerm>;
  if (value.source === 'keyboard' && typeof value.code === 'number') {
    return { code: value.code, source: 'keyboard' };
  }
  if (value.source === 'mouseButton' && isMouseButtonName(value.button)) {
    return { button: value.button, source: 'mouseButton' };
  }
  if (value.source === 'gamepadButton' && typeof value.name === 'string') {
    return { name: value.name, source: 'gamepadButton' };
  }
  if (
    value.source === 'gamepadStickDirection' &&
    typeof value.name === 'string' &&
    (value.axis === 'x' || value.axis === 'y') &&
    (value.direction === -1 || value.direction === 1)
  ) {
    return {
      axis: value.axis,
      direction: value.direction,
      name: value.name,
      source: 'gamepadStickDirection',
    };
  }
  return null;
}

function isMouseButtonName(value: unknown): value is MouseButtonName {
  return (
    value === 'left' ||
    value === 'middle' ||
    value === 'right' ||
    value === 'back' ||
    value === 'forward'
  );
}

function isValidGamepadIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
