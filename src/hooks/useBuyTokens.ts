import { useState } from 'react';
import { Connection, Transaction } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { getRpcEndpoint, getNetworkName } from '@/lib/solana/network-config';

export function useBuyTokens(onSuccess?: () => void) {
  const { wallet, address } = useSolanaWallet();
  const { user } = useAuth();
  const { getAccessToken } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buyTokens = async (
    postId: string,
    poolAddress: string,
    usdcAmount: number,
    side: 'LONG' | 'SHORT' = 'LONG',
    initialBelief?: number,
    metaBelief?: number
  ) => {
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
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const jwt = await getAccessToken();

      if (!jwt) {
        throw new Error('Authentication required');
      }

      // Step 1: Prepare transaction with stake skim via backend
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
          tradeType: 'BUY',
          usdcAmount,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || 'Failed to prepare transaction');
      }

      const { transaction: serializedTx, skimAmount, expectedTokensOut } = await prepareResponse.json();

      // Step 2: Deserialize transaction
      const txBuffer = Buffer.from(serializedTx, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Step 3: Sign the transaction
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Step 4: Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // Step 5: Fetch updated pool state for complete ICBS data
      let poolData: any = null;
      try {
        const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
        poolData = await fetchPoolData(poolAddress, rpcEndpoint);
      } catch (fetchError) {
        console.warn('[TRADE RECORDING] Could not fetch pool data:', fetchError);
      }

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
            trade_type: 'buy',
            usdc_amount: String(usdcAmount),
            token_amount: expectedTokensOut ? String(expectedTokensOut) : (poolData ? String((usdcAmount / (side === 'LONG' ? poolData.priceLong : poolData.priceShort)) * 1_000_000) : String(usdcAmount * 1_000_000)),
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
          console.error('[TRADE RECORDING] Failed to record trade:', await recordResponse.text());
        }
      } catch (recordError) {
        console.error('[TRADE RECORDING] Error recording trade:', recordError);
        // Don't fail the whole transaction if recording fails
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
        const network = getNetworkName();
        if (network === 'localnet') {
          errorMessage = 'Insufficient USDC balance. You need test USDC to buy tokens. Run: spl-token mint <USDC_MINT> <AMOUNT> <YOUR_USDC_ACCOUNT>';
        } else if (network === 'devnet') {
          errorMessage = 'Insufficient USDC balance. Get devnet USDC from a faucet.';
        } else {
          errorMessage = 'Insufficient USDC balance. Please add USDC to your wallet.';
        }
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
