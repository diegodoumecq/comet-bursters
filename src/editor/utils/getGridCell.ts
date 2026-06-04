import type { RawShipInteriorLevel } from '../../shipInterior/level';
import { getLevelGrid } from '../../shipInterior/level';

export function getGridCell(level: RawShipInteriorLevel, worldX: number, worldY: number) {
  const levelGrid = getLevelGrid(level);
  return {
    x: Math.floor(worldX / levelGrid.cellWidth),
    y: Math.floor(worldY / levelGrid.cellHeight),
  };
}
