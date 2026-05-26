import type { EditorTilesetDefinition as SpritesheetEditorTilesetDefinition } from '../../editor/shared/editorTileset';
import type { TileEntry } from './spritesheetEditorStore';

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
