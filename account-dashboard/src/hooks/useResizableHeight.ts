import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizableHeightOptions {
  storageKey: string;
  defaultHeight: number;
  minHeight?: number;
  maxHeight?: number;
}

export function useResizableHeight({
  storageKey,
  defaultHeight,
  minHeight = 80,
  maxHeight = 800,
}: UseResizableHeightOptions) {
  const [height, setHeight] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const n = Number(stored);
        if (!isNaN(n)) return Math.max(minHeight, Math.min(maxHeight, n));
      }
    } catch {}
    return defaultHeight;
  });

  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const currentHeight = useRef(height);

  useEffect(() => {
    currentHeight.current = height;
  }, [height]);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      startY.current = e.clientY;
      startHeight.current = currentHeight.current;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientY - startY.current;
        const next = Math.max(minHeight, Math.min(maxHeight, startHeight.current + delta));
        setHeight(next);
        currentHeight.current = next;
      };

      const onUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try {
          localStorage.setItem(storageKey, String(currentHeight.current));
        } catch {}
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [minHeight, maxHeight, storageKey]
  );

  return { height, onResizeStart };
}
