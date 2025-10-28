'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  total_stake: number;
  beliefs_created: number;
  beliefs_participated: number;
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('users')
        .select(`
          id,
          username,
          display_name,
          bio,
          avatar_url,
          beliefs_created,
          beliefs_participated,
          agents!inner(total_stake)
        `)
        .eq('id', user.id)
        .single();

      if (queryError) {
        throw queryError;
      }

      // Flatten the agents.total_stake into the profile object
      const profileData = {
        ...data,
        total_stake: (data.agents as any)?.total_stake || 0
      };
      delete (profileData as any).agents;

      setProfile(profileData);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
  };
}