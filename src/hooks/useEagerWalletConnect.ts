/**
 * useEagerWalletConnect Hook
 * Automatically reconnects linked wallets on app load
 * Persists user's preferred wallet choice across sessions
 */

import { useEffect, useRef } from 'react';
import { usePrivy, useConnectWallet, useSolanaWallets } from './usePrivyHooks';

const STORAGE_KEY = 'veritas_preferred_wallet_type';
const SESSION_KEY = 'veritas_wallet_connect_attempted';

export function useEagerWalletConnect() {
  const { ready, authenticated, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const solanaWalletsData = useSolanaWallets();
  const { wallets: solanaWallets, ready: solanaWalletsReady } = 'ready' in solanaWalletsData ? solanaWalletsData : { wallets: solanaWalletsData.wallets, ready: true };

  // Use sessionStorage to persist across page navigations but reset on new session
  const getHasAttempted = () => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  };

  const setHasAttempted = (value: boolean) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_KEY, String(value));
  };

  useEffect(() => {
    // Only run once per session
    if (!ready || !authenticated || getHasAttempted()) {
      return;
    }

    // Wait for wallets to be ready
    if (!solanaWalletsReady) {
      return;
    }

    // Check if user has any linked Solana wallets
    const linkedSolanaWallets = user?.linkedAccounts?.filter(
      (account: any) =>
        account.type === 'wallet' && account.chainType === 'solana'
    );

    if (!linkedSolanaWallets || linkedSolanaWallets.length === 0) {
      setHasAttempted(true); // Mark as attempted even if no linked wallets
      return;
    }

    // Check if wallet is already connected
    const hasConnectedWallet = solanaWallets && solanaWallets.length > 0;

    if (hasConnectedWallet) {
      // Wallet already connected, no need to show modal
      setHasAttempted(true); // Mark as attempted
      return;
    }

    // Get user's preferred wallet type from last session
    const preferredWalletType = localStorage.getItem(STORAGE_KEY);


    // Mark as attempted to prevent multiple connection attempts
    setHasAttempted(true);

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
  }, [ready, authenticated, solanaWalletsReady]);

  // Helper to save wallet preference (call this after successful connection)
  const saveWalletPreference = (walletType: string) => {
    localStorage.setItem(STORAGE_KEY, walletType);
  };

  return {
    saveWalletPreference,
  };
}