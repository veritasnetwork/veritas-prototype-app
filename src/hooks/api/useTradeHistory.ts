import useSWR from 'swr';

export type TimeRange = '1H' | '24H' | '7D' | 'ALL';

export interface ChartDataPoint {
  time: number;
  value: number;
}

export interface VolumeDataPoint {
  time: number;
  value: number;
  color: string;
}

export interface TradeStats {
  totalVolume: number;
  totalTrades: number;
  highestPrice: number;
  lowestPrice: number;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
}

export interface TradeHistoryData {
  priceData: ChartDataPoint[];
  volumeData: VolumeDataPoint[];
  stats: TradeStats;
}

const fetcher = async (url: string): Promise<TradeHistoryData> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch trade history');
  }
  return res.json();
};

export function useTradeHistory(postId: string | undefined, timeRange: TimeRange = 'ALL') {
  const { data, error, isLoading, isValidating, mutate } = useSWR<TradeHistoryData>(
    postId ? `/api/posts/${postId}/trades?range=${timeRange}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false, // Disable focus revalidation to reduce unnecessary fetches
      dedupingInterval: 1000, // Further reduce deduping to 1 second
      revalidateIfStale: true, // Always revalidate stale data
      revalidateOnMount: true, // Always fetch on mount
      keepPreviousData: false, // Don't show stale data from different posts
    }
  );

  return {
    data,
    isLoading,
    error,
    refresh: mutate,
  };
}
