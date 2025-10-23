import { usePrivy, useWallets, useSolanaWallets } from '@/hooks/usePrivyHooks';
import { useMemo, useEffect, useState } from 'react';

export interface SolanaWallet {
  address: string;
  chainType: 'solana';
  walletClientType: string;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions?: (transactions: any[]) => Promise<any[]>;
}

// Helper function to check if address is a valid Solana address
const isSolanaAddress = (address: string): boolean => {
  // Solana addresses are base58 encoded and typically 32-44 characters
  // They never start with "0x" (which is Ethereum format)
  if (!address || address.startsWith('0x')) {
    return false;
  }
  // Basic length check for Solana addresses
  return address.length >= 32 && address.length <= 44;
};

/**
 * Hook to get the user's connected Solana wallet from Privy.
 * Uses Privy's Solana-specific wallet hook for better compatibility.
 */
export function useSolanaWallet() {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const { wallets: allWallets, ready: walletsReady } = useWallets();
  const { wallets: solanaWallets, ready: solanaWalletsReady } = useSolanaWallets();
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  // Retry initialization every 500ms for up to 10 seconds when we detect a linked wallet that isn't ready
  useEffect(() => {
    if (!ready || !authenticated) return;

    const hasLinkedWallet = privyUser?.linkedAccounts?.some(
      (account: any) =>
        account.type === 'wallet' &&
        account.chainType === 'solana' &&
        isSolanaAddress(account.address)
    );

    const hasUsableWallet = (solanaWallets && solanaWallets.length > 0) ||
                           (allWallets && allWallets.some((w: any) => isSolanaAddress(w.address)));

    if (hasLinkedWallet && !hasUsableWallet && initializationAttempts < 20) {
      const timer = setTimeout(() => {
        console.log('[useSolanaWallet] Retrying wallet initialization, attempt:', initializationAttempts + 1);
        setInitializationAttempts(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ready, authenticated, privyUser, solanaWallets, allWallets, initializationAttempts]);

  const solanaWallet = useMemo(() => {
    if (!ready || !authenticated) {
      console.log('[useSolanaWallet] Not ready or not authenticated');
      return undefined;
    }

    // Debug: Log full Privy state
    console.log('[useSolanaWallet] ═══ FULL DEBUG ═══');
    console.log('Ready states:', { ready, authenticated, walletsReady, solanaWalletsReady });
    console.log('LinkedAccounts:', privyUser?.linkedAccounts?.map((a: any) => ({
      type: a.type,
      chainType: a.chainType,
      walletClient: a.walletClient,
      walletClientType: a.walletClientType,
      address: a.address,
    })));
    console.log('solanaWallets array:', solanaWallets);
    console.log('allWallets array:', allWallets);
    console.log('solanaWallets details:', solanaWallets?.map((w: any) => ({
      address: w.address,
      chainType: w.chainType,
      walletClientType: w.walletClientType,
      hasSignTransaction: !!w.signTransaction,
      hasSignAllTransactions: !!w.signAllTransactions,
    })));
    console.log('allWallets details:', allWallets?.map((w: any) => ({
      address: w.address,
      chainType: w.chainType,
      walletClientType: w.walletClientType,
      hasSignTransaction: !!w.signTransaction,
      hasSignAllTransactions: !!w.signAllTransactions,
    })));
    console.log('═════════════════════');

    // IMPORTANT: Wait for wallets to be ready before checking
    // This prevents false negatives when page first loads
    if (!walletsReady && !solanaWalletsReady) {
      console.log('[useSolanaWallet] Wallets not ready yet, waiting...');
      return undefined;
    }

    // First try Privy's Solana-specific wallets hook
    if (solanaWallets && solanaWallets.length > 0) {
      const wallet = solanaWallets[0];
      if (isSolanaAddress(wallet.address)) {
        console.log('[useSolanaWallet] ✅ Found Solana wallet from useSolanaWallets:', wallet.address);
        return wallet;
      }
    }

    // Fallback to general wallets array, but filter for Solana only
    if (allWallets && allWallets.length > 0) {
      const solanaWallet = allWallets.find((w: any) =>
        isSolanaAddress(w.address) || w.chainType === 'solana'
      );
      if (solanaWallet && solanaWallet.signTransaction) {
        console.log('[useSolanaWallet] ✅ Found Solana wallet from useWallets:', solanaWallet.address);
        return solanaWallet;
      }
    }

    // Check if user has a Solana wallet in linkedAccounts but not connected
    const hasLinkedSolanaWallet = privyUser?.linkedAccounts?.some(
      (account: any) =>
        account.type === 'wallet' &&
        account.chainType === 'solana' &&
        isSolanaAddress(account.address)
    );

    if (hasLinkedSolanaWallet) {
      console.log('[useSolanaWallet] ⚠️  Solana wallet linked but not connected - needs reconnection');
    } else {
      console.log('[useSolanaWallet] ⚠️  No Solana wallet found');
    }

    return undefined;
  }, [ready, authenticated, walletsReady, solanaWalletsReady, allWallets, solanaWallets, privyUser]);

  // Reset retry counter when wallet becomes available
  useEffect(() => {
    if (solanaWallet) {
      setInitializationAttempts(0);
    }
  }, [solanaWallet]);

  // Determine if we're still loading wallet state
  const hasLinkedSolanaAccount = privyUser?.linkedAccounts?.some(
    (account: any) =>
      account.type === 'wallet' &&
      account.chainType === 'solana' &&
      isSolanaAddress(account.address)
  );

  // Loading only if wallets hooks aren't ready yet
  // Once they're ready, we stop loading even if wallet isn't connected
  const isLoading = ready && authenticated && (!walletsReady && !solanaWalletsReady);

  // Needs reconnection if: wallets are ready, has linked account, but no active wallet
  const needsReconnection = ready && authenticated && walletsReady && solanaWalletsReady && hasLinkedSolanaAccount && !solanaWallet;

  return {
    wallet: solanaWallet as SolanaWallet | undefined,
    address: solanaWallet?.address,
    isConnected: !!solanaWallet,
    isLoading,
    needsReconnection, // NEW: explicitly flag when user needs to reconnect
  };
}
