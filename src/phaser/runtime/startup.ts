export function getStartingWave(): number {
  const raw = window.sessionStorage.getItem('comet-bursters-starting-wave');
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 1;
}

export function getSandboxFogEnabled(): boolean {
  return window.sessionStorage.getItem('comet-bursters-fog-enabled') !== 'false';
}

export type SandboxPerfToggles = {
  blackHoles: boolean;
  fuelMetaballs: boolean;
  markers: boolean;
  minimap: boolean;
  nebulaRegions: boolean;
  starfield: boolean;
  threeBackground: boolean;
};

export function getSandboxPerfToggles(): SandboxPerfToggles {
  return {
    blackHoles: getBooleanStartupFlag('sandboxBlackHoles', true),
    fuelMetaballs: getBooleanStartupFlag('sandboxFuelMetaballs', true),
    markers: getBooleanStartupFlag('sandboxPerfMarkers', false),
    minimap: getBooleanStartupFlag('sandboxMinimap', true),
    nebulaRegions: getBooleanStartupFlag('sandboxNebulaRegions', true),
    starfield: getBooleanStartupFlag('sandboxStarfield', true),
    threeBackground: getBooleanStartupFlag('sandboxThreeBackground', true),
  };
}

function getBooleanStartupFlag(name: string, defaultValue: boolean): boolean {
  const search = new URLSearchParams(window.location.search);
  const raw = search.get(name) ?? window.sessionStorage.getItem(`comet-bursters-${name}`);
  if (raw === null) return defaultValue;
  return raw !== 'false' && raw !== '0';
}
