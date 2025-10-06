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

  console.log('=== useSolanaWallet Debug ===');
  console.log('Solana wallets found:', solanaWallets.length);
  solanaWallets.forEach((w, i) => {
    console.log(`\nSolana Wallet ${i}:`, {
      address: w.address,
      walletClientType: w.walletClientType,
      connectorType: w.connectorType,
      canSignTransactions: !!w.signTransaction,
    });
  });

  const solanaWallet = useMemo(() => {
    console.log('\n🔍 Searching for Solana wallet...');

    // Get the first Solana wallet (embedded or external)
    const wallet = solanaWallets[0];

    if (wallet) {
      console.log('✅ Found Solana wallet:', wallet.address);
      console.log('   Wallet type:', wallet.walletClientType);
      console.log('   Connector:', wallet.connectorType);
      return wallet;
    }

    console.log('❌ No Solana wallet found');
    return undefined;
  }, [solanaWallets]);

  const result = {
    wallet: solanaWallet as SolanaWallet | undefined,
    address: solanaWallet?.address,
    isConnected: !!solanaWallet,
  };

  console.log('\n📦 useSolanaWallet result:', {
    hasWallet: !!result.wallet,
    address: result.address || 'NONE',
    isConnected: result.isConnected,
  });
  console.log('=== End useSolanaWallet Debug ===\n');

  return result;
}
