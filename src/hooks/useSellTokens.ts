import { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { buildSellTransaction } from '@/lib/solana/sell-transaction';
import { getRpcEndpoint, getProgramId } from '@/lib/solana/network-config';

export function useSellTokens(onSuccess?: () => void) {
  const { wallet, address } = useSolanaWallet();
  const { user } = useAuth();
  const { getAccessToken } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sellTokens = async (postId: string, poolAddress: string, tokenAmount: number) => {
    if (!wallet || !address) {
      throw new Error('Wallet not connected');
    }

    if (!('signTransaction' in wallet)) {
      throw new Error('Wallet does not support signing transactions');
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const rpcEndpoint = getRpcEndpoint();
      const programId = getProgramId().toString();
      const connection = new Connection(rpcEndpoint, 'confirmed');

      // Use the pool address from database (already validated during pool deployment)
      const poolPubkey = new PublicKey(poolAddress);

      // Fetch pool state BEFORE transaction
      const poolAccountBefore = await connection.getAccountInfo(poolPubkey);
      if (!poolAccountBefore) {
        throw new Error('Pool not found');
      }

      // Build the transaction
      console.log('[SELL] Wallet address:', address);
      console.log('[SELL] Pool address:', poolAddress);
      console.log('[SELL] Token amount:', tokenAmount);

      const transaction = await buildSellTransaction({
        connection,
        seller: address,
        postId,
        tokenAmount,
        programId,
      });

      // Sign the transaction
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // Fetch pool state AFTER transaction
      const poolAccountAfter = await connection.getAccountInfo(poolPubkey);
      if (!poolAccountAfter) {
        throw new Error('Pool not found after transaction');
      }

      // Deserialize pool account (simplified - just extract the data we need)
      // Account layout: discriminator(8) + post_id(32) + k_quadratic(16) + token_supply(16) + reserve(16) + ...
      // All u128 fields are 16 bytes (little-endian)
      const data = poolAccountAfter.data;

      // Helper to read u128 as BigInt, then convert to Number (safe for values < 2^53)
      const readU128LE = (offset: number): number => {
        const low = data.readBigUInt64LE(offset);
        const high = data.readBigUInt64LE(offset + 8);
        return Number((high << 64n) | low);
      };

      const kQuadratic = readU128LE(40); // offset: 8 (discriminator) + 32 (post_id) = 40
      const tokenSupplyAfter = readU128LE(56); // offset: 40 + 16 (k_quadratic) = 56
      const reserveAfter = readU128LE(72); // offset: 56 + 16 (token_supply) = 72

      // Calculate USDC received (approximate from curve)
      const usdcReceived = Math.floor(tokenAmount * 1000); // Simplified, real calc is more complex

      // Record trade in database via Next.js API route
      try {
        const response = await fetch('/api/trades/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: user.id,
            pool_address: poolAddress,
            post_id: postId,
            wallet_address: address,
            trade_type: 'sell',
            token_amount: tokenAmount.toString(),
            usdc_amount: usdcReceived.toString(),
            token_supply_after: tokenSupplyAfter.toString(),
            reserve_after: reserveAfter.toString(),
            k_quadratic: kQuadratic.toString(),
            tx_signature: signature
          })
        });

        if (!response.ok) {
          console.error('Failed to record trade:', await response.text());
        }
      } catch (recordError) {
        console.error('Error recording trade:', recordError);
        // Don't fail the whole transaction if recording fails
      }

      // Call success callback to trigger UI refresh
      if (onSuccess) {
        onSuccess();
      }

      return signature;
    } catch (err) {
      console.error('Sell tokens error:', err);

      // Check for user rejection
      let errorMessage = 'Failed to sell tokens';
      if (err instanceof Error) {
        if (err.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled';
        } else {
          errorMessage = err.message;
        }
      }

      const error = new Error(errorMessage);
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sellTokens,
    isLoading,
    error,
  };
}
