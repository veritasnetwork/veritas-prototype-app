/**
 * Hook to fetch ICBS pool data using centralized PoolDataService
 * - Efficient: single fetch per pool across all components
 * - Auto-polling with adaptive intervals (3s active, 10s normal, 30s idle)
 * - Event-based invalidation on trades
 * - Automatic cleanup when unmounted
 */

import { useEffect, useState } from 'react';
import { poolDataService, PoolData } from '@/services/PoolDataService';

export type { PoolData };

export function usePoolData(poolAddress: string | undefined, postId: string | undefined) {
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!postId) {
      setPoolData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Reset state for new subscription
    setPoolData(null);
    setLoading(true);

    // Track if we received data synchronously (from cache)
    let receivedDataSync = false;
    let isSubscribed = true; // Prevent state updates after unmount

    // Subscribe to pool data updates
    const unsubscribe = poolDataService.subscribe(postId, (data) => {
      if (!isSubscribed) {
        return;
      }
      setPoolData(data);
      setLoading(false);
      setError(data === null ? new Error('No pool data available') : null);
      receivedDataSync = true;
    });

    // If we didn't get data synchronously, keep loading state
    // (already set above)

    // Cleanup on unmount
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [postId]); // Remove poolAddress from deps - only resubscribe when postId changes

  return { poolData, loading, error };
}
