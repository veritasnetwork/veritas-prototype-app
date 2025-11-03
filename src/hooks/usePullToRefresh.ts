import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  distanceToRefresh?: number; // Distance in pixels to trigger refresh
  enabled?: boolean; // Whether pull-to-refresh is enabled
}

export function usePullToRefresh({
  onRefresh,
  distanceToRefresh = 80,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number>(0);
  const isPulling = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      // Only track downward pulls
      if (distance > 0) {
        // Prevent default scrolling when pulling down at the top
        if (window.scrollY === 0) {
          e.preventDefault();
        }

        // Apply resistance curve (logarithmic) for better feel
        const resistance = Math.log(distance + 1) * 15;
        setPullDistance(Math.min(resistance, distanceToRefresh * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;

      isPulling.current = false;

      if (pullDistance >= distanceToRefresh) {
        setIsRefreshing(true);
        setPullDistance(distanceToRefresh); // Keep at threshold during refresh

        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onRefresh, distanceToRefresh, pullDistance]);

  return {
    isRefreshing,
    pullDistance,
  };
}
