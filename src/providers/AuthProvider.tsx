'use client';

import { PrivyProvider, usePrivy as useRealPrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrivyErrorBoundary } from '@/components/auth/PrivyErrorBoundary';
import { getRpcEndpoint, getNetworkName } from '@/lib/solana/network-config';
import { useEagerWalletConnect, clearWalletConnectionAttempt } from '@/hooks/useEagerWalletConnect';
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
  const [initializing, setInitializing] = useState(true);
  const hasCheckedInitialAuth = useRef(false);

  // Use eager wallet connection hook to auto-reconnect wallets after page reload
  useEagerWalletConnect();

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
        // Wallet might still be creating, retry up to 10 times with 300ms delay (total 3 seconds)
        if (retryCount < 10) {
          console.log(`Waiting for Solana wallet creation... (attempt ${retryCount + 1}/10)`);
          setTimeout(() => checkUserStatus(retryCount + 1), 300);
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
    clearWalletConnectionAttempt(); // Clear wallet reconnection flag on logout
    privyLogout();
  };

  const refreshUser = async () => {
    await checkUserStatus();
  };

  useEffect(() => {
    if (!ready) {
      return; // Wait for Privy to be ready
    }

    // Mark that we've done initial auth check
    if (!hasCheckedInitialAuth.current) {
      hasCheckedInitialAuth.current = true;
    }

    // Privy is ready, end initialization phase
    setInitializing(false);

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
      {initializing ? (
        <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            {/* Modern circular loader */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-[#2a2a2a] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-[#B9D9EB] rounded-full animate-spin"></div>
            </div>

            {/* Animated dots */}
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-sm">Loading</span>
              <div className="flex gap-0.5">
                <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1 h-1 bg-[#B9D9EB] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
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
    shouldAutoConnect: true, // Enable auto-reconnection for external wallets like Phantom
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
            loginMessage: 'Use your passkey for instant secure login, or choose another method',
          },
          // prettier-ignore
          // Note: passkey not supported in loginMethodsAndOrder yet, using loginMethods
          loginMethods: ['passkey', 'email', 'wallet'],
          embeddedWallets: {
            createOnLogin: 'all-users', // Always create embedded wallet
            requireUserPasswordOnCreate: false,
            priceDisplay: {
              primary: 'native-token',
            },
          },
          fundingMethodConfig: {
            moonpay: {
              useSandbox: false,
            },
          },
          // Optimize initialization speed
          mfaNoPromptOnMfaRequired: false,
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