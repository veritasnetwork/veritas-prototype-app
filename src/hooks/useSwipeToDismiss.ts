import { useEffect, useRef, useState } from 'react';

interface UseSwipeToDismissOptions {
  onDismiss: () => void;
  enabled?: boolean;
  threshold?: number; // Distance in pixels to trigger dismiss
  dragHandleSelector?: string; // CSS selector for drag handle element
}

export function useSwipeToDismiss({
  onDismiss,
  enabled = true,
  threshold = 150,
  dragHandleSelector,
}: UseSwipeToDismissOptions) {
  const [dragDistance, setDragDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      // If dragHandleSelector is provided, only allow dragging from the handle
      if (dragHandleSelector) {
        const target = e.target as HTMLElement;
        const dragHandle = container.querySelector(dragHandleSelector);
        if (!dragHandle || !dragHandle.contains(target)) {
          return;
        }
      }

      touchStartY.current = e.touches[0].clientY;
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging && touchStartY.current === 0) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      // Only track downward swipes
      if (distance > 0) {
        setDragDistance(distance);

        // Prevent scroll when dragging
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;

      setIsDragging(false);

      if (dragDistance >= threshold) {
        // Trigger dismiss
        onDismiss();
      } else {
        // Snap back
        setDragDistance(0);
      }

      touchStartY.current = 0;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onDismiss, threshold, dragHandleSelector, isDragging, dragDistance]);

  return {
    containerRef,
    dragDistance,
    isDragging,
  };
}
