export interface InputResult {
  type: 'button' | 'stick';
  value: number | number[];
  pressed: boolean;
  justChanged: boolean;
}

export interface StickResult extends InputResult {
  type: 'stick';
  value: [number, number];
  inverts: [boolean, boolean];
}

export interface ButtonResult extends InputResult {
  type: 'button';
  value: number;
}

export interface InputState {
  move: StickResult;
  aim: StickResult;
  fire: ButtonResult;
  fireSpecial: ButtonResult;
  fireReallyHard: ButtonResult;
  chaosFire: ButtonResult;
  shield: ButtonResult;
}

export const emptyStick: StickResult = {
  type: 'stick',
  value: [0, 0],
  pressed: false,
  justChanged: false,
  inverts: [false, false],
};

export const emptyButton: ButtonResult = {
  type: 'button',
  value: 0,
  pressed: false,
  justChanged: false,
};
