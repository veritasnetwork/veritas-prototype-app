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
import { mutate } from 'swr';

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

  const rebasePool = async (postId: string, cooldownRemaining?: number): Promise<{
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

      // Refresh blockhash before signing (blockhashes expire after ~60s)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Sign transaction with Solana wallet (user signs FIRST)
      const signedTx = await wallet.signTransaction(transaction);

      // Send signed transaction to backend for protocol signature and execution
      const executeResponse = await fetch('/api/settlements/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize({
            requireAllSignatures: false,  // Allow partial signing (user signed, protocol will sign next)
            verifySignatures: false,       // Skip signature verification during serialization
          })).toString('base64'),
          postId,
          poolAddress: result.poolAddress,
          epoch: result.currentEpoch + 1,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        console.error('[useRebasePool] ❌ Execute failed:', errorData);
        throw new Error(errorData.error || 'Failed to execute settlement');
      }

      const executeResult = await executeResponse.json();
      const txSignature = executeResult.signature;

      console.log('[useRebasePool] ✅ Settlement executed:', txSignature);

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

      // Trigger SWR to refetch all relevant data immediately
      await Promise.all([
        mutate(`/api/posts/${postId}/trades?range=1H`),
        mutate(`/api/posts/${postId}/trades?range=24H`),
        mutate(`/api/posts/${postId}/trades?range=7D`),
        mutate(`/api/posts/${postId}/trades?range=ALL`),
        mutate(`/api/posts/${postId}/history`),
        mutate(`/api/posts/${postId}`),
        mutate(`/api/posts/${postId}/rebase-status`),
      ]);

      setIsRebasing(false);

      return {
        success: true,
        txSignature,
        bdScore: result.bdScore,
        stakeChanges: result.stakeChanges,
      };

    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'Rebase failed';

      // Check for settlement cooldown error
      if (errorMessage.includes('SettlementCooldown') || errorMessage.includes('0x177f')) {
        if (cooldownRemaining && cooldownRemaining > 0) {
          const hours = Math.floor(cooldownRemaining / 3600);
          const minutes = Math.floor((cooldownRemaining % 3600) / 60);

          if (hours > 0) {
            errorMessage = `Rebase will be available again in ${hours}h ${minutes}m`;
          } else {
            errorMessage = `Rebase will be available again in ${minutes}m`;
          }
        } else {
          errorMessage = 'Cooldown active. Please wait before rebasing again.';
        }
      }

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
