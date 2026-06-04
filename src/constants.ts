import { QueryModule } from 'joymap';

/**
 * @deprecated Legacy canvas-scene constants. New Phaser code must use modules under src/phaser.
 */

import type { SceneEntity } from './scenes/entities';
import { gameState } from './state';
import { createWeaponIconSprites } from './weaponIconSprites';

export interface AlphaMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Collidable extends Partial<SceneEntity> {
  x: number;
  y: number;
  mask: AlphaMask;
  getRadius: () => number;
}

export interface Player extends Collidable {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  turretAngle: number;
  lives: number;
  score: number;
  color: string;
  invulnerable: boolean;
  invulnerableUntil: number;
  respawnTime: number;
  waitingToRespawn: boolean;
  respawnCount: number;
  shieldHits: number;
  shieldActive: boolean;
  shieldHitUntil: number;
  fuel: number;
  maxFuel: number;
  inspectionProbes: number;
  primaryWeapon: SelectableWeaponType;
  secondaryWeapon: SelectableWeaponType;
  module: QueryModule;
  timeoutSmall: number;
  timeoutBlackHole: number;
  timeoutPusher: number;
  timeoutShotgun: number;
  lastThrusterSpawn: number;
  isThrusting: boolean;
  thrustDirX: number;
  thrustDirY: number;
}

export interface Asteroid extends Collidable {
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: 'mega' | 'big' | 'medium' | 'small';
  color: string;
  hits: number;
  splitCount: number;
  mass: number;
}

export interface Planet extends Partial<SceneEntity> {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: PlanetKind;
  color: string;
  altitudeVariations: number[];
  rotation: number;
  rotationSpeed: number;
  fuelReserve: number;
  fuelExtractors: FuelExtractor[];
  inspectedUntil: number;
  getRadius: () => number;
  mask: AlphaMask | null;
}

export interface FuelBlob {
  id: string;
  localOffsetX: number;
  localOffsetY: number;
  wobbleSeed: number;
}

export interface FuelExtractor {
  id: string;
  anchorAngle: number;
  extractIntervalMs: number;
  nextExtractAt: number;
  maxBlobs: number;
  blobs: FuelBlob[];
}

export type WeaponType = 'small' | 'blackHole' | 'pusher' | 'shotgun' | 'fuelGun' | 'tractor';
export type SelectableWeaponType = WeaponType | 'inspectionProbe';

export interface Bullet extends Partial<SceneEntity> {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  angle: number;
  lifetime: number;
  spawnTime: number;
  playerId: string;
  damage: number;
  impact: number;
  recoil: number;
  type: WeaponType;
  absorbedFuelBlobs?: number;
  collapseStartTime?: number;
  collapseDuration?: number;
}

export interface Particle extends Partial<SceneEntity> {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  color2?: string;
  glowColor: string;
  shape: 'spark' | 'shard' | 'smoke' | 'panel' | 'wing' | 'core' | 'shockwave';
  lifetime: number;
  maxLifetime: number;
}

export interface ThrusterParticle extends Partial<SceneEntity> {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  glowColor: string;
  lifetime: number;
  maxLifetime: number;
  scale: number;
}

export interface ScreenShake {
  intensity: number;
  duration: number;
  startTime: number;
}

export const SIZE = {
  width: window.innerWidth,
  height: window.innerHeight,
  centerX: window.innerWidth * 0.5,
  centerY: window.innerHeight * 0.5,
};

window.addEventListener('resize', () => {
  if (gameState.gameSize) {
    if (
      window.innerWidth !== gameState.gameSize.width ||
      window.innerHeight !== gameState.gameSize.height
    ) {
      gameState.needsResize = true;
    }
  }
});

export const PLAYER_ACCELERATION = 0.1;
export const PLAYER_MAX_SPEED = 25;
export const PLAYER_SIZE = 30;
export const INVULNERABILITY_DURATION = 3000;
export const BLINK_INTERVAL = 100;
export const RESPAWN_DELAY = 2000;
export const RESTART_COOLDOWN = 1000;
export const STARTING_LIVES = 3;
export const SHIELD_MAX_HITS = 3;
export const SHIELD_HIT_COOLDOWN = 50;
export const SHIELD_RADIUS = PLAYER_SIZE * 1.5;
export const SHIELD_COLOR = 'rgba(100, 200, 255, 0.6)';
export const PLAYER_MAX_FUEL = 100;
export const LOW_FUEL_RATIO = 0.1;
export const FUEL_THRUST_PER_SECOND = 5;
export const FUELLESS_THRUST_POWER_SCALE = 1 / 3;
export const TIME_DILATION_SCALE = 0.1;

export const FUEL_WEAPON_COSTS = {
  small: 0.75,
  pusher: 0.2,
  shotgun: 3,
  blackHole: 12,
  fuelGun: 5,
  tractor: 0.08,
} as const;

