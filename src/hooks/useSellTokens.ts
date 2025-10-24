import { useState } from 'react';
import { Connection, Transaction } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import { invalidatePoolData } from '@/services/PoolDataService';

export function useSellTokens(onSuccess?: () => void) {
  const { wallet, address } = useSolanaWallet();
  const { user } = useAuth();
  const { getAccessToken } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sellTokens = async (
    postId: string,
    poolAddress: string,
    tokenAmount: number,
    side: 'LONG' | 'SHORT' = 'LONG',
    initialBelief?: number,
    metaBelief?: number
  ) => {
    console.log('🔴 [useSellTokens] Starting sell transaction');
    console.log('[useSellTokens] Parameters:', { postId, poolAddress, tokenAmount, side, initialBelief, metaBelief });

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
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const jwt = await getAccessToken();

      if (!jwt) {
        throw new Error('Authentication required');
      }

      console.log('[useSellTokens] Step 1/6: Preparing transaction...');
      // Step 1: Prepare transaction via backend
      const prepareResponse = await fetch('/api/trades/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          walletAddress: address,
          postId,
          side,
          tradeType: 'SELL',
          tokenAmount,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        console.error('[useSellTokens] ❌ Step 1 failed:', errorData);
        throw new Error(errorData.error || 'Failed to prepare transaction');
      }

      const { transaction: serializedTx, expectedUsdcOut } = await prepareResponse.json();
      console.log('[useSellTokens] ✅ Step 1 complete:', { expectedUsdcOut });

      console.log('[useSellTokens] Step 2/6: Deserializing transaction...');
      // Step 2: Deserialize transaction
      const txBuffer = Buffer.from(serializedTx, 'base64');
      const transaction = Transaction.from(txBuffer);
      console.log('[useSellTokens] ✅ Step 2 complete');

      console.log('[useSellTokens] Step 3/6: Signing transaction...');
      // Step 3: Sign the transaction
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);
      console.log('[useSellTokens] ✅ Step 3 complete');

      console.log('[useSellTokens] Step 4/6: Sending transaction...');
      // Step 4: Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      console.log('[useSellTokens] Transaction sent, signature:', signature);
      console.log('[useSellTokens] Waiting for confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('[useSellTokens] ✅ Step 4 complete - transaction confirmed');

      console.log('[useSellTokens] Step 5/6: Fetching updated pool state...');
      // Step 5: Fetch updated pool state for complete ICBS data
      let poolData: any = null;
      try {
        const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
        poolData = await fetchPoolData(poolAddress, rpcEndpoint);
        console.log('[useSellTokens] ✅ Step 5 complete - pool data fetched:', {
          priceLong: poolData?.priceLong,
          priceShort: poolData?.priceShort,
          supplyLong: poolData?.supplyLong,
          supplyShort: poolData?.supplyShort
        });
      } catch (fetchError) {
        console.warn('[useSellTokens] ⚠️  Step 5 - Could not fetch pool data:', fetchError);
      }

      console.log('[useSellTokens] Step 6/6: Recording trade...');
      // Step 6: Record trade with complete ICBS data
      try {
        const recordResponse = await fetch('/api/trades/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            post_id: postId,
            pool_address: poolAddress,
            wallet_address: address,
            user_id: user.id,
            side,
            trade_type: 'sell',
            token_amount: String(tokenAmount),
            usdc_amount: expectedUsdcOut ? String(expectedUsdcOut / 1_000_000) : (poolData
              ? String((tokenAmount / 1_000_000) * (side === 'LONG' ? poolData.priceLong : poolData.priceShort))
              : String(tokenAmount / 1_000_000)),
            tx_signature: signature,
            // ICBS state snapshots (if available)
            s_long_after: poolData?.supplyLong,
            s_short_after: poolData?.supplyShort,
            sqrt_price_long_x96: poolData?._raw?.sqrtPriceLongX96,
            sqrt_price_short_x96: poolData?._raw?.sqrtPriceShortX96,
            price_long: poolData?.priceLong,
            price_short: poolData?.priceShort,
            r_long_after: poolData?.marketCapLong,
            r_short_after: poolData?.marketCapShort,
            // Belief submission
            initial_belief: initialBelief,
            meta_belief: metaBelief,
          }),
        });

        if (!recordResponse.ok) {
          const errorText = await recordResponse.text();
          console.error('[useSellTokens] ❌ Step 6 failed - record API error:', errorText);
        } else {
          const recordResult = await recordResponse.json();
          console.log('[useSellTokens] ✅ Step 6 complete - trade recorded:', recordResult);
        }
      } catch (recordError) {
        console.error('[useSellTokens] ❌ Step 6 exception:', recordError);
        // Don't fail the whole transaction if recording fails
      }

      console.log('✅ [useSellTokens] Sell transaction complete!');

      // Invalidate pool data cache to trigger immediate refresh
      invalidatePoolData(postId);

      // Call success callback to trigger UI refresh
      if (onSuccess) {
        console.log('[useSellTokens] Calling success callback');
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
