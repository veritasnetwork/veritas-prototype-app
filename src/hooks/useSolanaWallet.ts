import { useWallets, useSolanaWallets } from '@privy-io/react-auth';
import { useMemo } from 'react';

export interface SolanaWallet {
  address: string;
  chainType: 'solana';
  walletClientType: string;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions?: (transactions: any[]) => Promise<any[]>;
}

/**
 * Hook to get the user's connected Solana wallet from Privy.
 * Uses Privy's useSolanaWallets hook for proper Solana wallet support.
 */
export function useSolanaWallet() {
  const { wallets: solanaWallets } = useSolanaWallets();

  const solanaWallet = useMemo(() => {
    // Get the first Solana wallet (embedded or external)
    return solanaWallets[0];
  }, [solanaWallets]);

  return {
    wallet: solanaWallet as SolanaWallet | undefined,
    address: solanaWallet?.address,
    isConnected: !!solanaWallet,
  };
}
