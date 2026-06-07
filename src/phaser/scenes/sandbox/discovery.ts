import type { Vector, WorldSize } from '../../core/types';
import type { PlanetEntity } from '../../planets/types';

export const MINIMAP_COLUMNS = 44;
export const MINIMAP_ROWS = 44;
export const DISCOVERY_RADIUS = 1250;

export class SandboxDiscovery {
  readonly exploredCells = new Uint8Array(MINIMAP_COLUMNS * MINIMAP_ROWS);
  readonly visibleCells = new Uint8Array(MINIMAP_COLUMNS * MINIMAP_ROWS);
  readonly discoveredPlanetIds = new Set<number>();
  private cellCenters: { height: number; width: number; x: Float32Array; y: Float32Array } | null =
    null;
  private readonly nextVisibleCells = new Uint8Array(MINIMAP_COLUMNS * MINIMAP_ROWS);
  version = 0;

  update(player: Vector, planets: PlanetEntity[], world: WorldSize): void {
    this.nextVisibleCells.fill(0);
    const cellCenters = this.getCellCenters(world);
    const radiusSq = DISCOVERY_RADIUS * DISCOVERY_RADIUS;
    let changed = false;
    for (let row = 0; row < MINIMAP_ROWS; row += 1) {
      for (let col = 0; col < MINIMAP_COLUMNS; col += 1) {
        const index = row * MINIMAP_COLUMNS + col;
        const deltaX = getWrappedDeltaAxis(player.x, cellCenters.x[index], world.width);
        const deltaY = getWrappedDeltaAxis(player.y, cellCenters.y[index], world.height);
        if (deltaX * deltaX + deltaY * deltaY <= radiusSq) {
          this.nextVisibleCells[index] = 1;
          if (!this.exploredCells[index]) changed = true;
          this.exploredCells[index] = 1;
        }
      }
    }
    for (let index = 0; index < this.visibleCells.length; index += 1) {
      if (this.visibleCells[index] !== this.nextVisibleCells[index]) changed = true;
      this.visibleCells[index] = this.nextVisibleCells[index];
    }

    for (const planet of planets) {
      const deltaX = getWrappedDeltaAxis(player.x, planet.position.x, world.width);
      const deltaY = getWrappedDeltaAxis(player.y, planet.position.y, world.height);
      const discoveryRadius = DISCOVERY_RADIUS + planet.radius;
      if (deltaX * deltaX + deltaY * deltaY <= discoveryRadius * discoveryRadius) {
        const previousSize = this.discoveredPlanetIds.size;
        this.discoveredPlanetIds.add(planet.id);
        if (this.discoveredPlanetIds.size !== previousSize) changed = true;
      }
    }

    if (changed) this.version += 1;
  }

  private getCellCenters(world: WorldSize): { height: number; width: number; x: Float32Array; y: Float32Array } {
    if (this.cellCenters?.width === world.width && this.cellCenters.height === world.height) {
      return this.cellCenters;
    }

    const x = new Float32Array(MINIMAP_COLUMNS * MINIMAP_ROWS);
    const y = new Float32Array(MINIMAP_COLUMNS * MINIMAP_ROWS);
    for (let row = 0; row < MINIMAP_ROWS; row += 1) {
      for (let col = 0; col < MINIMAP_COLUMNS; col += 1) {
        const index = row * MINIMAP_COLUMNS + col;
        x[index] = ((col + 0.5) / MINIMAP_COLUMNS) * world.width;
        y[index] = ((row + 0.5) / MINIMAP_ROWS) * world.height;
      }
    }
    this.cellCenters = { height: world.height, width: world.width, x, y };
    return this.cellCenters;
  }
}

function getWrappedDeltaAxis(from: number, to: number, worldSize: number): number {
  let delta = to - from;
  if (delta > worldSize * 0.5) delta -= worldSize;
  if (delta < -worldSize * 0.5) delta += worldSize;
  return delta;
}
