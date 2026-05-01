import { useEffect } from 'react';

import { useSpriteEditorStore } from './state/spriteEditorStore';
import { clampBrushSize } from './utils';

function isEditingField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function useSpriteEditorKeyboardShortcuts({
  centerCanvas,
  clearSelection,
  copySelection,
  handlePasteSelection,
  handleRedo,
  handleSave,
  handleUndo,
  zoomIn,
  zoomOut,
}: {
  centerCanvas: () => void;
  clearSelection: () => void;
  copySelection: () => Promise<void>;
  handlePasteSelection: (blob: Blob) => Promise<void>;
  handleRedo: () => void;
  handleSave: () => Promise<void>;
  handleUndo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}) {
  const hasSelection = useSpriteEditorStore((state) => state.selectionRect !== null);
  const handlers = useSpriteEditorStore((state) => state.handlers);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isEditingField(event.target)) {
        event.preventDefault();
        handlers.setIsSpacePressed(true);
        return;
      }

      if (isEditingField(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 's') {
        event.preventDefault();
        void handleSave();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'c') {
        if (!hasSelection) {
          return;
        }
        event.preventDefault();
        void copySelection();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (key === '+' || key === '=')) {
        event.preventDefault();
        zoomIn();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === '-') {
        event.preventDefault();
        zoomOut();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
          return;
        }
        handleUndo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (key === 'b') {
        handlers.setTool('draw');
        return;
      }
      if (key === 'v') {
        handlers.setTool('move');
        return;
      }
      if (key === 'm') {
        handlers.setTool('select');
        return;
      }
      if (key === 'e') {
        handlers.setTool('erase');
        return;
      }
      if (key === 'i') {
        handlers.setTool('picker');
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        handlers.setBrushSize((current) => clampBrushSize(current - 1));
        return;
      }
      if (event.key === ']') {
        event.preventDefault();
        handlers.setBrushSize((current) => clampBrushSize(current + 1));
        return;
      }
      if (key === '0') {
        event.preventDefault();
        centerCanvas();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        handlers.setIsSpacePressed(false);
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (isEditingField(event.target)) {
        return;
      }

      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
        item.type.startsWith('image/'),
      );
      const file = imageItem?.getAsFile();
      if (!file) {
        return;
      }

      event.preventDefault();
      void handlePasteSelection(file);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
    };
  }, [
    centerCanvas,
    clearSelection,
    copySelection,
    handlePasteSelection,
    handleRedo,
    handleSave,
    handleUndo,
    handlers,
    hasSelection,
    zoomIn,
    zoomOut,
  ]);
}
