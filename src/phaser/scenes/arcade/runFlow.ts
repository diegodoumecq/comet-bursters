export { chooseSafePlayerPosition } from './arcadeSpawns';

export const RESPAWN_DELAY_MS = 1800;

export function getNextWaveState(asteroidCount: number, wave: number, waveClearAt: number, now: number): {
  shouldSpawn: boolean;
  wave: number;
  waveClearAt: number;
} {
  if (asteroidCount > 0) return { shouldSpawn: false, wave, waveClearAt: 0 };
  if (waveClearAt === 0) return { shouldSpawn: false, wave, waveClearAt: now };
  if (now - waveClearAt < 1200) return { shouldSpawn: false, wave, waveClearAt };
  return { shouldSpawn: true, wave: wave + 1, waveClearAt: 0 };
}
