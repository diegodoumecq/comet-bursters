import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SpriteSheetGridConfig } from '@/spritesheet';

import { spriteAssets } from '../assetCatalog';

export type SpriteEditorTool = 'draw' | 'erase' | 'picker' | 'move' | 'select';
export type SpriteEditorInteractionMode = 'idle' | 'paint' | 'pan' | 'move' | 'select';
export type RgbaColor = { r: number; g: number; b: number; a: number };
export type PixelRect = { x: number; y: number; width: number; height: number };
export type GridSettings = {
  columns?: number;
  frameCount?: number;
  frameHeight: number;
  frameWidth: number;
  gapX?: number;
  gapY?: number;
  offsetX?: number;
  offsetY?: number;
  rows?: number;
};
export type ViewportOffset = { x: number; y: number };
export type HoveredPixel = { x: number; y: number } | null;

type SpriteEditorState = {
  activeAssetPath: string | null;
  brushColor: RgbaColor;
  brushSize: number;
  gridColor: string;
  gridOpacity: number;
  gridSettings: GridSettings;
  hoveredPixel: HoveredPixel;
  interactionMode: SpriteEditorInteractionMode;
  isActionsOpen: boolean;
  isGridVisible: boolean;
  isLoading: boolean;
  isSidebarResizable: boolean;
  isSaving: boolean;
  isSpacePressed: boolean;
  loadError: string | null;
  message: string | null;
  selectionRect: PixelRect | null;
  sidebarSize: number;
  tool: SpriteEditorTool;
  viewportOffset: ViewportOffset;
  zoom: number;
};

