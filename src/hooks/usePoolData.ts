/**
 * Hook to fetch ICBS pool data using centralized PoolDataService
 * - Efficient: single fetch per pool across all components
 * - Auto-polling with adaptive intervals (3s active, 10s normal, 30s idle)
 * - Event-based invalidation on trades
 * - Automatic cleanup when unmounted
 */

import { useEffect, useState, useRef } from 'react';
import { poolDataService, PoolData } from '@/services/PoolDataService';

export type { PoolData };

export function usePoolData(poolAddress: string | undefined, postId: string | undefined, initialData?: PoolData | null) {
  const [poolData, setPoolData] = useState<PoolData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData); // Start as loaded if we have initial data
  const [error, setError] = useState<Error | null>(null);
  const postIdRef = useRef(postId);

  useEffect(() => {
    if (!postId) {
      setPoolData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Only reset state if postId actually changed (not on every render)
    const postIdChanged = postIdRef.current !== postId;
    if (postIdChanged) {
      postIdRef.current = postId;
      // Only reset if we don't have initial data
      if (!initialData) {
        setPoolData(null);
        setLoading(true);
      }
    }

    let isSubscribed = true; // Prevent state updates after unmount

    // Subscribe to pool data updates, pass initial data if available
    const unsubscribe = poolDataService.subscribe(postId, (data) => {
      if (!isSubscribed) {
        return;
      }
      setPoolData(data);
      setLoading(false);
      setError(data === null ? new Error('No pool data available') : null);
    }, initialData);

    // Cleanup on unmount
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [postId]); // Only resubscribe when postId changes

  return { poolData, loading, error };
}
