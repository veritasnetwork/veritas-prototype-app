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
      console.log('[usePosts] Fetching posts from API...');
      const data = await PostsService.fetchPosts();
      console.log('[usePosts] Received posts:', data.length, 'posts');
      data.forEach((post, idx) => {
        console.log(`[usePosts] Post ${idx}:`, {
          id: post.id,
          title: post.title,
          poolAddress: post.poolAddress,
          poolTokenSupply: post.poolTokenSupply,
          poolReserveBalance: post.poolReserveBalance,
          poolKQuadratic: post.poolKQuadratic,
        });
      });
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