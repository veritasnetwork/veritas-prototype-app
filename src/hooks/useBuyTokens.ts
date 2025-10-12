import { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { buildBuyTransaction } from '@/lib/solana/buy-transaction';
import { getRpcEndpoint, getProgramId } from '@/lib/solana/network-config';

export function useBuyTokens(onSuccess?: () => void) {
  const { wallet, address } = useSolanaWallet();
  const { user } = useAuth();
  const { getAccessToken } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buyTokens = async (postId: string, poolAddress: string, usdcAmount: number) => {
    if (!wallet || !address) {
      throw new Error('Wallet not connected');
    }

    if (!('signTransaction' in wallet)) {
      throw new Error('Wallet does not support signing transactions');
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

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
      console.log('[BUY] Wallet address:', address);

      const transaction = await buildBuyTransaction({
        connection,
        buyer: address,
        postId,
        usdcAmount,
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
        const result = (high << 64n) | low;
        return Number(result);
      };

      const kQuadratic = readU128LE(40); // offset: 8 (discriminator) + 32 (post_id) = 40
      const tokenSupplyAfter = readU128LE(56); // offset: 40 + 16 (k_quadratic) = 56
      const reserveAfter = readU128LE(72); // offset: 56 + 16 (token_supply) = 72

      console.log('[BUY] Pool state after trade:', {
        kQuadratic,
        tokenSupplyAfter,
        reserveAfter,
        accountDataLength: data.length
      });

      // Calculate tokens received (approximate from curve)
      const tokensReceived = Math.floor(usdcAmount / 1000); // Simplified, real calc is more complex

      // Record trade in database
      console.log('[TRADE RECORDING] Starting trade recording process...');
      const jwt = await getAccessToken();
      console.log('[TRADE RECORDING] JWT obtained:', jwt ? `${jwt.substring(0, 20)}...` : 'NULL');

      if (jwt) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          console.log('[TRADE RECORDING] Supabase URL:', supabaseUrl);

          const tradeData = {
            user_id: user.id,
            pool_address: poolAddress,
            post_id: postId,
            wallet_address: address,
            trade_type: 'buy',
            token_amount: tokensReceived.toString(),
            usdc_amount: usdcAmount.toString(),
            token_supply_after: tokenSupplyAfter.toString(),
            reserve_after: reserveAfter.toString(),
            k_quadratic: kQuadratic.toString(),
            tx_signature: signature
          };

          console.log('[TRADE RECORDING] Trade data:', JSON.stringify(tradeData, null, 2));

          const response = await fetch('/api/trades/record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeData)
          });

          console.log('[TRADE RECORDING] Response status:', response.status, response.statusText);
          const responseText = await response.text();
          console.log('[TRADE RECORDING] Response body:', responseText);

          if (!response.ok) {
            console.error('[TRADE RECORDING] Failed to record trade. Status:', response.status);
            console.error('[TRADE RECORDING] Response:', responseText);
          } else {
            console.log('[TRADE RECORDING] Trade recorded successfully!');
          }
        } catch (recordError) {
          console.error('[TRADE RECORDING] Error recording trade:', recordError);
          console.error('[TRADE RECORDING] Error details:', recordError instanceof Error ? recordError.message : recordError);
          // Don't fail the whole transaction if recording fails
        }
      } else {
        console.error('[TRADE RECORDING] No JWT available - skipping trade recording');
      }

      // Call success callback to trigger UI refresh
      if (onSuccess) {
        onSuccess();
      }

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
