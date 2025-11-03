import { useEffect, useRef, useState, useCallback } from 'react';

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
  const [isSnappingBack, setIsSnappingBack] = useState(false);
  const touchStartY = useRef<number>(0);
  const isPulling = useRef(false);
  const currentPullDistance = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  // Memoize the refresh callback to prevent re-creating event listeners
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
        setIsSnappingBack(false);
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

        // Apply a more subtle resistance curve for smoother feel
        // Use a square root curve which feels more natural than logarithmic
        const resistance = Math.sqrt(distance) * 8;
        const limitedDistance = Math.min(resistance, distanceToRefresh * 1.5);

        // Use requestAnimationFrame for smoother updates
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          currentPullDistance.current = limitedDistance;
          setPullDistance(limitedDistance);
        });
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;

      isPulling.current = false;
      const finalDistance = currentPullDistance.current;

      if (finalDistance >= distanceToRefresh) {
        setIsRefreshing(true);
        setPullDistance(distanceToRefresh); // Keep at threshold during refresh

        try {
          await onRefreshRef.current();
        } finally {
          // Smooth transition back to 0
          setIsSnappingBack(true);
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
            currentPullDistance.current = 0;
            setIsSnappingBack(false);
          }, 300); // Match CSS transition duration
        }
      } else {
        // Animate snap back
        setIsSnappingBack(true);
        setPullDistance(0);
        currentPullDistance.current = 0;
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, distanceToRefresh]); // Removed pullDistance from deps

  return {
    isRefreshing,
    pullDistance,
    isSnappingBack,
  };
}
