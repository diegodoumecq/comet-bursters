import type { RawShipInteriorLevel } from '../../scenes/ShipInteriorScene/level';
import { getLevelGrid } from '../../scenes/ShipInteriorScene/level';

export function getGridCell(level: RawShipInteriorLevel, worldX: number, worldY: number) {
  const levelGrid = getLevelGrid(level);
  return {
    x: Math.floor(worldX / levelGrid.cellWidth),
    y: Math.floor(worldY / levelGrid.cellHeight),
  };
}