type SpriteEditorActions = {
  applyGridSettings: (gridSettings: GridSettings) => void;
  resetGridSettings: () => void;
  setActiveAssetPath: (activeAssetPath: string | null) => void;
  setBrushColor: (brushColor: RgbaColor | ((current: RgbaColor) => RgbaColor)) => void;
  setBrushSize: (brushSize: number | ((current: number) => number)) => void;
  setGridColor: (gridColor: string) => void;
  setGridOpacity: (gridOpacity: number) => void;
  setHoveredPixel: (hoveredPixel: HoveredPixel) => void;
  setInteractionMode: (interactionMode: SpriteEditorInteractionMode) => void;
  setIsActionsOpen: (isActionsOpen: boolean | ((current: boolean) => boolean)) => void;
  setIsGridVisible: (isGridVisible: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsSidebarResizable: (isSidebarResizable: boolean) => void;
  setIsSaving: (isSaving: boolean) => void;
  setIsSpacePressed: (isSpacePressed: boolean) => void;
  setLoadError: (loadError: string | null) => void;
  setMessage: (message: string | null) => void;
  setSelectionRect: (selectionRect: PixelRect | null) => void;
  setSidebarSize: (sidebarSize: number) => void;
  setTool: (tool: SpriteEditorTool) => void;
  setViewportOffset: (
    viewportOffset: ViewportOffset | ((current: ViewportOffset) => ViewportOffset),
  ) => void;
  setZoom: (zoom: number) => void;
  updateGridNumber: (key: keyof GridSettings, value: string, required?: boolean) => void;
};

export type SpriteEditorStore = SpriteEditorState & SpriteEditorActions;

const SPRITE_EDITOR_STORAGE_KEY = 'comet-bursters.sprite-editor';

function normalizeOptionalGridValue(value?: number): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

export function normalizeGridSettings(config?: SpriteSheetGridConfig): GridSettings {
  return {
    columns: normalizeOptionalGridValue(config?.columns),
    frameCount: normalizeOptionalGridValue(config?.frameCount),
    frameHeight:
      config?.frameHeight && Number.isFinite(config.frameHeight) && config.frameHeight > 0
        ? Math.round(config.frameHeight)
        : 16,
    frameWidth:
      config?.frameWidth && Number.isFinite(config.frameWidth) && config.frameWidth > 0
        ? Math.round(config.frameWidth)
        : 16,
    gapX: normalizeOptionalGridValue(config?.gapX),
    gapY: normalizeOptionalGridValue(config?.gapY),
    offsetX: normalizeOptionalGridValue(config?.offsetX),
    offsetY: normalizeOptionalGridValue(config?.offsetY),
    rows: normalizeOptionalGridValue(config?.rows),
  };
}

function makeInitialSpriteEditorState(): SpriteEditorState {
  return {
    activeAssetPath: spriteAssets[0]?.assetPath ?? null,
    brushColor: { r: 255, g: 255, b: 255, a: 255 },
    brushSize: 1,
    gridColor: '#67e8f9',
    gridOpacity: 0.45,
    gridSettings: normalizeGridSettings(),
    hoveredPixel: null,
    interactionMode: 'idle',
    isActionsOpen: false,
    isGridVisible: false,
    isLoading: false,
    isSidebarResizable: true,
    isSaving: false,
    isSpacePressed: false,
    loadError: null,
    message: null,
    selectionRect: null,
    sidebarSize: 22,
    tool: 'draw',
    viewportOffset: { x: 0, y: 0 },
    zoom: 16,
  };
}

export const useSpriteEditorStore = create<SpriteEditorStore>()(
  persist(
    (set) => ({
      ...makeInitialSpriteEditorState(),

      applyGridSettings: (gridSettings) => set({ gridSettings }),
      resetGridSettings: () => set({ gridSettings: normalizeGridSettings() }),
      setActiveAssetPath: (activeAssetPath) => set({ activeAssetPath }),
      setBrushColor: (brushColor) =>
        set((state) => ({
          brushColor:
            typeof brushColor === 'function' ? brushColor(state.brushColor) : brushColor,
        })),
      setBrushSize: (brushSize) =>
        set((state) => ({
          brushSize: typeof brushSize === 'function' ? brushSize(state.brushSize) : brushSize,
        })),
      setGridColor: (gridColor) => set({ gridColor }),
      setGridOpacity: (gridOpacity) => set({ gridOpacity }),
      setHoveredPixel: (hoveredPixel) => set({ hoveredPixel }),
      setInteractionMode: (interactionMode) => set({ interactionMode }),
      setIsActionsOpen: (isActionsOpen) =>
        set((state) => ({
          isActionsOpen:
            typeof isActionsOpen === 'function' ? isActionsOpen(state.isActionsOpen) : isActionsOpen,
        })),
      setIsGridVisible: (isGridVisible) => set({ isGridVisible }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setIsSidebarResizable: (isSidebarResizable) => set({ isSidebarResizable }),
      setIsSaving: (isSaving) => set({ isSaving }),
      setIsSpacePressed: (isSpacePressed) => set({ isSpacePressed }),
      setLoadError: (loadError) => set({ loadError }),
      setMessage: (message) => set({ message }),
      setSelectionRect: (selectionRect) => set({ selectionRect }),
      setSidebarSize: (sidebarSize) => set({ sidebarSize }),
      setTool: (tool) => set({ tool }),
      setViewportOffset: (viewportOffset) =>
        set((state) => ({
          viewportOffset:
            typeof viewportOffset === 'function'
              ? viewportOffset(state.viewportOffset)
              : viewportOffset,
        })),
      setZoom: (zoom) => set({ zoom }),
      updateGridNumber: (key, value, required = false) =>
        set((state) => {
          const normalizedValue = value.trim();
          if (!normalizedValue) {
            return required ? state : { gridSettings: { ...state.gridSettings, [key]: undefined } };
          }

          const parsedValue = Number.parseInt(normalizedValue, 10);
          if (!Number.isFinite(parsedValue)) {
            return state;
          }

          if ((key === 'frameWidth' || key === 'frameHeight') && parsedValue < 1) {
            return state;
          }

          if (key !== 'frameWidth' && key !== 'frameHeight' && parsedValue < 0) {
            return state;
          }

          return {
            gridSettings: { ...state.gridSettings, [key]: parsedValue },
          };
        }),
    }),
    {
      name: SPRITE_EDITOR_STORAGE_KEY,
      partialize: (state) => ({
        activeAssetPath: state.activeAssetPath,
        brushColor: state.brushColor,
        brushSize: state.brushSize,
        gridColor: state.gridColor,
        gridOpacity: state.gridOpacity,
        gridSettings: state.gridSettings,
        isGridVisible: state.isGridVisible,
        isSidebarResizable: state.isSidebarResizable,
        sidebarSize: state.sidebarSize,
        tool: state.tool,
        zoom: state.zoom,
      }),
      storage: createJSONStorage(() => window.localStorage),
    },
  ),
);
