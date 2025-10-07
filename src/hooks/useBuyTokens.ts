import { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { buildBuyTransaction } from '@/lib/solana/buy-transaction';
import { getRpcEndpoint, getProgramId } from '@/lib/solana/network-config';

export function useBuyTokens() {
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
      // Pool struct: creator(32) + token_mint(32) + usdc_vault(32) + k_quadratic(8) + token_supply(8) + reserve(8)
      const data = poolAccountAfter.data;
      const tokenSupplyAfter = Number(data.readBigUInt64LE(112)); // offset for token_supply
      const reserveAfter = Number(data.readBigUInt64LE(120)); // offset for reserve
      const kQuadratic = Number(data.readBigUInt64LE(104)); // offset for k_quadratic

      // Calculate tokens received (approximate from curve)
      const tokensReceived = Math.floor(usdcAmount / 1000); // Simplified, real calc is more complex

      // Record trade in database
      const jwt = await getAccessToken();
      if (jwt) {
        try {
          const response = await fetch('/api/supabase/functions/v1/solana-record-trade', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
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
            })
          });

          if (!response.ok) {
            console.error('Failed to record trade:', await response.text());
          }
        } catch (recordError) {
          console.error('Error recording trade:', recordError);
          // Don't fail the whole transaction if recording fails
        }
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
