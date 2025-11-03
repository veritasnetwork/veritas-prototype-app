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
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef<number>(0);
  const isPullingRef = useRef(false);
  const currentPullDistance = useRef<number>(0);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  // Memoize the refresh callback to prevent re-creating event listeners
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Direct DOM manipulation for butter-smooth dragging (no React re-renders)
  const updateIndicatorPosition = useCallback((distance: number) => {
    if (indicatorRef.current) {
      const clampedDistance = Math.min(distance, distanceToRefresh * 1.5);
      const opacity = Math.min(clampedDistance / distanceToRefresh, 1);

      indicatorRef.current.style.transform = `translateY(${clampedDistance}px)`;
      indicatorRef.current.style.opacity = String(opacity);

      // Rotate the spinner based on pull distance (only when not refreshing)
      const spinner = indicatorRef.current.querySelector('.ptr-spinner') as HTMLElement;
      if (spinner && !isRefreshing) {
        spinner.style.transform = `rotate(${clampedDistance * 4}deg)`;
      }
    }
  }, [distanceToRefresh, isRefreshing]);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isPullingRef.current = true;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      // Only track downward pulls AND only if still at top
      if (distance > 0 && window.scrollY === 0) {
        // Prevent default scrolling ONLY when pulling down at the very top
        e.preventDefault();

        // Apply a more subtle resistance curve for smoother feel
        // Use a square root curve which feels more natural than logarithmic
        const resistance = Math.sqrt(distance) * 8;
        currentPullDistance.current = resistance;

        // Direct DOM manipulation - no state updates = no jitter
        updateIndicatorPosition(resistance);
      } else if (window.scrollY > 0) {
        // Page has been scrolled down - cancel pull gesture and allow normal scroll
        isPullingRef.current = false;
        setIsPulling(false);
        currentPullDistance.current = 0;
        updateIndicatorPosition(0);
      }
      // Note: We don't cancel on distance < 0 because that's just the user
      // releasing the pull by moving finger back up, which is normal
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;

      isPullingRef.current = false;
      const finalDistance = currentPullDistance.current;

      if (finalDistance >= distanceToRefresh) {
        setIsRefreshing(true);
        updateIndicatorPosition(distanceToRefresh);

        try {
          await onRefreshRef.current();
        } finally {
          // Smooth transition back to 0
          if (indicatorRef.current) {
            indicatorRef.current.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
          }

          setTimeout(() => {
            setIsRefreshing(false);
            setIsPulling(false);
            updateIndicatorPosition(0);
            currentPullDistance.current = 0;

            // Remove transition for next pull
            if (indicatorRef.current) {
              indicatorRef.current.style.transition = '';
            }
          }, 300);
        }
      } else {
        // Animate snap back
        if (indicatorRef.current) {
          indicatorRef.current.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        }

        updateIndicatorPosition(0);
        currentPullDistance.current = 0;

        setTimeout(() => {
          setIsPulling(false);
          if (indicatorRef.current) {
            indicatorRef.current.style.transition = '';
          }
        }, 300);
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
  }, [enabled, distanceToRefresh, updateIndicatorPosition]);

  return {
    isRefreshing,
    isPulling,
    indicatorRef,
  };
}
