import { ShipState } from '../player/shipState';

export class MainGameState {
  readonly ship = new ShipState();
}

export const mainGameState = new MainGameState();
