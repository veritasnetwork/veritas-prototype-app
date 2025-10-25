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
  updatePost: (postId: string, updates: Partial<Post>) => void;
}

const INITIAL_POSTS = 5; // Initial load for faster perceived performance
const POSTS_PER_PAGE = 5; // Chunked loading for smooth scrolling

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
    fetchPosts(true);
  }, []);

  const refetch = useCallback(() => fetchPosts(true), []);
  const loadMore = useCallback(() => fetchPosts(false), [offset]);

  return { posts, loading, error, refetch, loadMore, hasMore, loadingMore, updatePost };
}
