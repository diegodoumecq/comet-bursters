import { useEffect } from 'react';

import { getEffectiveTilesetImageSrc } from '../shared/levelEditing';
import { useEditorStore } from './editorStore';

export function EditorStoreEffects() {
  const assetUrls = useEditorStore((state) => state.assetUrls);
  const level = useEditorStore((state) => state.level);
  const { setImages } = useEditorStore((state) => state.handlers);

  useEffect(() => {
    let cancelled = false;

    const loadAllTilesetImages = async () => {
      const entries = await Promise.all(
        level.tilesets.map(async (tileset) => {
          const src = getEffectiveTilesetImageSrc(tileset, assetUrls);

          if (!src) {
            return [tileset.id, null] as const;
          }

          try {
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
              const nextImage = new Image();
              nextImage.onload = () => resolve(nextImage);
              nextImage.onerror = () => reject(new Error(`Failed to load ${src}`));
              nextImage.src = src;
            });
            return [tileset.id, image] as const;
          } catch {
            return [tileset.id, null] as const;
          }
        }),
      );

      if (!cancelled) {
        setImages(Object.fromEntries(entries));
      }
    };

    void loadAllTilesetImages();

    return () => {
      cancelled = true;
    };
  }, [assetUrls, level.tilesets, setImages]);

  return null;
}
