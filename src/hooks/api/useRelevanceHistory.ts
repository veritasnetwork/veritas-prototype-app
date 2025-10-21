import useSWR from 'swr';
import { ChartDataPoint } from '@/types/api';

interface BeliefHistoryItem {
  epoch: number;
  aggregate: number;
  recorded_at: string;
}

const fetcher = async (url: string): Promise<ChartDataPoint[]> => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error('Failed to fetch relevance history');
  }

  const data = await res.json();
  const beliefHistory = (data.belief_history || []) as BeliefHistoryItem[];

  // Transform to TradingView format
  return beliefHistory.map(item => ({
    time: Math.floor(new Date(item.recorded_at).getTime() / 1000),
    value: item.aggregate, // BD relevance score (0-1)
  }));
};

/**
 * Fetch relevance history for a post
 * OPTIMIZATION: Only fetches when postId is defined
 * Pass undefined to skip fetching (when chart type is "price")
 */
export function useRelevanceHistory(postId: string | undefined) {
  const { data, error, isLoading } = useSWR<ChartDataPoint[]>(
    postId ? `/api/posts/${postId}/history` : null, // ✅ Conditional fetch
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    data: data || [],
    isLoading,
    error
  };
}
