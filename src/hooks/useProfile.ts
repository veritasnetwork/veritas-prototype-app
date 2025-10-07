/**
 * useProfile Hook
 * Fetches user profile data including stats and recent posts
 */

import { useState, useEffect } from 'react';
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
  refetch: () => Promise<void>;
}

export function useProfile(username: string): UseProfileReturn {
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!username) {
      setError('Username is required');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${username}/profile`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load profile');
        }
        setData(null);
        setIsLoading(false);
        return;
      }

      const profileData = await response.json();
      setData(profileData);
      setError(null);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchProfile,
  };
}
