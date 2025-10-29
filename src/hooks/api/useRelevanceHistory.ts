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
  console.log('[useRelevanceHistory] ========================================');
  console.log('[useRelevanceHistory] 🔍 FETCHING from:', urlWithParams);
  console.log('[useRelevanceHistory] 🕐 Timestamp:', new Date().toISOString());
  console.log('[useRelevanceHistory] ========================================');

  const res = await fetch(urlWithParams);
  if (!res.ok) {
    console.error('[useRelevanceHistory] ❌ Fetch failed with status:', res.status);
    if (res.status === 404) return { actualRelevance: [], impliedRelevance: [], rebaseEvents: [] };
    throw new Error('Failed to fetch relevance history');
  }

  const data = await res.json();
  const beliefHistory = (data.belief_history || []) as BeliefHistoryItem[];
  const impliedHistory = (data.implied_relevance_history || []) as ImpliedHistoryItem[];
  console.log('[useRelevanceHistory] ========================================');
  console.log('[useRelevanceHistory] 📊 FETCHED DATA:');
  console.log('[useRelevanceHistory] Belief history count:', beliefHistory.length);
  console.log('[useRelevanceHistory] Implied history count:', impliedHistory.length);
  console.log('[useRelevanceHistory] Latest implied entries:', impliedHistory.slice(-3)); // Show last 3
  console.log('[useRelevanceHistory] ========================================');

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

  console.log('[useRelevanceHistory] 🎯 Hook called:', { postId, swrKey });

  const { data, error, isLoading, mutate } = useSWR<RelevanceHistoryData>(
    swrKey,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every 60 seconds (same as trade history)
      revalidateOnFocus: false,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds to prevent duplicate calls
      revalidateIfStale: true, // Always revalidate stale data
      revalidateOnMount: true, // Always fetch on mount
      keepPreviousData: true, // Keep showing previous data while fetching (prevents loading flicker)
      loadingTimeout: 10000, // 10 second timeout to prevent hanging
      onLoadingSlow: () => {
        console.warn('[useRelevanceHistory] Slow loading detected for', postId);
      },
      onError: (err) => {
        console.error('[useRelevanceHistory] Error fetching relevance data:', err);
      },
    }
  );

  console.log('[useRelevanceHistory] 📦 Returning:', {
    hasData: !!data,
    isLoading,
    hasError: !!error,
    impliedCount: data?.impliedRelevance?.length,
    actualCount: data?.actualRelevance?.length,
  });

  return {
    data: data || { actualRelevance: [], impliedRelevance: [], rebaseEvents: [] },
    isLoading,
    error,
    refetch: () => {
      console.log('[useRelevanceHistory] 🔄 REFETCH called for postId:', postId);
      return mutate(undefined, { revalidate: true });
    },
  };
}
