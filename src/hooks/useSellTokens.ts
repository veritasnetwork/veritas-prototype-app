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

      // Helper to read u128 as BigInt, then convert to Number (safe for values < 2^53)
      const readU128LE = (data: Buffer, offset: number): number => {
        const low = data.readBigUInt64LE(offset);
        const high = data.readBigUInt64LE(offset + 8);
        const result = (high << 64n) | low;
        return Number(result);
      };

      // Fetch pool state BEFORE transaction
      const poolAccountBefore = await connection.getAccountInfo(poolPubkey);
      if (!poolAccountBefore) {
        throw new Error('Pool not found');
      }

      // Read supply and reserve BEFORE transaction
      const tokenSupplyBefore = readU128LE(poolAccountBefore.data, 56);
      const reserveBefore = readU128LE(poolAccountBefore.data, 72); // offset: 8 + 32 + 16 + 16 = 72

      // Build the transaction
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

      const kQuadratic = readU128LE(data, 40); // offset: 8 (discriminator) + 32 (post_id) = 40
      const tokenSupplyAfter = readU128LE(data, 56); // offset: 40 + 16 (k_quadratic) = 56
      const reserveAfter = readU128LE(data, 72); // offset: 56 + 16 (token_supply) = 72

      // Calculate actual amounts by comparing before/after
      const usdcReceived = reserveBefore - reserveAfter;
      const tokensBurned = tokenSupplyBefore - tokenSupplyAfter;

      // Convert from lamports to tokens (divide by 10^6)
      const TOKEN_PRECISION = 1_000_000;
      const tokensBurnedConverted = tokensBurned / TOKEN_PRECISION;
      const usdcReceivedConverted = usdcReceived / TOKEN_PRECISION;
      const tokenSupplyConverted = tokenSupplyAfter / TOKEN_PRECISION;
      const reserveConverted = reserveAfter / TOKEN_PRECISION;
      // k_quadratic is stored as-is on chain (1 = 1, not scaled)
      const kQuadraticConverted = kQuadratic; // No conversion needed

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
            token_amount: tokensBurnedConverted.toString(), // Display units
            usdc_amount: usdcReceivedConverted.toString(), // Display units
            token_supply_after: tokenSupplyAfter.toString(), // Atomic units
            reserve_after: reserveAfter.toString(), // Atomic units (micro-USDC)
            k_quadratic: kQuadraticConverted.toString(),
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
