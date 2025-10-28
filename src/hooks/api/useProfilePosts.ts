/**
 * useProfilePosts Hook
 * Custom hook for fetching and managing user posts with pagination
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Post } from '@/types/post.types';

interface UseProfilePostsResult {
  posts: Post[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
}

const INITIAL_POSTS = 5; // Initial load for faster perceived performance
const POSTS_PER_PAGE = 5; // Chunked loading for smooth scrolling

export function useProfilePosts(username: string | null): UseProfilePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const prevUsernameRef = useRef<string | null>(null);

  const fetchPosts = useCallback(async (reset: boolean = false) => {
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
      const limit = reset ? INITIAL_POSTS : POSTS_PER_PAGE;

      const response = await fetch(
        `/api/users/${username}/profile?limit=${limit}&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();

      if (reset) {
        setPosts(data.recent_posts || []);
      } else {
        setPosts(prev => [...prev, ...(data.recent_posts || [])]);
      }

      // Update hasMore based on pagination info
      setHasMore(data.pagination?.hasMore || false);

      if (!reset) {
        offsetRef.current = currentOffset + (data.recent_posts?.length || 0);
      } else {
        offsetRef.current = data.recent_posts?.length || 0;
      }
    } catch (err) {
      console.error('[useProfilePosts]:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch posts'));
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [username]);

  useEffect(() => {
    if (username && username !== prevUsernameRef.current) {
      prevUsernameRef.current = username;
      fetchPosts(true);
    }
  }, [username, fetchPosts]);

  const refetch = useCallback(() => fetchPosts(true), [fetchPosts]);
  const loadMore = useCallback(() => fetchPosts(false), [fetchPosts]);

  return { posts, loading, error, refetch, loadMore, hasMore, loadingMore };
}
