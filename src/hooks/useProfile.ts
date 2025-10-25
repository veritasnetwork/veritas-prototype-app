/**
 * useProfile Hook
 * Fetches user profile data including stats and recent posts
 * Now uses SWR for automatic caching and revalidation
 */

import useSWR from 'swr';
import type { Post } from '@/types/post.types';

export interface ProfileData {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    solana_address?: string;
  };
  stats: {
    total_stake: number;
    total_posts: number;
  };
  recent_posts: Post[];
}

interface UseProfileReturn {
  data: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  mutate: () => void;
}

const fetcher = async (url: string): Promise<ProfileData> => {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('User not found');
    }
    throw new Error('Failed to load profile');
  }

  return response.json();
};

export function useProfile(username: string): UseProfileReturn {
  const { data, error, isLoading, mutate } = useSWR<ProfileData>(
    username ? `/api/users/${username}/profile` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // Cache for 10 seconds
      revalidateOnMount: true,
      loadingTimeout: 10000, // 10 second timeout
      errorRetryCount: 1, // Only retry once
      shouldRetryOnError: false, // Don't retry on 404
      onLoadingSlow: () => {
        console.warn('[useProfile] Slow loading detected for:', username);
      },
    }
  );

  return {
    data: data || null,
    isLoading,
    error: error?.message || null,
    mutate,
  };
}
