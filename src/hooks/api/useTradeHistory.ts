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
  const res = await fetch(url, {
    cache: 'no-store', // Disable browser caching for trade data
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    // Return empty data for 404s (pool not deployed yet) instead of throwing
    if (res.status === 404) {
      return {
        priceLongData: [],
        priceShortData: [],
        volumeData: [],
        stats: {
          totalVolume: 0,
          totalTrades: 0,
          volumeLong: 0,
          volumeShort: 0,
          currentPriceLong: 0,
          highestPriceLong: 0,
          lowestPriceLong: 0,
          priceChangeLong24h: 0,
          priceChangePercentLong24h: 0,
          currentPriceShort: 0,
          highestPriceShort: 0,
          lowestPriceShort: 0,
          priceChangeShort24h: 0,
          priceChangePercentShort24h: 0,
        },
      };
    }
    throw new Error(`Failed to fetch trade history: ${res.status} - ${errorText}`);
  }
  const data = await res.json();

  // Validate response with Zod schema
  try {
    return TradeHistoryResponseSchema.parse(data);
  } catch (validationError) {
    console.error('[useTradeHistory] Schema validation failed:', validationError);
    throw validationError;
  }
};

export function useTradeHistory(postId: string | undefined, timeRange: TimeRange = 'ALL') {
  const swrKey = postId ? `/api/posts/${postId}/trades?range=${timeRange}` : null;

  const { data, error, isLoading, mutate } = useSWR<TradeHistoryResponse>(
    swrKey,
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes
      revalidateOnFocus: false,
      dedupingInterval: 2000, // Short dedupe window to allow quick time range switches
      revalidateIfStale: true,
      revalidateOnMount: true,
      keepPreviousData: false, // Don't keep stale data when switching time ranges
    }
  );

  return {
    data,
    isLoading,
    error,
    refresh: () => mutate(undefined, { revalidate: true }),
  };
}
