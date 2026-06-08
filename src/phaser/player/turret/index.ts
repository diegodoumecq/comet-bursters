import type { WeaponKind } from '../../weapons/types';
import { drawBlackHoleTurret } from './blackHole';
import { drawFuelGunTurret } from './fuelGun';
import { drawInspectionProbeTurret } from './inspectionProbe';
import { drawPusherTurret } from './pusher';
import { drawShotgunTurret } from './shotgun';
import { drawSmallTurret } from './small';
import { drawTractorTurret } from './tractor';
import type { TurretSpriteDrawer } from './types';

export type { TurretSpriteDrawer, TurretSpriteMetrics } from './types';

export const TURRET_SPRITE_DRAWERS: Record<WeaponKind, TurretSpriteDrawer> = {
  blackHole: drawBlackHoleTurret,
  fuelGun: drawFuelGunTurret,
  inspectionProbe: drawInspectionProbeTurret,
  pusher: drawPusherTurret,
  shotgun: drawShotgunTurret,
  small: drawSmallTurret,
  tractor: drawTractorTurret,
};
