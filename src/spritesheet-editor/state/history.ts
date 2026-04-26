import type { TileEntry } from './spritesheetEditorStore';
import type { EditorTilesetDefinition as SpritesheetEditorTilesetDefinition } from '../../editor/shared/editorTileset';

export type SpritesheetEditorDocument = {
  selectedFileName: string;
  selectedTileId: number | null;
  tileEntries: TileEntry[];
  tileset: SpritesheetEditorTilesetDefinition | null;
};

export type SpritesheetEditorHistoryEntry = {
  before: SpritesheetEditorDocument;
  after: SpritesheetEditorDocument;
};
