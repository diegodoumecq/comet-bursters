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
  nebulaBackground: boolean;
  nebulaRegions: boolean;
  playerHud: boolean;
  starfield: boolean;
  threeBackground: boolean;
  trajectoryPreview: boolean;
};

export function getSandboxPerfToggles(): SandboxPerfToggles {
  const nebulaBackground = getBooleanStartupFlagCandidates(
    ['sandboxNebulaBackground', 'sandboxThreeBackground'],
    true,
  );
  return {
    biomeDebug: getBooleanStartupFlag('sandboxBiomeDebug', false),
    blackHoles: getBooleanStartupFlag('sandboxBlackHoles', true),
    fuelMetaballs: getBooleanStartupFlag('sandboxFuelMetaballs', true),
    grid: getBooleanStartupFlag('sandboxGrid', true),
    markers: getBooleanStartupFlag('sandboxPerfMarkers', false),
    minimap: getBooleanStartupFlag('sandboxMinimap', true),
    nebulaBackground,
    nebulaRegions: getBooleanStartupFlag('sandboxNebulaRegions', true),
    playerHud: getBooleanStartupFlag('sandboxPlayerHud', true),
    starfield: getBooleanStartupFlag('sandboxStarfield', true),
    threeBackground: nebulaBackground,
    trajectoryPreview: getBooleanStartupFlag('sandboxTrajectoryPreview', true),
  };
}

function getBooleanStartupFlag(name: string, defaultValue: boolean): boolean {
  return getBooleanStartupFlagCandidates([name], defaultValue);
}

function getBooleanStartupFlagCandidates(names: string[], defaultValue: boolean): boolean {
  const search = new URLSearchParams(window.location.search);
  for (const name of names) {
    const raw = search.get(name);
    if (raw !== null) return raw !== 'false' && raw !== '0';
  }
  for (const name of names) {
    const raw = getStoredStartupValue(name);
    if (raw !== null) return raw !== 'false' && raw !== '0';
  }
  return defaultValue;
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
