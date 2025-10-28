/**
 * usePosts Hook
 * Custom hook for fetching and managing posts data with pagination
 */

import { useEffect, useState, useCallback, useRef } from 'react';
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

      if (reset) {
        setPosts(data);
      } else {
        setPosts(prev => [...prev, ...data]);
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
