'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
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
  hasAccess: boolean;
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
  const { authenticated, ready, getAccessToken, logout: privyLogout } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

      const response = await fetch('/api/auth/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        setHasAccess(data.has_access);
        if (data.user) {
          setUser(data.user);
        }
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setHasAccess(false);
    privyLogout();
  };

  useEffect(() => {
    if (ready) {
      if (authenticated) {
        checkUserStatus();
      } else {
        setIsLoading(false);
        setHasAccess(false);
        setUser(null);
      }
    }
  }, [authenticated, ready]);

  const authValue: AuthContextValue = {
    user,
    hasAccess,
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
  const handleLoginSuccess = () => {
    console.log('Privy login successful');
  };

  return (
    <PrivyErrorBoundary>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
        onSuccess={handleLoginSuccess}
        config={{
          appearance: {
            theme: 'light',
            accentColor: '#676FFF',
            walletChainType: 'solana-only',
          },
          loginMethods: ['wallet', 'email', 'apple'],
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
            requireUserPasswordOnCreate: false,
            noPromptOnSignature: false,
          },
          externalWallets: {
            solana: {
              connectors: toSolanaWalletConnectors(),
            },
          },
        }}
      >
        <AuthProviderInner>
          {children}
        </AuthProviderInner>
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}