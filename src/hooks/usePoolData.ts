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

    setLoading(true);

    // Subscribe to pool data updates
    const unsubscribe = poolDataService.subscribe(postId, (data) => {
      setPoolData(data);
      setLoading(false);
      setError(data === null ? new Error('No pool data available') : null);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [postId, poolAddress]); // keep poolAddress to trigger resubscribe if it changes

  return { poolData, loading, error };
}
