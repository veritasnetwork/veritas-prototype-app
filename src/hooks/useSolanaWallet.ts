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
  const allWalletsData = useWallets();
  const { wallets: allWallets, ready: walletsReady } = 'ready' in allWalletsData ? allWalletsData : { wallets: allWalletsData.wallets, ready: true };
  const solanaWalletsData = useSolanaWallets();
  const { wallets: solanaWallets, ready: solanaWalletsReady } = 'ready' in solanaWalletsData ? solanaWalletsData : { wallets: solanaWalletsData.wallets, ready: true };
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
        setInitializationAttempts(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ready, authenticated, privyUser, solanaWallets, allWallets, initializationAttempts]);

  const solanaWallet = useMemo(() => {
    if (!ready || !authenticated) {
      return undefined;
    }

    // Try to get wallet immediately if wallets arrays have data
    // Don't wait for ready flags if we already have wallet objects
    const hasWalletData = (solanaWallets && solanaWallets.length > 0) ||
                          (allWallets && allWallets.length > 0);

    // Only wait for ready flags if we have no wallet data yet
    if (!hasWalletData && !walletsReady && !solanaWalletsReady) {
      return undefined;
    }

    // Get the user's linked Solana wallet address from their Privy account
    const linkedSolanaAccount = privyUser?.linkedAccounts?.find(
      (account: any) =>
        account.type === 'wallet' &&
        account.chainType === 'solana' &&
        isSolanaAddress(account.address)
    );

    const expectedWalletAddress = (linkedSolanaAccount as any)?.address;

    // CRITICAL: Only return a wallet if it matches the user's linked wallet address
    // This prevents using an external wallet (like Phantom) when the user has an embedded wallet

    // First try Privy's Solana-specific wallets hook
    if (solanaWallets && solanaWallets.length > 0) {
      // If user has a linked wallet, find the matching one
      if (expectedWalletAddress) {
        const matchingWallet = solanaWallets.find((w: any) => w.address === expectedWalletAddress);
        if (matchingWallet) {
          return matchingWallet;
        }
      } else {
        // No linked wallet yet - return first available
        const wallet = solanaWallets[0];
        if (isSolanaAddress(wallet.address)) {
          return wallet;
        }
      }
    }

    // Fallback to general wallets array, but ONLY return if it matches the linked wallet
    if (allWallets && allWallets.length > 0) {
      if (expectedWalletAddress) {
        const matchingWallet = allWallets.find((w: any) => w.address === expectedWalletAddress);
        if (matchingWallet && (matchingWallet as any).signTransaction) {
          return matchingWallet as any;
        }
      } else {
        // No linked wallet yet - return first Solana wallet
        const solanaWallet = allWallets.find((w: any) =>
          isSolanaAddress(w.address) || w.chainType === 'solana'
        );
        if (solanaWallet && (solanaWallet as any).signTransaction) {
          return solanaWallet as any;
        }
      }
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
