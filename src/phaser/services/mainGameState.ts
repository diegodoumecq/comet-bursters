import { ShipState } from './shipState';

export class MainGameState {
  readonly ship = new ShipState();
}

export const mainGameState = new MainGameState();
