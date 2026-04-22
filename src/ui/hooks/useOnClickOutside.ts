import { useEffect } from 'react';

export function useOnClickOutside<T extends HTMLElement>({
  enabled = true,
  onClickOutside,
  ref,
}: {
  enabled?: boolean;
  onClickOutside: () => void;
  ref: React.RefObject<T | null>;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const element = ref.current;
      const target = event.target;
      if (!element || !(target instanceof Node) || element.contains(target)) {
        return;
      }

      onClickOutside();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [enabled, onClickOutside, ref]);
}
