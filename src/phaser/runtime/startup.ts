const STORAGE_PREFIX = 'comet-bursters-';

export function getStartingWave(): number {
  const raw = getStoredStartupValue('starting-wave');
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 1;
}

export function getSandboxFogEnabled(): boolean {
  return getBooleanStoredStartupFlag('fog-enabled', true);
}

export function getArcadeRiftDebugEnabled(): boolean {
  return getBooleanStartupFlag('arcadeRiftDebug', false);
}

export function getArcadeRiftDebugScenario(): string | null {
  const search = new URLSearchParams(window.location.search);
  return search.get('arcadeRiftDebugScenario');
}

export function getArcadeDimensionDebugEnabled(): boolean {
  return getBooleanStartupFlag('arcadeDimensionDebug', false);
}

export type SandboxPerfToggles = {
  biomeDebug: boolean;
  blackHoles: boolean;
  fuelMetaballs: boolean;
  grid: boolean;
  markers: boolean;
  minimap: boolean;
  nebulaRegions: boolean;
  playerHud: boolean;
  starfield: boolean;
  threeBackground: boolean;
  trajectoryPreview: boolean;
};

export function getSandboxPerfToggles(): SandboxPerfToggles {
  return {
    biomeDebug: getBooleanStartupFlag('sandboxBiomeDebug', false),
    blackHoles: getBooleanStartupFlag('sandboxBlackHoles', true),
    fuelMetaballs: getBooleanStartupFlag('sandboxFuelMetaballs', true),
    grid: getBooleanStartupFlag('sandboxGrid', true),
    markers: getBooleanStartupFlag('sandboxPerfMarkers', false),
    minimap: getBooleanStartupFlag('sandboxMinimap', true),
    nebulaRegions: getBooleanStartupFlag('sandboxNebulaRegions', true),
    playerHud: getBooleanStartupFlag('sandboxPlayerHud', true),
    starfield: getBooleanStartupFlag('sandboxStarfield', true),
    threeBackground: getBooleanStartupFlag('sandboxThreeBackground', true),
    trajectoryPreview: getBooleanStartupFlag('sandboxTrajectoryPreview', true),
  };
}

function getBooleanStartupFlag(name: string, defaultValue: boolean): boolean {
  const search = new URLSearchParams(window.location.search);
  const raw = search.get(name) ?? getStoredStartupValue(name);
  if (raw === null) return defaultValue;
  return raw !== 'false' && raw !== '0';
}

function getBooleanStoredStartupFlag(name: string, defaultValue: boolean): boolean {
  const raw = getStoredStartupValue(name);
  if (raw === null) return defaultValue;
  return raw !== 'false' && raw !== '0';
}

function getStoredStartupValue(name: string): string | null {
  const storageKey = `${STORAGE_PREFIX}${name}`;
  const sessionValue = window.sessionStorage.getItem(storageKey);
  if (sessionValue !== null) return sessionValue;
  return window.localStorage.getItem(storageKey);
}
