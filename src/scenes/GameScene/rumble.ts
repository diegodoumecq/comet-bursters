import type { QueryModule } from 'joymap';

export function rumbleEngine(module: QueryModule, intensity: number) {
  module.addRumble(
    {
      duration: 100,
      strongMagnitude: 0,
      weakMagnitude: 0.15 * intensity,
    },
    'engine',
  );
}

export function rumbleQuickFire(module: QueryModule) {
  module.addRumble({ duration: 50, strongMagnitude: 0, weakMagnitude: 0.3 }, 'quickfire');
}

export function rumbleChaosFire(module: QueryModule) {
  module.addRumble(
    [
      { duration: 30, strongMagnitude: 0.1, weakMagnitude: 1 },
      30,
      { duration: 50, strongMagnitude: 0.5, weakMagnitude: 0.3 },
    ],
    'chaosFire',
  );
}

export function rumbleSpinningFire(module: QueryModule) {
  module.addRumble({ duration: 50, strongMagnitude: 0, weakMagnitude: 0.6 }, 'spinningFire');
}

export function rumbleBigBoom(module: QueryModule) {
  module.addRumble({ duration: 200, strongMagnitude: 1, weakMagnitude: 1 }, 'bigBoom');
}

export function rumbleDeath(module: QueryModule) {
  module.addRumble({ duration: 500, strongMagnitude: 1, weakMagnitude: 1 }, 'death');
}

export function rumbleExplosion(module: QueryModule, intensity: number) {
  const magnitude = Math.min(1, intensity);
  module.addRumble(
    {
      duration: Math.floor(150 * intensity),
      strongMagnitude: magnitude,
      weakMagnitude: magnitude,
    },
    'explosion',
  );
}