export const SHIELD_COLLISION_FUEL_COSTS = {
  small: 4,
  medium: 8,
  big: 14,
  mega: 22,
} as const;

export const TRACTOR_BEAM_RANGE = 360;
export const TRACTOR_BEAM_LOCK_DISTANCE = 120;
export const TRACTOR_BEAM_PULL = 0.42;
export const TRACTOR_BEAM_MAX_TARGET_SPEED = 9;

export const SHIP_INTERIOR_REFUEL_STATION_RADIUS = 120;
export const SHIP_INTERIOR_REFUEL_PER_SECOND = 18;

export const FUEL_BLOB_AMOUNT = 5;
export const FUEL_BLOB_RADIUS = 10;
export const PLANET_FUEL_EXTRACT_INTERVAL_MS = 2000;
export const PLANET_FUEL_EXTRACTOR_MAX_BLOBS = 8;
export const PLANET_MIN_ROTATION_SPEED = 0.00002;
export const PLANET_MAX_ROTATION_SPEED = 0.00008;
export const PLANET_MIN_FUEL_RESERVE = 1500;
export const PLANET_MAX_FUEL_RESERVE = 3000;
export const PLANET_NEAR_EMPTY_FUEL_RESERVE = 50;

export const ASTEROID_FUEL_DROP_CHANCES = {
  medium: 0.4,
  big: 0.7,
  mega: 1,
} as const;

export const ASTEROID_FUEL_DROP_MAX_BLOBS = {
  medium: 1,
  big: 1,
  mega: 3,
} as const;

export const FUEL_BLOB_ATTRACTION_RADIUS = 260;
export const FUEL_BLOB_ATTRACTION_ACCELERATION = 0.035;
export const FUEL_BLOB_MAX_SPEED = 5.5;
export const FUEL_BLOB_DRAG = 0.985;

export const STARTING_INSPECTION_PROBES = 3;
export const INSPECTION_PROBE_DURATION_MS = 15000;
export const INSPECTION_PROBE_SPEED = 18;
export const INSPECTION_PROBE_LIFETIME_MS = 1500;
export const INSPECTION_PROBE_RADIUS = 5;
export const FUEL_INSPECTION_BLOB_AMOUNT = FUEL_BLOB_AMOUNT * 10;

export const BLACK_HOLE_RADIUS = 6;
export const BLACK_HOLE_MATURE_AFTER_MS = 3000;
export const BLACK_HOLE_MATURE_RADIUS = 25;
export const BLACK_HOLE_GRAVITY_STRENGTH = 1.5;
export const DISTORTION_RADIUS = 200;
export const DISTORTION_STRENGTH = 0.8;
export const MAX_BLACK_HOLES = 10;

export const BULLET_CONFIGS = {
  small: {
    iconSprites: createWeaponIconSprites('small'),
    speed: 15,
    lifetime: 500,
    damage: 2,
    impact: 0.2,
    recoil: 0.5,
    fireRate: 200,
    bulletCount: 1,
    spreadAngle: 0,
    speedVariance: 0,
  },
  blackHole: {
    iconSprites: createWeaponIconSprites('blackHole'),
    speed: 1,
    lifetime: 10000,
    damage: 400,
    impact: 0.5,
    recoil: 4,
    fireRate: 2000,
    bulletCount: 1,
    spreadAngle: 0,
    speedVariance: 0,
  },
  pusher: {
    iconSprites: createWeaponIconSprites('pusher'),
    speed: 8,
    lifetime: 1000,
    damage: 0.2,
    impact: 0.5,
    recoil: 0.1,
    fireRate: 40,
    bulletCount: 1,
    spreadAngle: 0,
    speedVariance: 0,
  },
  shotgun: {
    iconSprites: createWeaponIconSprites('shotgun'),
    speed: 12,
    lifetime: 250,
    damage: 1,
    impact: 0.02,
    recoil: 2,
    fireRate: 600,
    bulletCount: 12,
    spreadAngle: Math.PI / 4,
    speedVariance: 0.3,
  },
  fuelGun: {
    iconSprites: createWeaponIconSprites('fuelGun'),
    speed: 16,
    lifetime: 0,
    damage: 0,
    impact: 0,
    recoil: 0.45,
    fireRate: 360,
    bulletCount: 1,
    spreadAngle: 0,
    speedVariance: 0,
  },
  tractor: {
    iconSprites: createWeaponIconSprites('tractor'),
    speed: 0,
    lifetime: 0,
    damage: 0,
    impact: 0,
    recoil: 0,
    fireRate: 0,
    bulletCount: 0,
    spreadAngle: 0,
    speedVariance: 0,
  },
} as const;

