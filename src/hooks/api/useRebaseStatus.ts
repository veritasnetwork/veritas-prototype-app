/**
 * Hook to fetch rebase status information for a post
 * Returns unaccounted submissions count and cooldown status
 */

import useSWR from 'swr';

export interface RebaseStatus {
  canRebase: boolean;
  reason: string | null;
  unaccountedSubmissions: number;
  minRequiredSubmissions: number;
  cooldownRemaining: number; // seconds
  cooldownInterval: number; // seconds
  canRebaseTime: string | null; // ISO timestamp
  currentEpoch: number;
  nextEpoch: number;
}

async function fetchRebaseStatus(url: string): Promise<RebaseStatus> {
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch rebase status');
  }

  return response.json();
}

export function useRebaseStatus(postId: string | undefined) {
  return useSWR<RebaseStatus>(
    postId ? `/api/posts/${postId}/rebase-status` : null,
    fetchRebaseStatus,
    {
      refreshInterval: 30000, // Refresh every 30 seconds (reduced from 5s to minimize RPC load)
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  );
}
