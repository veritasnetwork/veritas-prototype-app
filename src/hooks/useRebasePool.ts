/**
 * useRebasePool Hook
 *
 * Handles rebasing a pool: triggers epoch processing + settlement
 * User signs the settlement transaction after server processes BD decomposition
 */

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'http://127.0.0.1:8899';

interface RebaseResult {
  success: true;
  transaction: string;
  beliefId: string;
  bdScore: number;
  poolAddress: string;
  currentEpoch: number;
  stakeChanges: {
    totalRewards: number;
    totalSlashes: number;
    participantCount: number;
  };
}

interface RebaseError {
  error: string;
  remainingSeconds?: number;
  minInterval?: number;
}

export function useRebasePool() {
  const { getAccessToken, user } = usePrivy();
  const [isRebasing, setIsRebasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rebasePool = async (postId: string): Promise<{
    success: boolean;
    txSignature?: string;
    bdScore?: number;
    stakeChanges?: RebaseResult['stakeChanges'];
    error?: string;
  }> => {
    setIsRebasing(true);
    setError(null);

    try {
      // Get wallet address from Privy embedded wallet
      const walletAddress = user?.wallet?.address;
      if (!walletAddress) {
        throw new Error('No wallet connected');
      }

      // Get auth token
      const authToken = await getAccessToken();
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      console.log('[useRebasePool] Calling /api/posts/[id]/rebase...');

      // Call rebase API
      const response = await fetch(`/api/posts/${postId}/rebase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) {
        const errorData: RebaseError = await response.json();

        // Handle cooldown error
        if (response.status === 429 && errorData.remainingSeconds) {
          const minutes = Math.floor(errorData.remainingSeconds / 60);
          const seconds = errorData.remainingSeconds % 60;
          throw new Error(`Cooldown active: ${minutes}m ${seconds}s remaining`);
        }

        throw new Error(errorData.error || 'Rebase failed');
      }

      const result: RebaseResult = await response.json();

      console.log('[useRebasePool] Rebase API success, signing transaction...');

      // Deserialize and send transaction
      const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
      const txBuffer = Buffer.from(result.transaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Get embedded wallet from Privy
      const embeddedWallet = user?.wallet;
      if (!embeddedWallet) {
        throw new Error('Embedded wallet not available');
      }

      // Request signature from user's embedded wallet
      console.log('[useRebasePool] Requesting wallet signature...');

      // Privy's embedded wallet provider
      const provider = await (embeddedWallet as any).getEthereumProvider?.();

      if (!provider || !provider.solana) {
        throw new Error('Solana provider not available from embedded wallet');
      }

      // Sign with Solana embedded wallet
      const solanaProvider = provider.solana;
      const signedTx = await solanaProvider.signTransaction(transaction);

      console.log('[useRebasePool] Transaction signed, sending...');

      // Send signed transaction
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());

      console.log('[useRebasePool] Transaction sent:', txSignature);

      // Wait for confirmation
      await connection.confirmTransaction(txSignature, 'confirmed');

      console.log('[useRebasePool] Transaction confirmed!');

      setIsRebasing(false);

      return {
        success: true,
        txSignature,
        bdScore: result.bdScore,
        stakeChanges: result.stakeChanges,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Rebase failed';
      console.error('[useRebasePool] Error:', errorMessage);
      setError(errorMessage);
      setIsRebasing(false);

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  return {
    rebasePool,
    isRebasing,
    error,
  };
}
