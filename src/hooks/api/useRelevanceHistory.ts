import useSWR from 'swr';
import { ChartDataPoint } from '@/types/api';

interface BeliefHistoryItem {
  epoch: number;
  aggregate: number;
  recorded_at: string;
}

interface ImpliedHistoryItem {
  implied_relevance: number;
  recorded_at: string;
  event_type: string;
}

interface RelevanceHistoryData {
  actualRelevance: ChartDataPoint[];
  impliedRelevance: ChartDataPoint[];
  rebaseEvents: ChartDataPoint[];  // Settlement/rebase timestamps
}

const fetcher = async (url: string): Promise<RelevanceHistoryData> => {
  // Add query param to only fetch relevance data (skip price/trade data)
  const urlWithParams = `${url}?include=relevance`;

  const res = await fetch(urlWithParams);
  if (!res.ok) {
    if (res.status === 404) return { actualRelevance: [], impliedRelevance: [], rebaseEvents: [] };
    throw new Error('Failed to fetch relevance history');
  }

  const data = await res.json();
  const beliefHistory = (data.belief_history || []) as BeliefHistoryItem[];
  const impliedHistory = (data.implied_relevance_history || []) as ImpliedHistoryItem[];

  // Transform actual BD relevance to TradingView format
  const actualRelevance = beliefHistory.map(item => ({
    time: Math.floor(new Date(item.recorded_at).getTime() / 1000),
    value: item.aggregate, // BD relevance score (0-1)
  }));

  // Transform implied relevance to TradingView format
  const impliedRelevance = impliedHistory.map(item => ({
    time: Math.floor(new Date(item.recorded_at).getTime() / 1000),
    value: item.implied_relevance, // Market-implied relevance (0-1)
  }));

  // Extract rebase events (for visual markers)
  const rebaseEvents = impliedHistory
    .filter(item => item.event_type === 'rebase')
    .map(item => ({
      time: Math.floor(new Date(item.recorded_at).getTime() / 1000),
      value: item.implied_relevance,
    }));

  return {
    actualRelevance,
    impliedRelevance,
    rebaseEvents,
  };
};

/**
 * Fetch relevance history for a post
 * Returns both actual BD relevance and market-implied relevance
 * OPTIMIZATION: Only fetches when postId is defined
 * Pass undefined to skip fetching (when chart type is "price")
 */
export function useRelevanceHistory(postId: string | undefined) {
  const swrKey = postId ? `/api/posts/${postId}/history` : null;

  const { data, error, isLoading, mutate } = useSWR<RelevanceHistoryData>(
    swrKey,
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes (reduced from 60s)
      revalidateOnFocus: false,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds (increased from 5s)
      revalidateIfStale: true,
      revalidateOnMount: true,
      keepPreviousData: true,
      loadingTimeout: 10000,
      onError: (err) => {
        console.error('[useRelevanceHistory] Error:', err);
      },
    }
  );

  return {
    data: data || { actualRelevance: [], impliedRelevance: [], rebaseEvents: [] },
    isLoading,
    error,
    refetch: () => mutate(undefined, { revalidate: true }),
  };
}
