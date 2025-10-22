import useSWR from 'swr';
import {
  TradeHistoryResponse,
  TradeHistoryResponseSchema,
  ChartDataPoint,
  VolumeDataPoint,
  TradeStats
} from '@/types/api';

export type TimeRange = '1H' | '24H' | '7D' | 'ALL';

// Re-export types for backward compatibility
export type { ChartDataPoint, VolumeDataPoint, TradeStats };

// Legacy type alias for backward compatibility
export type TradeHistoryData = TradeHistoryResponse;

const fetcher = async (url: string): Promise<TradeHistoryResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    // Return empty data for 404s (pool not deployed yet) instead of throwing
    if (res.status === 404) {
      return {
        priceData: [],
        volumeData: [],
        stats: {
          totalVolume: 0,
          totalTrades: 0,
          highestPrice: 0,
          lowestPrice: 0,
          priceChange24h: 0,
          priceChangePercent24h: 0,
        },
      };
    }
    throw new Error('Failed to fetch trade history');
  }
  const data = await res.json();

  // Validate response with Zod schema
  return TradeHistoryResponseSchema.parse(data);
};

export function useTradeHistory(postId: string | undefined, timeRange: TimeRange = 'ALL') {
  const { data, error, isLoading, isValidating, mutate } = useSWR<TradeHistoryResponse>(
    postId ? `/api/posts/${postId}/trades?range=${timeRange}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false, // Disable focus revalidation to reduce unnecessary fetches
      dedupingInterval: 1000, // Further reduce deduping to 1 second
      revalidateIfStale: true, // Always revalidate stale data
      revalidateOnMount: true, // Always fetch on mount
      keepPreviousData: true, // Show previous chart while loading new timeframe
    }
  );

  return {
    data,
    isLoading,
    error,
    refresh: mutate,
  };
}
