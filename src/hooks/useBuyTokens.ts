import { useState } from 'react';
import { Connection } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { buildBuyTransaction } from '@/lib/solana/buy-transaction';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const PROGRAM_ID = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID || 'GMwWgtvi2USgPa7BeVhDhxGprwpWEAjLm6VTMYHmyxAu';

export function useBuyTokens() {
  const { wallet, address } = useSolanaWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buyTokens = async (postId: string, usdcAmount: number) => {
    if (!wallet || !address) {
      throw new Error('Wallet not connected');
    }

    if (!('signTransaction' in wallet)) {
      throw new Error('Wallet does not support signing transactions');
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🛒 Building buy transaction...', {
        postId,
        usdcAmount,
        buyer: address,
      });

      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

      // Build the transaction
      const transaction = await buildBuyTransaction({
        connection,
        buyer: address,
        postId,
        usdcAmount,
        programId: PROGRAM_ID,
      });

      console.log('✅ Transaction built, requesting signature...');

      // Sign the transaction
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      console.log('✅ Transaction signed, sending to network...');

      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      console.log('Transaction sent, signature:', signature);

      console.log('⏳ Confirming transaction...');
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('🎉 Buy completed! Transaction signature:', signature);

      return signature;
    } catch (err) {
      console.error('Buy tokens error:', err);

      // Check for insufficient funds error
      let errorMessage = 'Failed to buy tokens';
      if (err instanceof Error && err.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient USDC balance. You need test USDC to buy tokens on localnet.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      const error = new Error(errorMessage);
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    buyTokens,
    isLoading,
    error,
  };
}
