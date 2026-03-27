import { QueryModule } from 'joymap';

import { gameState } from './state';

export interface AlphaMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Collidable {
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
  shieldHits: number;
  shieldActive: boolean;
  shieldHitUntil: number;
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

export interface Planet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  altitudeVariations: number[];
  rotation: number;
  getRadius: () => number;
  mask: AlphaMask | null;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  lifetime: number;
  spawnTime: number;
  playerId: string;
  damage: number;
  impact: number;
  recoil: number;
  type: 'small' | 'blackHole' | 'pusher' | 'shotgun';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  sprite: HTMLCanvasElement;
  lifetime: number;
  maxLifetime: number;
}

export interface ThrusterParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  sprite: HTMLCanvasElement;
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

export const BLACK_HOLE_RADIUS = 6;
export const DISTORTION_RADIUS = 200;
export const DISTORTION_STRENGTH = 0.8;
export const MAX_BLACK_HOLES = 10;

export const COLOR_GRADE_PRESETS = {
  none: {
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    saturation: 1.0,
    contrast: 1.0,
    brightness: 0.0,
  },
  cinematic: {
    lift: [-0.03, -0.02, 0.0],
    gamma: [1.1, 1.05, 0.95],
    gain: [1.05, 1.02, 1.08],
    saturation: 0.9,
    contrast: 1.1,
    brightness: -0.02,
  },
  vibrant: {
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1.1, 1.1, 1.1],
    saturation: 1.3,
    contrast: 1.1,
    brightness: 0.05,
  },
  muted: {
    lift: [0.02, 0.02, 0.03],
    gamma: [1.1, 1.1, 1.1],
    gain: [0.95, 0.95, 0.95],
    saturation: 0.6,
    contrast: 0.95,
    brightness: -0.05,
  },
  warm: {
    lift: [0, -0.02, -0.05],
    gamma: [1, 0.95, 0.9],
    gain: [1.1, 1.05, 0.95],
    saturation: 1.15,
    contrast: 1.05,
    brightness: 0.02,
  },
  cool: {
    lift: [0, 0, 0.02],
    gamma: [0.95, 0.95, 1.05],
    gain: [0.95, 1.0, 1.1],
    saturation: 1.1,
    contrast: 1.05,
    brightness: 0,
  },
  neon: {
    lift: [-0.05, 0, 0.05],
    gamma: [1.2, 1.0, 1.2],
    gain: [1.2, 1.1, 1.3],
    saturation: 1.5,
    contrast: 1.2,
    brightness: 0.05,
  },
} as const;

export type ColorGradePreset = keyof typeof COLOR_GRADE_PRESETS;

export const BULLET_CONFIGS = {
  small: {
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
} as const;

export const ASTEROID_CONFIGS = {
  mega: {
    radius: 100,
    points: 10,
    speed: 0.5,
    childSize: 'big' as const,
    hits: 30,
    splitCount: 3,
    mass: 10,
  },
  big: {
    radius: 70,
    points: 20,
    speed: 1.0,
    childSize: 'medium' as const,
    hits: 10,
    splitCount: 2,
    mass: 5,
  },
  medium: {
    radius: 45,
    points: 50,
    speed: 2.0,
    childSize: 'small' as const,
    hits: 3,
    splitCount: 2,
    mass: 2,
  },
  small: { radius: 25, points: 100, speed: 3.5, childSize: null, hits: 1, splitCount: 0, mass: 1 },
} as const;

export const PARTICLE_COUNT = 20;
export const PARTICLE_LIFETIME = 1000;
export const SCREEN_SHAKE_DURATION = 250;

export const PLAYER_COLORS = ['#debbad', '#debade', '#badbde', '#baded6', '#d6bade'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const ASTEROID_COLORS: Record<'mega' | 'big' | 'medium' | 'small', [string, string]> = {
  mega: ['#ff6b6b', '#ff69b4'],
  big: ['#ffd93d', '#ff8800'],
  medium: ['#6bcb77', '#40e0d0'],
  small: ['#4d96ff', '#9b59b6'],
};
export type AsteroidColor = string;

export const THRUSTER_PARTICLE_LIFETIME = 700;
export const THRUSTER_PARTICLE_SPAWN_INTERVAL = 10;
export const THRUSTER_SPRITE_SIZE = 12;
export const THRUSTER_COLORS = ['#ff6600', '#ff7722', '#ff8833', '#ff4400'] as const;

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
  radius: 150,
  gravityStrength: 0.5,
  colorPalette: [
    '#e74c3c',
    '#3498db',
    '#2ecc71',
    '#9b59b6',
    '#f39c12',
    '#1abc9c',
    '#e67e22',
    '#34495e',
  ],
};
