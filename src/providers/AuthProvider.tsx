'use client';

import { PrivyProvider, usePrivy as useRealPrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrivyErrorBoundary } from '@/components/auth/PrivyErrorBoundary';
import { getRpcEndpoint, getNetworkName } from '@/lib/solana/network-config';
import {
  MockPrivyProvider,
  usePrivy as useMockPrivy,
  useWallets as useMockWallets,
  useSolanaWallets as useMockSolanaWallets,
} from './MockPrivyProvider';

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
  needsOnboarding: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
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

// Determine which usePrivy to use based on mock mode
const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
const usePrivy = isMockMode ? useMockPrivy : useRealPrivy;

// Export usePrivy for use in other components
export { usePrivy };

function AuthProviderInner({ children }: AuthProviderProps) {
  const { authenticated, ready, getAccessToken, logout: privyLogout, user: privyUser } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const checkUserStatus = async (retryCount = 0) => {
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
      ) as any;

      const solanaAddress = solanaWallet?.address as string | undefined;

      if (!solanaAddress) {
        // Wallet might still be creating, retry up to 5 times with 500ms delay
        if (retryCount < 5) {
          console.log(`Waiting for Solana wallet creation... (attempt ${retryCount + 1}/5)`);
          setTimeout(() => checkUserStatus(retryCount + 1), 500);
          return;
        }
        console.error('No Solana wallet found for user after retries');
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
          setNeedsOnboarding(false);
        } else if (data.needsOnboarding) {
          setUser(null);
          setNeedsOnboarding(true);
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
    setNeedsOnboarding(false);
    privyLogout();
  };

  const refreshUser = async () => {
    await checkUserStatus();
  };

  useEffect(() => {
    if (!ready) {
      return; // Wait for Privy to be ready
    }

    if (authenticated) {
      // Check auth status whenever user becomes authenticated and Privy is ready
      checkUserStatus();
    } else {
      // Not authenticated - clear state
      setIsLoading(false);
      setUser(null);
      setNeedsOnboarding(false);
    }
  }, [authenticated, ready]);

  const authValue: AuthContextValue = {
    user,
    isLoading,
    needsOnboarding,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Use mock auth if enabled (for when Privy is down)
  if (process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true') {
    return (
      <MockPrivyProvider>
        <AuthProviderInner>{children}</AuthProviderInner>
      </MockPrivyProvider>
    );
  }

  // Configure Solana wallet connectors
  const solanaConnectors = toSolanaWalletConnectors({
    shouldAutoConnect: false, // Disable auto-connect to prevent modal on every navigation
  });

  // Get Solana network configuration from environment
  const networkName = getNetworkName();
  const rpcEndpoint = getRpcEndpoint();

  // Map localnet to devnet for Privy (Privy doesn't support custom networks)
  // But we'll use the actual localnet RPC endpoint
  const privyNetworkName = networkName === 'localnet' ? 'devnet' : networkName;


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
            // Show wallet as primary option in modals
            walletList: ['detected_solana_wallets' as any, 'privy'],
            // App branding for wallet identification
            logo: 'https://app.veritas.computer/icons/logo.png',
            landingHeader: 'Welcome to Veritas',
            loginMessage: 'Sign in to Veritas to start trading prediction markets',
          },
          // Use loginMethodsAndOrder instead of loginMethods for better control
          loginMethodsAndOrder: {
            primary: ['detected_solana_wallets', 'email'],
            overflow: ['apple'],
          },
          embeddedWallets: {
            createOnLogin: 'all-users', // Always create embedded wallet
            requireUserPasswordOnCreate: false,
          },
          fundingMethodConfig: {
            moonpay: {
              useSandbox: false,
            },
          },
          // Use devnet as cluster name but with custom RPC for localnet
          // Privy only recognizes: mainnet-beta, devnet, testnet
          solanaClusters: [
            {
              name: privyNetworkName as any,
              rpcUrl: rpcEndpoint,
            },
          ],
          externalWallets: {
            solana: {
              connectors: solanaConnectors, // Enable Solana wallet detection
            },
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