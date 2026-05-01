export type RectangleDragState = {
  endX: number;
  endY: number;
  mode: 'materials' | 'tiles';
  startX: number;
  startY: number;
};

export type RectangleDragContext = {
  fillRectangleDrag: boolean;
  onlyPaintUnoccupiedCells: boolean;
  selectedLayerId: string | null;
  selectedMaterialId: string | null;
  selectedTileId: number | null;
};
