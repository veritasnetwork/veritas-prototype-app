/**
 * usePosts Hook
 * Custom hook for fetching and managing posts data
 */

import { useEffect, useState } from 'react';
import { PostsService } from '@/services/posts.service';
import type { Post } from '@/types/post.types';

interface UsePostsResult {
  posts: Post[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await PostsService.fetchPosts();
      setPosts(data);
    } catch (err) {
      console.error('[usePosts] Error fetching posts:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch posts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts,
  };
}