export const INSPECTION_PROBE_WEAPON_CONFIG = {
  iconSprites: createWeaponIconSprites('inspectionProbe'),
} as const;

export function getWeaponIconSprite(
  weapon: SelectableWeaponType,
  selected: boolean,
): HTMLCanvasElement {
  const iconSprites =
    weapon === 'inspectionProbe'
      ? INSPECTION_PROBE_WEAPON_CONFIG.iconSprites
      : BULLET_CONFIGS[weapon].iconSprites;
  return selected ? iconSprites.selected : iconSprites.normal;
}

export const ASTEROID_CONFIGS = {
  mega: {
    radius: 100,
    points: 10,
    speed: 0.5,
    childSize: 'big' as const,
    hits: 30,
    splitCount: 3,
    mass: 10,
    colors: ['#ff6b6b', '#ff69b4'],
  },
  big: {
    radius: 70,
    points: 20,
    speed: 1.0,
    childSize: 'medium' as const,
    hits: 10,
    splitCount: 2,
    mass: 5,
    colors: ['#ffd93d', '#ff8800'],
  },
  medium: {
    radius: 45,
    points: 50,
    speed: 2.0,
    childSize: 'small' as const,
    hits: 3,
    splitCount: 2,
    mass: 2,
    colors: ['#6bcb77', '#40e0d0'],
  },
  small: {
    radius: 25,
    points: 100,
    speed: 3.5,
    childSize: null,
    hits: 1,
    splitCount: 0,
    mass: 1,
    colors: ['#4d96ff', '#9b59b6'],
  },
} as const;

export const PARTICLE_COUNT = 20;
export const PARTICLE_LIFETIME = 1000;
export const SCREEN_SHAKE_DURATION = 250;

export const PLAYER_COLORS = ['#debbad', '#debade', '#badbde', '#baded6', '#d6bade'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export type AsteroidColor = string;

export const THRUSTER_PARTICLE_LIFETIME = 700;
export const THRUSTER_PARTICLE_SPAWN_INTERVAL = 10;
export const THRUSTER_COLORS = ['#fff93d', '#ff3f05'] as const;

export const GRID_COLOR = 'rgba(255, 255, 255, 0.03)';
export const GRID_SPACING = 100;
export const STAR_COUNT = 150;
export const STAR_MIN_SIZE = 1;
export const STAR_MAX_SIZE = 3;
export const STAR_BASE_ALPHA = 0.3;
export const STAR_TWINKLE_AMOUNT = 0.4;
export const BACKGROUND_SPEED = 0.3;
export const DRIFT_CHANGE_MIN = 10000;
export const DRIFT_CHANGE_MAX = 30000;

export interface Star {
  x: number;
  y: number;
  size: number;
  twinklePhase: number;
  twinkleSpeed: number;
  parallaxLayer: number;
}

export const PLANET_CONFIG = {
  lush: {
    radius: 250,
    gravityStrength: 0.5,
    fuelReserveRange: { min: PLANET_MIN_FUEL_RESERVE, max: PLANET_MAX_FUEL_RESERVE },
    palette: ['#2ecc71', '#27ae60', '#58d68d'],
  },
  desert: {
    radius: 250,
    gravityStrength: 0.5,
    fuelReserveRange: { min: 0, max: 0 },
    palette: ['#f39c12', '#d68910', '#e67e22'],
  },
  ice: {
    radius: 250,
    gravityStrength: 0.5,
    fuelReserveRange: { min: 0, max: PLANET_NEAR_EMPTY_FUEL_RESERVE },
    palette: ['#8bd3ff', '#5dade2', '#d6f6ff'],
  },
  lava: {
    radius: 450,
    gravityStrength: 0.5,
    fuelReserveRange: { min: 0, max: PLANET_NEAR_EMPTY_FUEL_RESERVE },
    palette: ['#e74c3c', '#ff6b35', '#c0392b'],
  },
  gas: {
    radius: 700,
    gravityStrength: 0.5,
    fuelReserveRange: { min: 0, max: PLANET_NEAR_EMPTY_FUEL_RESERVE },
    palette: ['#9b59b6', '#8e44ad', '#c39bd3'],
  },
  toxic: {
    radius: 350,
    gravityStrength: 0.5,
    fuelReserveRange: { min: 0, max: PLANET_NEAR_EMPTY_FUEL_RESERVE },
    palette: ['#1abc9c', '#16a085', '#7bed9f'],
  },
  crystal: {
    radius: 300,
    gravityStrength: 1,
    fuelReserveRange: { min: 0, max: PLANET_NEAR_EMPTY_FUEL_RESERVE },
    palette: ['#8ef6ff', '#7bc7ff', '#d6f7ff'],
  },
};

export type PlanetKind = keyof typeof PLANET_CONFIG;
