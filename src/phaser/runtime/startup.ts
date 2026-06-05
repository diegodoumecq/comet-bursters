export function getStartingWave(): number {
  const raw = window.sessionStorage.getItem('comet-bursters-starting-wave');
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 1;
}

export function getSandboxFogEnabled(): boolean {
  return window.sessionStorage.getItem('comet-bursters-fog-enabled') !== 'false';
}

export function getArcadeRiftDebugEnabled(): boolean {
  return getBooleanStartupFlag('arcadeRiftDebug', false);
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
  const raw = search.get(name) ?? window.sessionStorage.getItem(`comet-bursters-${name}`);
  if (raw === null) return defaultValue;
  return raw !== 'false' && raw !== '0';
}
