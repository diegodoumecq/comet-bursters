import { TIME_DILATION_SCALE, type Player } from '@/constants';
import { InputManager } from '@/input';
import type { InputState } from '@/input/types';
import { applyWeaponSelectionInput } from './weaponSelection';

type TimeDilationStep = {
  input: InputState;
  deltaScale: number;
  scaledDeltaTime: number;
  now: number;
};

export function getPlayerTimeDilationStep(
  currentPlayer: Player,
  screenPlayerX: number,
  screenPlayerY: number,
  deltaTime: number,
  simulationTime: number,
): TimeDilationStep {
  const input = InputManager.getInputState(currentPlayer.module, screenPlayerX, screenPlayerY);
  applyWeaponSelectionInput(currentPlayer, input);
  const deltaScale = input.timeDilation.pressed ? TIME_DILATION_SCALE : 1;
  const scaledDeltaTime = deltaTime * deltaScale;

  return {
    input,
    deltaScale,
    scaledDeltaTime,
    now: simulationTime + scaledDeltaTime,
  };
}
