/**
 * usePosts Hook
 * Custom hook for fetching and managing posts data with pagination
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { PostsService } from '@/services/posts.service';
import type { Post } from '@/types/post.types';
import { sqrtPriceX96ToPrice } from '@/lib/solana/sqrt-price-helpers';

interface UsePostsResult {
  posts: Post[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  updatePost: (postId: string, updates: Partial<Post>) => void;
}

const INITIAL_POSTS = 10; // Initial load for faster perceived performance (just fill screen)
const POSTS_PER_PAGE = 10; // Chunked loading for smooth scrolling

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0); // Use ref to avoid recreating callbacks
  const loadingMoreRef = useRef(false); // Use ref to avoid dependency issues
  const initialLoadDone = useRef(false); // Track if initial load is done

  const fetchPosts = useCallback(async (reset: boolean = false) => {
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
      // Use smaller initial load for faster page load
      const limit = reset ? INITIAL_POSTS : POSTS_PER_PAGE;
      const data = await PostsService.fetchPosts({
        limit,
        offset: currentOffset
      });

      // Filter out posts with < $1 market cap
      const filteredData = data.filter(post => {
        // If no pool deployed yet, keep the post
        if (!post.poolAddress) return true;

        // Get supplies in atomic units (micro-USDC, 6 decimals)
        const sLongAtomic = post.poolSupplyLong ?? 0;
        const sShortAtomic = post.poolSupplyShort ?? 0;

        // If no pool data available, keep the post
        if (sLongAtomic === 0 && sShortAtomic === 0) return true;

        // Convert to display units (USDC_PRECISION = 10^6)
        const USDC_PRECISION = 1000000;
        const sLongDisplay = sLongAtomic / USDC_PRECISION;
        const sShortDisplay = sShortAtomic / USDC_PRECISION;

        // Parse sqrt prices (handle different formats from DB)
        const sqrtPriceLongX96 = post.poolSqrtPriceLongX96
          ? (typeof post.poolSqrtPriceLongX96 === 'string'
              ? BigInt(post.poolSqrtPriceLongX96)
              : BigInt((post.poolSqrtPriceLongX96 as any).toString()))
          : BigInt(0);
        const sqrtPriceShortX96 = post.poolSqrtPriceShortX96
          ? (typeof post.poolSqrtPriceShortX96 === 'string'
              ? BigInt(post.poolSqrtPriceShortX96)
              : BigInt((post.poolSqrtPriceShortX96 as any).toString()))
          : BigInt(0);

        // Convert sqrt price to price using the proper helper function
        const priceLong = sqrtPriceLongX96 > BigInt(0) ? sqrtPriceX96ToPrice(sqrtPriceLongX96) : 0;
        const priceShort = sqrtPriceShortX96 > BigInt(0) ? sqrtPriceX96ToPrice(sqrtPriceShortX96) : 0;

        // Market cap = (supply_long × price_long) + (supply_short × price_short)
        // Supply is in display units (USDC), price is in USDC per token
        const marketCapLong = sLongDisplay * priceLong;
        const marketCapShort = sShortDisplay * priceShort;
        const totalMarketCap = marketCapLong + marketCapShort;

        // Filter out posts with < $1 market cap
        return totalMarketCap >= 1;
      });

      if (reset) {
        setPosts(filteredData);
      } else {
        setPosts(prev => [...prev, ...filteredData]);
      }

      // Has more if we got a full page
      setHasMore(data.length === limit);

      if (!reset) {
        offsetRef.current = currentOffset + data.length;
      } else {
        offsetRef.current = data.length;
      }
    } catch (err) {
      console.error('[usePosts]:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch posts'));
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []); // No dependencies - all state managed via refs

  // Function to update a single post in the list
  const updatePost = useCallback((postId: string, updates: Partial<Post>) => {
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? { ...post, ...updates }
          : post
      )
    );
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchPosts(true);
    }
  }, []);

  const refetch = useCallback(() => fetchPosts(true), [fetchPosts]);
  const loadMore = useCallback(() => fetchPosts(false), [fetchPosts]);

  return { posts, loading, error, refetch, loadMore, hasMore, loadingMore, updatePost };
}
