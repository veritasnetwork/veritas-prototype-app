/**
 * useRebasePool Hook
 *
 * Handles rebasing a pool: triggers epoch processing + settlement
 * User signs the settlement transaction after server processes BD decomposition
 */

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { invalidatePoolData } from '@/services/PoolDataService';
import { useSolanaWallet } from './useSolanaWallet';
import { getRpcEndpoint } from '@/lib/solana/network-config';

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
  const { getAccessToken } = usePrivy();
  const { wallet, address } = useSolanaWallet();
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
      // Get wallet address from useSolanaWallet hook
      if (!wallet || !address) {
        throw new Error('No wallet connected');
      }

      if (!('signTransaction' in wallet)) {
        throw new Error('Wallet does not support signing transactions');
      }

      // Get auth token
      const authToken = await getAccessToken();
      if (!authToken) {
        throw new Error('Not authenticated');
      }


      // Call rebase API
      const response = await fetch(`/api/posts/${postId}/rebase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ walletAddress: address }),
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


      // Deserialize and send transaction
      const rpcEndpoint = getRpcEndpoint();
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const txBuffer = Buffer.from(result.transaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Sign transaction with Solana wallet from useSolanaWallet hook
      const signedTx = await wallet.signTransaction(transaction);


      // Send signed transaction
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());


      // Wait for confirmation
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Record the settlement in the database
      try {
        const recordResponse = await fetch('/api/settlements/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            postId,
            poolAddress: result.poolAddress,
            signature: txSignature,
            epoch: result.currentEpoch + 1, // Next epoch after settlement
            bdScore: result.bdScore,
          }),
        });

        if (!recordResponse.ok) {
          const errorText = await recordResponse.text();
          console.error('[useRebasePool] ⚠️  Failed to record settlement (non-critical):', errorText);
          // Continue anyway - event indexer will pick it up
        } else {
          console.log('[useRebasePool] ✅ Settlement recorded');
        }
      } catch (recordError) {
        console.warn('[useRebasePool] ⚠️  Failed to record settlement (non-critical):', recordError);
        // Continue anyway - event indexer will pick it up
      }

      // Invalidate pool data cache to trigger immediate refresh after settlement
      invalidatePoolData(postId);

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
