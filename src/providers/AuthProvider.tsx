'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrivyErrorBoundary } from '@/components/auth/PrivyErrorBoundary';

interface User {
  id: string;
  agent_id: string;
  auth_id: string;
  auth_provider: string;
}

interface AuthContextValue {
  user: User | null;
  hasAccess: boolean;
  needsInvite: boolean;
  isLoading: boolean;
  activateInvite: (code: string) => Promise<{ success: boolean; error?: string }>;
  joinWaitlist: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

function AuthProviderInner({ children }: AuthProviderProps) {
  const { authenticated, ready, getAccessToken, logout: privyLogout } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [needsInvite, setNeedsInvite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkUserStatus = async () => {
    console.log('checkUserStatus called - ready:', ready, 'authenticated:', authenticated);

    // Don't check if Privy isn't ready or user isn't authenticated
    if (!ready || !authenticated) {
      console.log('Not ready or not authenticated, skipping check');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      console.log('Getting access token...');
      const jwt = await getAccessToken();

      if (!jwt) {
        console.log('No JWT available');
        setIsLoading(false);
        return;
      }

      // Use proxy endpoint to avoid CORS issues
      const endpoint = '/api/supabase/functions/v1/app-auth-status';
      console.log('Checking auth status...');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }).catch((error) => {
        console.error('Network error during auth check:', error);
        return null;
      });

      if (!response) {
        console.warn('Could not reach auth endpoint');
        setIsLoading(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setHasAccess(data.has_access);
        setNeedsInvite(data.needs_invite);
        if (data.user) {
          setUser(data.user);
        }
      } else if (response.status === 401) {
        // User needs to activate invite
        console.log('User needs invite activation');
        setNeedsInvite(true);
        setHasAccess(false);
      } else {
        console.error('Auth check error:', response.status);
        setNeedsInvite(true);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activateInvite = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const jwt = await getAccessToken();
      if (!jwt) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch('/api/supabase/functions/v1/app-auth-activate-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setHasAccess(true);
        setNeedsInvite(false);
        return { success: true };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const joinWaitlist = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/supabase/functions/v1/app-auth-waitlist-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    setUser(null);
    setHasAccess(false);
    setNeedsInvite(false);
    privyLogout();
  };

  useEffect(() => {
    if (ready) {
      checkUserStatus();
    }
  }, [authenticated, ready]);

  const authValue: AuthContextValue = {
    user,
    hasAccess,
    needsInvite,
    isLoading,
    activateInvite,
    joinWaitlist,
    logout,
  };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <PrivyErrorBoundary>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
        config={{
          appearance: {
            theme: 'light',
            accentColor: '#676FFF',
          },
          loginMethods: ['email', 'apple', 'wallet'],
        }}
      >
        <AuthProviderInner>
          {children}
        </AuthProviderInner>
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}