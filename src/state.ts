import type {
  AlphaMask,
  Asteroid,
  Bullet,
  Particle,
  Planet,
  Player,
  ScreenShake,
  Star,
  ThrusterParticle,
} from './constants';

export let player: Player | null = null;
export function setPlayer(nextPlayer: Player | null): void {
  player = nextPlayer;
}
export const asteroids: Asteroid[] = [];
export const planets: Planet[] = [];
export const bullets: Bullet[] = [];
export const particles: Particle[] = [];
export const thrusterParticles: ThrusterParticle[] = [];

export const stars: Star[] = [];
export const backgroundOffset = { x: 0, y: 0 };
export const backgroundState = {
  driftAngle: Math.PI / 2,
  nextDriftChange: Date.now() + 15000,
};

export const screenShake: ScreenShake = { intensity: 0, duration: 0, startTime: 0 };

export function getGameWidth(): number {
  return gameState.gameSize?.width ?? 0;
}

export function getGameHeight(): number {
  return gameState.gameSize?.height ?? 0;
}

export function getGameCenterX(): number {
  return getGameWidth() / 2;
}

export function getGameCenterY(): number {
  return getGameHeight() / 2;
}

export type GamePhase = 'title' | 'playing' | 'gameover';
export type PlayableSceneName = 'game' | 'sandbox';

export type GameState = {
  gamepadImage: HTMLImageElement | null;
  baseAlphaMask: AlphaMask | null;
  assetsLoaded: boolean;
  colorSprites: Record<string, HTMLCanvasElement>;
  asteroidSprites: {
    mega: Record<string, HTMLCanvasElement>;
    big: Record<string, HTMLCanvasElement>;
    medium: Record<string, HTMLCanvasElement>;
    small: Record<string, HTMLCanvasElement>;
  };
  currentWave: number;
  waveCleared: boolean;
  waveClearTime: number;
  gamePhase: GamePhase;
  gameOverTime: number;
  restartScene: PlayableSceneName;
  gameSize: { width: number; height: number } | null;
  needsResize: boolean;
};

export const gameState: GameState = {
  gamepadImage: null,
  baseAlphaMask: null,
  assetsLoaded: false,
  colorSprites: {},
  asteroidSprites: {
    mega: {},
    big: {},
    medium: {},
    small: {},
  },
  currentWave: 1,
  waveCleared: false,
  waveClearTime: 0,
  gamePhase: 'title',
  gameOverTime: 0,
  restartScene: 'game',
  gameSize: null,
  needsResize: false,
};

export function resetState() {
  asteroids.length = 0;
  planets.length = 0;
  bullets.length = 0;
  particles.length = 0;
  thrusterParticles.length = 0;
  screenShake.intensity = 0;
  screenShake.duration = 0;
  screenShake.startTime = 0;
  gameState.currentWave = 1;
  gameState.waveCleared = false;
  gameState.waveClearTime = 0;
  gameState.gamePhase = 'playing';
}
