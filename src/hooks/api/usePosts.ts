/**
 * usePosts Hook
 * Custom hook for fetching and managing posts data with pagination
 */

import { useEffect, useState, useCallback } from 'react';
import { PostsService } from '@/services/posts.service';
import type { Post } from '@/types/post.types';

interface UsePostsResult {
  posts: Post[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
}

const POSTS_PER_PAGE = 15;

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchPosts = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const currentOffset = reset ? 0 : offset;
      const data = await PostsService.fetchPosts({
        limit: POSTS_PER_PAGE,
        offset: currentOffset
      });

      if (reset) {
        setPosts(data);
      } else {
        setPosts(prev => [...prev, ...data]);
      }

      setHasMore(data.length === POSTS_PER_PAGE);

      if (!reset) {
        setOffset(currentOffset + data.length);
      } else {
        setOffset(data.length);
      }
    } catch (err) {
      console.error('[usePosts]:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch posts'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPosts(true);
  }, []);

  const refetch = useCallback(() => fetchPosts(true), []);
  const loadMore = useCallback(() => fetchPosts(false), [offset]);

  return { posts, loading, error, refetch, loadMore, hasMore, loadingMore };
}
