import { describe, expect, it } from 'vitest';

import {
  createKeyboardChord,
  createVerbRecord,
  DEFAULT_INPUT_BINDINGS,
  describeGamepadButtonIndex,
  describeGamepadStickIndexes,
  describeInputChord,
  describeKeyboardCode,
  INPUT_BINDINGS_STORAGE_KEY,
  parsePhaserInputBindings,
  readStoredPhaserInputBindings,
  resolveInputFrame,
  writeStoredPhaserInputBindings,
  type PhaserInputTerm,
} from './bindings';

function createTestStorage(seed: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(seed));
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as Storage;
}

describe('phaser input bindings', () => {
  it('round-trips persisted bindings', () => {
    const storage = createTestStorage();
    const bindings = {
      ...DEFAULT_INPUT_BINDINGS,
      firePrimary: [createKeyboardChord(81)],
    };

    writeStoredPhaserInputBindings(bindings, storage);

    expect(readStoredPhaserInputBindings(storage).firePrimary).toEqual([
      [{ code: 81, source: 'keyboard' }],
    ]);
    expect(storage.getItem(INPUT_BINDINGS_STORAGE_KEY)).toContain('"firePrimary"');
  });

  it('falls back to defaults when stored bindings are invalid', () => {
    const storage = createTestStorage({ [INPUT_BINDINGS_STORAGE_KEY]: '{"up":[{"nope":true}]}' });

    expect(readStoredPhaserInputBindings(storage).up).toEqual(DEFAULT_INPUT_BINDINGS.up);
  });

  it('describes keyboard and mouse chords', () => {
    expect(describeKeyboardCode(81)).toBe('Q');
    expect(describeKeyboardCode(49)).toBe('1');
    expect(describeKeyboardCode(38)).toBe('Arrow Up');
    expect(describeKeyboardCode(112)).toBe('F1');
    expect(
      describeInputChord([
        { code: 32, source: 'keyboard' },
        { button: 'left', source: 'mouseButton' },
      ]),
    ).toBe('Space + Left mouse');
  });

  it('describes standard gamepad buttons and stick axes', () => {
    expect(describeGamepadButtonIndex(4)).toBe('L1');
    expect(describeGamepadButtonIndex(12)).toBe('D-pad up');
    expect(describeGamepadButtonIndex(99)).toBe('button 99');
    expect(describeGamepadStickIndexes([[2, 3]])).toBe('axes 2, 3');
  });

  it('resolves held, just pressed, just released, and chord states', () => {
    const bindings = parsePhaserInputBindings(
      JSON.stringify({
        ...DEFAULT_INPUT_BINDINGS,
        firePrimary: [
          [
            { code: 32, source: 'keyboard' },
            { button: 'left', source: 'mouseButton' },
          ],
        ],
        shield: [[{ code: 70, source: 'keyboard' }]],
      }),
    );
    const previousPressed = createVerbRecord(false);
    previousPressed.shield = true;
    const activeTerms = new Set(['keyboard:32', 'mouseButton:left']);

    const frame = resolveInputFrame({
      bindings,
      previousPressed,
      readTermValue: (term) => (activeTerms.has(getTermKey(term)) ? 1 : 0),
    });

    expect(frame.pressed.firePrimary).toBe(true);
    expect(frame.justPressed.firePrimary).toBe(true);
    expect(frame.pressed.shield).toBe(false);
    expect(frame.justReleased.shield).toBe(true);
  });
});

function getTermKey(term: PhaserInputTerm): string {
  if (term.source === 'keyboard') return `keyboard:${term.code}`;
  if (term.source === 'mouseButton') return `mouseButton:${term.button}`;
  if (term.source === 'gamepadButton') return `gamepadButton:${term.name}`;
  return `gamepadStickDirection:${term.name}:${term.axis}:${term.direction}`;
}
