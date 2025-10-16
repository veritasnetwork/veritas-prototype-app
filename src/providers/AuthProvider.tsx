'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrivyErrorBoundary } from '@/components/auth/PrivyErrorBoundary';

export interface User {
  id: string;
  agent_id: string;
  auth_id: string;
  auth_provider: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
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
  const { authenticated, ready, getAccessToken, logout: privyLogout, user: privyUser } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);

  const checkUserStatus = async () => {
    if (!ready || !authenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const jwt = await getAccessToken();

      if (!jwt) {
        setIsLoading(false);
        return;
      }

      // Get Solana wallet address from Privy
      const solanaWallet = privyUser?.linkedAccounts?.find(
        (account: any) => account.type === 'wallet' && account.chainType === 'solana'
      );

      const solanaAddress = solanaWallet?.address;

      if (!solanaAddress) {
        console.error('No Solana wallet found for user');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/auth/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ solana_address: solanaAddress }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Auth status check failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });

        if (response.status === 500) {
          console.error('⚠️  Server error - Is Supabase running? Try: npx supabase start');
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);

      // Check if it's a network error (likely Supabase not running)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('⚠️  Network error - Is Supabase running? Try: npx supabase start');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    privyLogout();
  };

  useEffect(() => {
    if (ready) {
      if (authenticated) {
        // Debounce auth checks - only check once per 5 seconds
        const now = Date.now();
        if (now - lastCheckTime > 5000) {
          setLastCheckTime(now);
          checkUserStatus();
        }
      } else {
        setIsLoading(false);
        setUser(null);
      }
    }
  }, [authenticated, ready]);

  const authValue: AuthContextValue = {
    user,
    isLoading,
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
            walletChainType: 'solana-only',
            showWalletLoginFirst: false,
          },
          loginMethods: ['email', 'apple', 'wallet'],
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
            requireUserPasswordOnCreate: false,
            noPromptOnSignature: false,
          },
          // Disable WalletConnect to prevent redirects
          walletConnectCloudProjectId: undefined,
        }}
      >
        <AuthProviderInner>
          {children}
        </AuthProviderInner>
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}