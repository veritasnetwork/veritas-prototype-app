/**
 * useRequireAuth Hook
 *
 * Provides a function to check if user is authenticated and trigger login if not.
 * Use this for actions that require authentication (trading, creating posts, etc.)
 */

import { useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';

export function useRequireAuth() {
  const { user, isLoading: authLoading } = useAuth();
  const { authenticated, ready, login } = usePrivy();

  /**
   * Check if user is authenticated. If not, trigger login modal.
   * @returns true if authenticated, false if login was triggered
   */
  const requireAuth = useCallback(async (): Promise<boolean> => {
    // Wait for Privy to be ready
    if (!ready) {
      console.warn('[useRequireAuth] Privy not ready yet');
      return false;
    }

    // Check if user is authenticated with Privy
    if (!authenticated) {
      login();
      return false;
    }

    // Check if user has completed onboarding (has app user profile)
    if (!user && !authLoading) {
      // User will see onboarding modal automatically via AuthProvider
      return false;
    }

    // User is fully authenticated and onboarded
    return true;
  }, [ready, authenticated, user, authLoading, login]);

  return {
    requireAuth,
    isAuthenticated: authenticated && !!user,
    isLoading: !ready || authLoading,
  };
}
