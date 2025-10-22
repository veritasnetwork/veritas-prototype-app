/**
 * Settlement Button Component
 *
 * Allows users to trigger pool settlement immediately after BD scoring completes.
 * User pays gas to settle the pool based on the BD relevance score.
 */

'use client';

import { useState } from 'react';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { Connection, Transaction } from '@solana/web3.js';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import { Scale, AlertCircle, CheckCircle } from 'lucide-react';

interface SettlementButtonProps {
  postId: string;
  poolAddress: string;
  bdScore?: number; // If BD score is available
  onSettlementSuccess?: () => void;
}

export function SettlementButton({
  postId,
  poolAddress,
  bdScore,
  onSettlementSuccess
}: SettlementButtonProps) {
  const { getAccessToken } = usePrivy();
  const { wallet, address } = useSolanaWallet();
  const [isSettling, setIsSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSettle = async () => {
    if (!wallet || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!('signTransaction' in wallet)) {
      setError('Wallet does not support signing transactions');
      return;
    }

    setIsSettling(true);
    setError(null);
    setSuccess(false);

    try {
      const jwt = await getAccessToken();
      if (!jwt) {
        throw new Error('Authentication required');
      }

      // Call backend to prepare settlement transaction
      const prepareResponse = await fetch('/api/pools/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          postId,
          walletAddress: address,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || errorData.message || 'Failed to prepare settlement');
      }

      const { transaction: serializedTx, bdScore: actualBdScore } = await prepareResponse.json();

      // Deserialize transaction
      const txBuffer = Buffer.from(serializedTx, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Sign the transaction
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Send and confirm transaction
      const rpcEndpoint = getRpcEndpoint();
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log(`[SETTLEMENT] Pool ${poolAddress} settled with BD score ${actualBdScore}`);
      console.log(`[SETTLEMENT] Transaction: ${signature}`);

      setSuccess(true);

      // Call success callback
      if (onSettlementSuccess) {
        onSettlementSuccess();
      }

    } catch (err) {
      console.error('Settlement error:', err);
      if (err instanceof Error) {
        if (err.message.includes('User rejected')) {
          setError('Transaction cancelled');
        } else if (err.message.includes('already settled')) {
          setError('Pool already settled for this epoch');
        } else if (err.message.includes('not yet available')) {
          setError('BD score not ready yet - please wait for epoch processing');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to settle pool');
      }
    } finally {
      setIsSettling(false);
    }
  };

  // Don't show button if already settled successfully
  if (success) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
        <CheckCircle className="w-4 h-4" />
        <span>Pool settled successfully!</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSettle}
        disabled={isSettling}
        className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSettling ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span>Settling Pool...</span>
          </>
        ) : (
          <>
            <Scale className="w-4 h-4" />
            <span>Settle Pool</span>
            {bdScore !== undefined && (
              <span className="text-xs opacity-80">
                (BD: {(bdScore * 100).toFixed(1)}%)
              </span>
            )}
          </>
        )}
      </button>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Settle this pool based on the latest BD relevance score. You pay gas.
      </p>
    </div>
  );
}
