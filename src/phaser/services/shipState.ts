import type { WeaponKind } from '../model';
import { MAX_FUEL, addFuel } from './fuel';

export class ShipState {
  primaryWeapon: WeaponKind = 'small';
  secondaryWeapon: WeaponKind = 'pusher';
  fuel = MAX_FUEL;

  assignWeapon(slot: 'primary' | 'secondary', weapon: WeaponKind): void {
    if (slot === 'primary') this.primaryWeapon = weapon;
    else this.secondaryWeapon = weapon;
  }

  setFuel(fuel: number): void {
    this.fuel = fuel;
  }

  collectFuel(amount: number): void {
    this.fuel = addFuel(this.fuel, amount);
  }

  resetFuel(): void {
    this.fuel = MAX_FUEL;
  }
}
