import { useEffect, useMemo, useState } from 'react';

import {
  createKeyboardChord,
  createMouseButtonChord,
  DEFAULT_GAMEPAD_CONFIG,
  describeGamepadButtonIndex,
  describeGamepadStickIndexes,
  describeInputChord,
  GAMEPAD_STICK_LABELS,
  getMouseButtonName,
  PHASER_INPUT_VERB_LABELS,
  readStoredGamepadConfig,
  readStoredPhaserInputBindings,
  resetStoredPhaserInput,
  writeStoredGamepadConfig,
  writeStoredPhaserInputBindings,
  type GamepadStickName,
  type PhaserInputChord,
  type PhaserInputVerb,
  type StoredGamepadConfig,
} from './phaser/input/bindings';

const REMAPPABLE_VERBS: PhaserInputVerb[] = [
  'up',
  'down',
  'left',
  'right',
  'firePrimary',
  'fireSecondary',
  'shield',
  'timeDilation',
];

type CaptureTarget =
  | {
      source: 'keyboardMouse';
      verb: PhaserInputVerb;
    }
  | {
      source: 'gamepad';
      verb: PhaserInputVerb;
    }
  | {
      source: 'gamepadStick';
      stick: GamepadStickName;
    };

export function InputRemappingPanel() {
  const [bindings, setBindings] = useState(readStoredPhaserInputBindings);
  const [gamepadConfig, setGamepadConfig] = useState(readStoredGamepadConfig);
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
  const [captureMessage, setCaptureMessage] = useState('');

  useEffect(() => {
    if (captureTarget?.source !== 'gamepad' && captureTarget?.source !== 'gamepadStick') return;

    let cancelled = false;
    let frame = 0;
    const baseline = readGamepadSnapshot();

    const poll = () => {
      if (cancelled) return;
      if (captureTarget.source === 'gamepad') {
        const pressed = findNewGamepadButtonPress(baseline.buttons);
        if (pressed !== null) {
          updateGamepadButton(captureTarget.verb, pressed);
          setCaptureTarget(null);
          setCaptureMessage(
            `Mapped ${PHASER_INPUT_VERB_LABELS[captureTarget.verb]} to ${describeGamepadButtonIndex(pressed)}`,
          );
          return;
        }
      } else {
        const stickIndexes = findNewGamepadStickAxes(baseline.axes);
        if (stickIndexes !== null) {
          updateGamepadStick(captureTarget.stick, stickIndexes);
          setCaptureTarget(null);
          setCaptureMessage(`Mapped ${GAMEPAD_STICK_LABELS[captureTarget.stick]}`);
          return;
        }
      }
      frame = window.requestAnimationFrame(poll);
    };

    frame = window.requestAnimationFrame(poll);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [captureTarget]);

  const visibleBindings = useMemo(
    () =>
      REMAPPABLE_VERBS.map((verb) => ({
        bindings: bindings[verb].filter((chord) =>
          chord.every((term) => term.source === 'keyboard' || term.source === 'mouseButton'),
        ),
        verb,
      })),
    [bindings],
  );
  const duplicateCallouts = useMemo(
    () => buildDuplicateCallouts(bindings, gamepadConfig),
    [bindings, gamepadConfig],
  );

  function addChord(verb: PhaserInputVerb, chord: PhaserInputChord): void {
    const next = {
      ...bindings,
      [verb]: [...bindings[verb], chord],
    };
    setBindings(next);
    writeStoredPhaserInputBindings(next);
  }

  function removeChord(verb: PhaserInputVerb, index: number): void {
    const nextVerbBindings = bindings[verb].filter((_, bindingIndex) => bindingIndex !== index);
    const next = {
      ...bindings,
      [verb]: nextVerbBindings,
    };
    setBindings(next);
    writeStoredPhaserInputBindings(next);
  }

  function updateGamepadButton(verb: PhaserInputVerb, buttonIndex: number): void {
    const gamepadChord: PhaserInputChord = [{ name: verb, source: 'gamepadButton' }];
    const hasGamepadChord = bindings[verb].some((chord) =>
      chord.some((term) => term.source === 'gamepadButton' && term.name === verb),
    );
    const nextBindings = hasGamepadChord
      ? bindings
      : {
          ...bindings,
          [verb]: [...bindings[verb], gamepadChord],
        };
    const next: StoredGamepadConfig = {
      ...gamepadConfig,
      buttons: {
        ...gamepadConfig.buttons,
        [verb]: [buttonIndex],
      },
    };
    setBindings(nextBindings);
    setGamepadConfig(next);
    writeStoredPhaserInputBindings(nextBindings);
    writeStoredGamepadConfig(next);
  }

  function updateGamepadStick(stick: GamepadStickName, indexes: number[]): void {
    const next: StoredGamepadConfig = {
      ...gamepadConfig,
      sticks: {
        ...gamepadConfig.sticks,
        [stick]: {
          indexes: [indexes],
          inverts: indexes.map(() => false),
        },
      },
    };
    setGamepadConfig(next);
    writeStoredGamepadConfig(next);
  }

  function resetControls(): void {
    resetStoredPhaserInput();
    const nextBindings = readStoredPhaserInputBindings();
    const nextGamepadConfig = readStoredGamepadConfig();
    setBindings(nextBindings);
    setGamepadConfig(nextGamepadConfig);
    setCaptureTarget(null);
    setCaptureMessage('Controls reset');
  }

  function handleKeyboardCapture(event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (captureTarget?.source !== 'keyboardMouse') return;
    event.preventDefault();
    event.stopPropagation();
    addChord(captureTarget.verb, createKeyboardChord(event.keyCode));
    setCaptureMessage(`Added ${event.key}`);
    setCaptureTarget(null);
  }

  function handleMouseCapture(event: React.MouseEvent<HTMLButtonElement>): void {
    if (captureTarget?.source !== 'keyboardMouse') return;
    const button = getMouseButtonName(event.button);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    addChord(captureTarget.verb, createMouseButtonChord(button));
    setCaptureMessage(`Added ${button} mouse`);
    setCaptureTarget(null);
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="grid gap-3">
        {visibleBindings.map(({ bindings: verbBindings, verb }) => (
          <div
            className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-[9rem_1fr]"
            key={verb}
          >
            <div className="text-sm font-semibold text-slate-100">
              {PHASER_INPUT_VERB_LABELS[verb]}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {verbBindings.map((chord, index) => (
                  <button
                    className="inline-flex min-h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-rose-400/70 hover:text-rose-100"
                    key={`${verb}-${index}-${describeInputChord(chord)}`}
                    type="button"
                    onClick={() => removeChord(verb, index)}
                  >
                    <span>{describeInputChord(chord)}</span>
                    <DuplicateNote
                      label={getSharedBindingLabel(
                        duplicateCallouts.chords.get(getChordKey(chord)),
                        PHASER_INPUT_VERB_LABELS[verb],
                      )}
                    />
                  </button>
                ))}
                <span className="inline-flex min-h-8 items-center rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-400">
                  <span>Gamepad {formatGamepadButton(gamepadConfig, verb)}</span>
                  <DuplicateNote
                    label={getSharedBindingLabel(
                      duplicateCallouts.gamepadButtons.get(verb),
                      PHASER_INPUT_VERB_LABELS[verb],
                    )}
                  />
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-8 items-center rounded-md border border-cyan-700/60 bg-cyan-950/40 px-2.5 py-1 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300"
                  type="button"
                  onClick={() => {
                    setCaptureTarget({ source: 'keyboardMouse', verb });
                    setCaptureMessage('Press a key or mouse button');
                  }}
                  onKeyDown={handleKeyboardCapture}
                  onMouseDown={handleMouseCapture}
                >
                  Add key/mouse
                </button>
                <button
                  className="inline-flex min-h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-300"
                  type="button"
                  onClick={() => {
                    setCaptureTarget({ source: 'gamepad', verb });
                    setCaptureMessage('Press a gamepad button');
                  }}
                >
                  Set gamepad
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <div className="text-sm font-semibold text-slate-100">Analog sticks</div>
        <div className="grid gap-3 md:grid-cols-2">
          {(['move', 'aim'] as const).map((stick) => (
            <div className="flex flex-wrap items-center gap-2" key={stick}>
              <span className="inline-flex min-h-8 items-center rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300">
                <span>
                  {GAMEPAD_STICK_LABELS[stick]}: {formatGamepadStick(gamepadConfig, stick)}
                </span>
                <DuplicateNote
                  label={getSharedBindingLabel(
                    duplicateCallouts.gamepadSticks.get(stick),
                    GAMEPAD_STICK_LABELS[stick],
                  )}
                />
              </span>
              <button
                className="inline-flex min-h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-300"
                type="button"
                onClick={() => {
                  setCaptureTarget({ source: 'gamepadStick', stick });
                  setCaptureMessage('Move a gamepad stick');
                }}
              >
                Set stick
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5 text-sm text-slate-400">
          {captureTarget ? captureMessage : captureMessage}
        </div>
        <button
          className="inline-flex min-h-9 items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:border-rose-300"
          type="button"
          onClick={resetControls}
        >
          Reset controls
        </button>
      </div>
    </div>
  );
}

function DuplicateNote({ label }: { label: string | null }) {
  if (!label) return null;

  return (
    <span className="ml-2 rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">
      Shared with {label}
    </span>
  );
}

function buildDuplicateCallouts(
  bindings: ReturnType<typeof readStoredPhaserInputBindings>,
  gamepadConfig: StoredGamepadConfig,
): {
  chords: Map<string, string[]>;
  gamepadButtons: Map<PhaserInputVerb, string[]>;
  gamepadSticks: Map<GamepadStickName, string[]>;
} {
  const ownersByBinding = new Map<string, string[]>();
  for (const verb of REMAPPABLE_VERBS) {
    const owner = PHASER_INPUT_VERB_LABELS[verb];
    for (const chord of bindings[verb]) {
      if (chord.every((term) => term.source === 'keyboard' || term.source === 'mouseButton')) {
        addBindingOwner(ownersByBinding, `chord:${getChordKey(chord)}`, owner);
      }
    }

    const buttonIndex = gamepadConfig.buttons[verb]?.[0];
    if (typeof buttonIndex === 'number') {
      addBindingOwner(ownersByBinding, `gamepadButton:${buttonIndex}`, owner);
    }
  }

  for (const stick of ['move', 'aim'] as const) {
    const key = getStickKey(gamepadConfig.sticks[stick]?.indexes);
    if (key) {
      addBindingOwner(ownersByBinding, `gamepadStick:${key}`, GAMEPAD_STICK_LABELS[stick]);
    }
  }

  const chords = new Map<string, string[]>();
  const gamepadButtons = new Map<PhaserInputVerb, string[]>();
  const gamepadSticks = new Map<GamepadStickName, string[]>();
  for (const verb of REMAPPABLE_VERBS) {
    for (const chord of bindings[verb]) {
      const key = getChordKey(chord);
      const owners = ownersByBinding.get(`chord:${key}`);
      if (owners && owners.length > 1) {
        chords.set(key, owners);
      }
    }

    const buttonIndex = gamepadConfig.buttons[verb]?.[0];
    const owners =
      typeof buttonIndex === 'number'
        ? ownersByBinding.get(`gamepadButton:${buttonIndex}`)
        : undefined;
    if (owners && owners.length > 1) {
      gamepadButtons.set(verb, owners);
    }
  }

  for (const stick of ['move', 'aim'] as const) {
    const key = getStickKey(gamepadConfig.sticks[stick]?.indexes);
    const owners = key ? ownersByBinding.get(`gamepadStick:${key}`) : undefined;
    if (owners && owners.length > 1) {
      gamepadSticks.set(stick, owners);
    }
  }

  return { chords, gamepadButtons, gamepadSticks };
}

function addBindingOwner(ownersByBinding: Map<string, string[]>, key: string, owner: string): void {
  const owners = ownersByBinding.get(key) ?? [];
  if (!owners.includes(owner)) {
    owners.push(owner);
  }
  ownersByBinding.set(key, owners);
}

function getSharedBindingLabel(owners: string[] | undefined, currentOwner: string): string | null {
  const sharedOwners = owners?.filter((owner) => owner !== currentOwner) ?? [];
  return sharedOwners.length > 0 ? sharedOwners.join(', ') : null;
}

function getChordKey(chord: PhaserInputChord): string {
  return chord.map(getTermKey).sort().join('+');
}

function getTermKey(term: PhaserInputChord[number]): string {
  if (term.source === 'keyboard') return `keyboard:${term.code}`;
  if (term.source === 'mouseButton') return `mouse:${term.button}`;
  if (term.source === 'gamepadButton') return `gamepadButton:${term.name}`;
  return `gamepadStick:${term.name}:${term.axis}:${term.direction}`;
}

function getStickKey(indexes: number[][] | undefined): string | null {
  const first = indexes?.[0];
  return first && first.length > 0 ? first.join(',') : null;
}

function formatGamepadButton(config: StoredGamepadConfig, verb: PhaserInputVerb): string {
  const index = config.buttons[verb]?.[0] ?? DEFAULT_GAMEPAD_CONFIG.buttons[verb]?.[0];
  return typeof index === 'number' ? describeGamepadButtonIndex(index) : 'unmapped';
}

function formatGamepadStick(config: StoredGamepadConfig, stick: GamepadStickName): string {
  return describeGamepadStickIndexes(
    config.sticks[stick]?.indexes ?? DEFAULT_GAMEPAD_CONFIG.sticks[stick]?.indexes,
  );
}

function readGamepadSnapshot(): { axes: number[]; buttons: number[] } {
  const pad = navigator.getGamepads?.().find((gamepad) => gamepad?.connected) ?? null;
  return pad
    ? {
        axes: [...pad.axes],
        buttons: pad.buttons.map((button) => button.value),
      }
    : { axes: [], buttons: [] };
}

function findNewGamepadButtonPress(baseline: number[]): number | null {
  const pad = navigator.getGamepads?.().find((gamepad) => gamepad?.connected) ?? null;
  if (!pad) return null;

  for (let index = 0; index < pad.buttons.length; index += 1) {
    const previous = baseline[index] ?? 0;
    const current = pad.buttons[index].value;
    if (previous <= 0.2 && current > 0.2) return index;
  }
  return null;
}

function findNewGamepadStickAxes(baseline: number[]): number[] | null {
  const pad = navigator.getGamepads?.().find((gamepad) => gamepad?.connected) ?? null;
  if (!pad) return null;

  for (let index = 0; index < pad.axes.length; index += 1) {
    const previous = Math.abs(baseline[index] ?? 0);
    const current = Math.abs(pad.axes[index] ?? 0);
    if (previous <= 0.2 && current > 0.55) {
      const firstAxis = index % 2 === 0 ? index : index - 1;
      const secondAxis = firstAxis + 1;
      if (secondAxis < pad.axes.length) return [firstAxis, secondAxis];
    }
  }
  return null;
}
