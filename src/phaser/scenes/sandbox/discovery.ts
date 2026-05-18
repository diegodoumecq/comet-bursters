import type { Vector, WorldSize } from '../../core/types';
import type { PlanetEntity } from '../../planets/types';
import { wrappedDelta } from '../../world/geometry';

export const MINIMAP_COLUMNS = 44;
export const MINIMAP_ROWS = 44;
export const DISCOVERY_RADIUS = 1250;

export class SandboxDiscovery {
  readonly exploredCells = new Uint8Array(MINIMAP_COLUMNS * MINIMAP_ROWS);
  readonly visibleCells = new Uint8Array(MINIMAP_COLUMNS * MINIMAP_ROWS);
  readonly discoveredPlanetIds = new Set<number>();

  update(player: Vector, planets: PlanetEntity[], world: WorldSize): void {
    this.visibleCells.fill(0);
    for (let row = 0; row < MINIMAP_ROWS; row += 1) {
      for (let col = 0; col < MINIMAP_COLUMNS; col += 1) {
        const cell = {
          x: ((col + 0.5) / MINIMAP_COLUMNS) * world.width,
          y: ((row + 0.5) / MINIMAP_ROWS) * world.height,
        };
        const delta = wrappedDelta(player, cell, world);
        if (Math.hypot(delta.x, delta.y) <= DISCOVERY_RADIUS) {
          const index = row * MINIMAP_COLUMNS + col;
          this.visibleCells[index] = 1;
          this.exploredCells[index] = 1;
        }
      }
    }

    for (const planet of planets) {
      const delta = wrappedDelta(player, planet.position, world);
      if (Math.hypot(delta.x, delta.y) <= DISCOVERY_RADIUS + planet.radius) {
        this.discoveredPlanetIds.add(planet.id);
      }
    }
  }
}
