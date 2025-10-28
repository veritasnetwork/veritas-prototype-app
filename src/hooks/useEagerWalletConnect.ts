/**
 * useEagerWalletConnect Hook
 * Automatically reconnects linked wallets on app load
 * Persists user's preferred wallet choice across sessions
 */

import { useEffect, useRef } from 'react';
import { usePrivy, useConnectWallet } from './usePrivyHooks';

const STORAGE_KEY = 'veritas_preferred_wallet_type';

export function useEagerWalletConnect() {
  const { ready, authenticated, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const hasAttemptedConnection = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (!ready || !authenticated || hasAttemptedConnection.current) {
      return;
    }

    // Check if user has any linked Solana wallets
    const linkedSolanaWallets = user?.linkedAccounts?.filter(
      (account: any) =>
        account.type === 'wallet' && account.chainType === 'solana'
    );

    if (!linkedSolanaWallets || linkedSolanaWallets.length === 0) {
      return;
    }

    // Get user's preferred wallet type from last session
    const preferredWalletType = localStorage.getItem(STORAGE_KEY);


    // Mark as attempted to prevent multiple connection attempts
    hasAttemptedConnection.current = true;

    // Attempt to reconnect the wallet
    const attemptReconnect = async () => {
      try {

        // This will show Privy modal with the linked wallet(s)
        // If user previously connected Phantom and it's still available,
        // it should auto-select or show Phantom as the primary option
        await connectWallet();

      } catch (error: any) {
        // User might have cancelled or wallet not available

        // Don't show error to user - this is expected if:
        // - User cancelled
        // - Wallet extension not available
        // - Wallet locked
      }
    };

    // Small delay to let everything initialize
    const timer = setTimeout(attemptReconnect, 1000);
    return () => clearTimeout(timer);
  }, [ready, authenticated, user, connectWallet]);

  // Helper to save wallet preference (call this after successful connection)
  const saveWalletPreference = (walletType: string) => {
    localStorage.setItem(STORAGE_KEY, walletType);
  };

  return {
    saveWalletPreference,
  };
}