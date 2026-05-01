import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SpriteSheetGridConfig } from '@/spritesheet';

import { getGridSourcesForSpriteAsset, spriteAssets } from '../assetCatalog';

export type SpriteEditorTool = 'draw' | 'erase' | 'picker' | 'move' | 'select';
export type SpriteEditorInteractionMode = 'idle' | 'paint' | 'pan' | 'move' | 'select';
export type RgbaColor = { r: number; g: number; b: number; a: number };
export type PixelRect = { x: number; y: number; width: number; height: number };
export type GridSettings = {
  frameCount?: number;
  frameHeight: number;
  frameWidth: number;
  gapX?: number;
  gapY?: number;
  offsetX?: number;
  offsetY?: number;
};
export type ViewportOffset = { x: number; y: number };
type GridNumberKey = keyof GridSettings;

type SpriteEditorState = {
  activeAssetPath: string | null;
  brushColor: RgbaColor;
  brushSize: number;
  gridColor: string;
  gridOpacity: number;
  gridSettings: GridSettings;
  interactionMode: SpriteEditorInteractionMode;
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

type SpriteEditorHandlers = {
  applyGridSettings: (gridSettings: GridSettings) => void;
  setActiveAssetPath: (activeAssetPath: string | null) => void;
  setBrushColor: (brushColor: RgbaColor | ((current: RgbaColor) => RgbaColor)) => void;
  setBrushSize: (brushSize: number | ((current: number) => number)) => void;
  setGridColor: (gridColor: string) => void;
  setGridOpacity: (gridOpacity: number) => void;
  setInteractionMode: (interactionMode: SpriteEditorInteractionMode) => void;
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

export type SpriteEditorStore = SpriteEditorState & { handlers: SpriteEditorHandlers };
type SpriteEditorSet = Parameters<StateCreator<SpriteEditorStore>>[0];

const SPRITE_EDITOR_STORAGE_KEY = 'comet-bursters.sprite-editor';
const DEFAULT_GRID_FRAME_SIZE = 16;
const DEFAULT_BRUSH_COLOR: RgbaColor = { r: 255, g: 255, b: 255, a: 255 };
const DEFAULT_VIEWPORT_OFFSET: ViewportOffset = { x: 0, y: 0 };
const DEFAULT_ACTIVE_ASSET_PATH = spriteAssets[0]?.assetPath ?? null;

function normalizeOptionalGridValue(value?: number): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

export function normalizeGridSettings(config?: SpriteSheetGridConfig): GridSettings {
  return {
    frameCount: normalizeOptionalGridValue(config?.frameCount),
    frameHeight:
      config?.frameHeight && Number.isFinite(config.frameHeight) && config.frameHeight > 0
        ? Math.round(config.frameHeight)
        : DEFAULT_GRID_FRAME_SIZE,
    frameWidth:
      config?.frameWidth && Number.isFinite(config.frameWidth) && config.frameWidth > 0
        ? Math.round(config.frameWidth)
        : DEFAULT_GRID_FRAME_SIZE,
    gapX: normalizeOptionalGridValue(config?.gapX),
    gapY: normalizeOptionalGridValue(config?.gapY),
    offsetX: normalizeOptionalGridValue(config?.offsetX),
    offsetY: normalizeOptionalGridValue(config?.offsetY),
  };
}

function getAssetGridSettings(activeAssetPath: string | null): GridSettings {
  const matchingGridSource = activeAssetPath
    ? (getGridSourcesForSpriteAsset(activeAssetPath)[0] ?? null)
    : null;
  return normalizeGridSettings(matchingGridSource?.grid);
}

function getInitialSpriteEditorState(): SpriteEditorState {
  return {
    activeAssetPath: DEFAULT_ACTIVE_ASSET_PATH,
    brushColor: DEFAULT_BRUSH_COLOR,
    brushSize: 1,
    gridColor: '#67e8f9',
    gridOpacity: 0.45,
    gridSettings: getAssetGridSettings(DEFAULT_ACTIVE_ASSET_PATH),
    interactionMode: 'idle',
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
    viewportOffset: DEFAULT_VIEWPORT_OFFSET,
    zoom: 16,
  };
}

function parseGridNumberUpdate(
  current: GridSettings,
  key: GridNumberKey,
  value: string,
  required = false,
): GridSettings | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return required ? null : { ...current, [key]: undefined };
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  const requiresPositive = key === 'frameWidth' || key === 'frameHeight';
  if ((requiresPositive && parsedValue < 1) || (!requiresPositive && parsedValue < 0)) {
    return null;
  }

  return { ...current, [key]: parsedValue };
}

function createSpriteEditorHandlers(set: SpriteEditorSet): SpriteEditorHandlers {
  return {
    applyGridSettings: (gridSettings) => set({ gridSettings }),
    setActiveAssetPath: (activeAssetPath) =>
      set({
        activeAssetPath,
        gridSettings: getAssetGridSettings(activeAssetPath),
      }),
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
    setInteractionMode: (interactionMode) => set({ interactionMode }),
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
        const gridSettings = parseGridNumberUpdate(state.gridSettings, key, value, required);
        return gridSettings ? { gridSettings } : state;
      }),
  };
}

export const useSpriteEditorStore = create<SpriteEditorStore>()(
  persist(
    (set) => ({
      ...getInitialSpriteEditorState(),
      handlers: createSpriteEditorHandlers(set),
    }),
    {
      name: SPRITE_EDITOR_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        const activeAssetPath = state?.activeAssetPath ?? DEFAULT_ACTIVE_ASSET_PATH;
        state?.handlers.setActiveAssetPath(activeAssetPath);
      },
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
