export type DemoPerfTechnique = 'asteroid-atlas-rotation' | 'planet-texture-cache';

export function getActiveDemoPerfTechnique(): DemoPerfTechnique | null {
  const raw = window.__demoPerfTechnique;
  return raw === 'asteroid-atlas-rotation' || raw === 'planet-texture-cache' ? raw : null;
}

export function isFocusedDemoTechniqueActive(): boolean {
  return getActiveDemoPerfTechnique() !== null;
}

declare global {
  interface Window {
    __demoPerfTechnique?: string;
  }
}
