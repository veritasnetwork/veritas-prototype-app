/**
 * useHoldings Hook
 * Custom hook for fetching and managing user holdings with pagination
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface HoldingData {
  token_type: 'LONG' | 'SHORT';
  post: {
    id: string;
    post_type: string;
    content_text?: string;
    caption?: string;
    media_urls?: string[];
    cover_image_url?: string;
    article_title?: string;
    user_id: string;
    created_at: string;
    total_volume_usdc: number;
    token_volume_usdc: number;
    author: {
      username: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  pool: {
    pool_address: string;
    supply_long: number;
    supply_short: number;
    price_long: number;
    price_short: number;
    is_settled?: boolean;
    settled_relevance?: number;
  };
  holdings: {
    token_balance: number;
    current_value_usdc: number;
    total_usdc_spent: number;
    total_usdc_received: number;
    belief_lock: number;
    current_price: number;
    entry_price?: number;
  };
}

interface UseHoldingsResult {
  holdings: HoldingData[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
}

const INITIAL_HOLDINGS = 5; // Initial load for faster perceived performance
const HOLDINGS_PER_PAGE = 5; // Chunked loading for smooth scrolling

export function useHoldings(username: string | null): UseHoldingsResult {
  const [holdings, setHoldings] = useState<HoldingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const prevUsernameRef = useRef<string | null>(null);

  const fetchHoldings = useCallback(async (reset: boolean = false) => {
    if (!username) {
      setLoading(false);
      return;
    }

    try {
      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        if (loadingMoreRef.current) return; // Prevent duplicate calls
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      setError(null);

      const currentOffset = reset ? 0 : offsetRef.current;
      const limit = reset ? INITIAL_HOLDINGS : HOLDINGS_PER_PAGE;

      const response = await fetch(
        `/api/users/${username}/holdings?limit=${limit}&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch holdings');
      }

      const data = await response.json();

      if (reset) {
        setHoldings(data.holdings || []);
      } else {
        setHoldings(prev => [...prev, ...(data.holdings || [])]);
      }

      // Update hasMore based on pagination info
      setHasMore(data.pagination?.hasMore || false);

      if (!reset) {
        offsetRef.current = currentOffset + (data.holdings?.length || 0);
      } else {
        offsetRef.current = data.holdings?.length || 0;
      }
    } catch (err) {
      console.error('[useHoldings]:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch holdings'));
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [username]);

  useEffect(() => {
    if (username && username !== prevUsernameRef.current) {
      prevUsernameRef.current = username;
      fetchHoldings(true);
    }
  }, [username, fetchHoldings]);

  const refetch = useCallback(() => fetchHoldings(true), [fetchHoldings]);
  const loadMore = useCallback(() => fetchHoldings(false), [fetchHoldings]);

  return { holdings, loading, error, refetch, loadMore, hasMore, loadingMore };
}
