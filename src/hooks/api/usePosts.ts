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
  const fetchInProgress = useRef(false); // Prevent concurrent fetches

  const fetchPosts = useCallback(async (reset: boolean = false) => {
    // Prevent concurrent fetches
    if (fetchInProgress.current) {
      console.log('[usePosts] Fetch already in progress, skipping');
      return;
    }

    try {
      fetchInProgress.current = true;

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

      console.log('[usePosts] Received from PostsService:', data.length, 'posts');

      // No market cap filtering - show all posts
      const filteredData = data;

      console.log('[usePosts] After filtering:', filteredData.length, 'posts');

      if (reset) {
        console.log('[usePosts] Setting posts (reset):', filteredData.length);
        setPosts(filteredData);
      } else {
        console.log('[usePosts] Appending posts:', filteredData.length);
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
      console.error('[usePosts] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch posts'));
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      fetchInProgress.current = false;
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
      console.log('[usePosts] Starting initial load');
      initialLoadDone.current = true;
      fetchPosts(true);
    }
  }, []);

  const refetch = useCallback(() => fetchPosts(true), [fetchPosts]);
  const loadMore = useCallback(() => fetchPosts(false), [fetchPosts]);

  return { posts, loading, error, refetch, loadMore, hasMore, loadingMore, updatePost };
}
