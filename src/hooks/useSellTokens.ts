import { useState } from 'react';
import { Connection, Transaction } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import { invalidatePoolData } from '@/services/PoolDataService';
import { atomicToDisplay, asAtomic, microToUsdc } from '@/lib/units';
import { mutate } from 'swr';

export function useSellTokens() {
  const { wallet, address } = useSolanaWallet();
  const { user } = useAuth();
  const { user: privyUser, getAccessToken } = usePrivy();
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
    // Get address from Privy user object (available immediately) or fallback to useSolanaWallet
    const linkedSolanaAccount = privyUser?.linkedAccounts?.find(
      (account: any) => account.type === 'wallet' && account.chainType === 'solana'
    ) as any;
    const walletAddress = linkedSolanaAccount?.address || address;

    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    // We need the wallet object for signing - if it's not ready yet, show a better message
    if (!wallet) {
      throw new Error('Wallet is initializing. Please wait a moment and try again.');
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

      // Validate balances BEFORE preparing transaction
      const { PublicKey } = await import('@solana/web3.js');

      const solBalance = await connection.getBalance(new PublicKey(walletAddress));
      const solBalanceInSol = solBalance / 1e9;
      const minSolRequired = 0.005; // Minimum SOL for transaction fees

      if (solBalanceInSol < minSolRequired) {
        throw new Error(
          `You need at least ${minSolRequired} SOL for transaction fees. Please add SOL to your wallet and try again.`
        );
      }

      // Note: Token balance validation happens on-chain during the swap
      // The transaction will fail if user doesn't have enough tokens

      // Step 1: Prepare transaction via backend
      const prepareResponse = await fetch('/api/trades/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          walletAddress: walletAddress,
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

      // Step 2: Deserialize transaction
      const txBuffer = Buffer.from(serializedTx, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Step 3: Sign the transaction (user signs FIRST)
      // @ts-ignore - Privy wallet has signTransaction method
      const signedTx = await wallet.signTransaction(transaction);

      // Step 4: Send signed transaction to backend for protocol signature and execution
      const executeResponse = await fetch('/api/trades/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize({
            requireAllSignatures: false,  // Allow partial signing (user signed, protocol will sign next)
            verifySignatures: false,       // Skip signature verification during serialization
          })).toString('base64'),
          postId,
          tradeType: 'sell',
          side: side.toUpperCase() as 'LONG' | 'SHORT',
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        console.error('[useSellTokens] ❌ Execute failed:', errorData);
        throw new Error(errorData.error || 'Failed to execute transaction');
      }

      const executeResult = await executeResponse.json();
      const signature = executeResult.signature;

      console.log('[useSellTokens] ✅ Transaction executed:', signature);

      // Step 5: Parse transaction to get ACTUAL amounts transferred
      let actualTokensSold = atomicToDisplay(asAtomic(tokenAmount)); // Fallback to requested amount
      let actualUsdcReceived = expectedUsdcOut ? microToUsdc(expectedUsdcOut as any) : 0;

      try {
        const txDetails = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (txDetails?.meta?.postTokenBalances && txDetails?.meta?.preTokenBalances) {
          // Find user's token balance changes
          const { PublicKey } = await import('@solana/web3.js');
          const { getAssociatedTokenAddress } = await import('@solana/spl-token');
          const { getUsdcMint } = await import('@/lib/solana/network-config');
          const { createClient } = await import('@supabase/supabase-js');

          // Get mint addresses
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );
          const { data: poolDeployment } = await supabase
            .from('pool_deployments')
            .select('long_mint_address, short_mint_address')
            .eq('pool_address', poolAddress)
            .single();

          if (!poolDeployment) {
            console.warn('[useSellTokens] ⚠️  Could not find pool deployment for parsing');
          } else {
            const tokenMintAddress = side === 'LONG'
              ? poolDeployment.long_mint_address
              : poolDeployment.short_mint_address;
            const usdcMint = getUsdcMint();

            console.log('[useSellTokens] 🔍 Looking for token changes:', {
              tokenMint: tokenMintAddress,
              usdcMint: usdcMint.toBase58(),
              userAddress: walletAddress,
              side
            });

            let foundTokenChange = false;
            let foundUsdcChange = false;

            // Parse token balances - match by accountIndex, not array position
            for (const postBalance of txDetails.meta.postTokenBalances) {
              // Find matching pre-balance by accountIndex
              const preBalance = txDetails.meta.preTokenBalances.find(
                pre => pre.accountIndex === postBalance.accountIndex
              );

              if (postBalance.mint === tokenMintAddress && postBalance.owner === walletAddress) {
                // Token account balance change (should be negative for sell)
                const preBal = preBalance?.uiTokenAmount?.uiAmount || 0;
                const postBal = postBalance.uiTokenAmount?.uiAmount || 0;
                const tokensSold = Math.abs(preBal - postBal);

                console.log('[useSellTokens] 📊 Token balance change:', {
                  pre: preBal,
                  post: postBal,
                  diff: preBal - postBal,
                  abs: tokensSold
                });

                // Only update if we got a valid positive amount
                if (tokensSold > 0) {
                  actualTokensSold = atomicToDisplay(asAtomic(tokensSold));
                  foundTokenChange = true;
                  console.log('[useSellTokens] ✅ Actual tokens sold from tx:', actualTokensSold);
                }
              }

              if (postBalance.mint === usdcMint.toBase58() && postBalance.owner === walletAddress) {
                // USDC account balance change (should be positive for sell)
                const preBal = preBalance?.uiTokenAmount?.uiAmount || 0;
                const postBal = postBalance.uiTokenAmount?.uiAmount || 0;
                const usdcReceived = postBal - preBal;

                console.log('[useSellTokens] 💰 USDC balance change:', {
                  pre: preBal,
                  post: postBal,
                  diff: usdcReceived
                });

                // Only update if we got a valid positive amount
                if (usdcReceived > 0) {
                  actualUsdcReceived = usdcReceived;
                  foundUsdcChange = true;
                  console.log('[useSellTokens] ✅ Actual USDC received from tx:', actualUsdcReceived);
                }
              }
            }

            if (!foundTokenChange) {
              console.warn('[useSellTokens] ⚠️  Did not find token balance change in transaction');
            }
            if (!foundUsdcChange) {
              console.warn('[useSellTokens] ⚠️  Did not find USDC balance change in transaction');
            }
          }
        } else {
          console.warn('[useSellTokens] ⚠️  Transaction details missing token balances');
        }
      } catch (parseError) {
        console.warn('[useSellTokens] ⚠️  Could not parse transaction amounts, using estimates:', parseError);
      }

      // CRITICAL: Ensure we never send 0 amounts to the database
      if (actualTokensSold <= 0) {
        console.warn('[useSellTokens] ⚠️  Token amount is 0, using requested amount:', tokenAmount);
        actualTokensSold = atomicToDisplay(asAtomic(tokenAmount)) || atomicToDisplay(asAtomic(0.000001)); // Use minimum value if expected is also 0
      }
      if (actualUsdcReceived <= 0) {
        console.warn('[useSellTokens] ⚠️  USDC amount is 0, using expected amount:', expectedUsdcOut);
        actualUsdcReceived = expectedUsdcOut ? microToUsdc(expectedUsdcOut as any) : 0.01; // Use minimum value if expected is also 0
      }

      // Step 6: Fetch updated pool state for complete ICBS data
      let poolData: any = null;
      try {
        const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
        poolData = await fetchPoolData(poolAddress, rpcEndpoint);
      } catch (fetchError) {
        console.warn('[useSellTokens] ⚠️  Step 6 - Could not fetch pool data:', fetchError);
      }

      // Step 7: Record trade with ACTUAL on-chain amounts
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
            // Use ACTUAL amounts from transaction parsing
            token_amount: String(actualTokensSold),
            usdc_amount: String(actualUsdcReceived),
            tx_signature: signature,
            // ICBS state snapshots (if available)
            s_long_after: poolData?.supplyLong,
            s_short_after: poolData?.supplyShort,
            sqrt_price_long_x96: poolData?._raw?.sqrtPriceLongX96,
            sqrt_price_short_x96: poolData?._raw?.sqrtPriceShortX96,
            price_long: poolData?.priceLong,
            price_short: poolData?.priceShort,
            r_long_after: poolData?.rLong,
            r_short_after: poolData?.rShort,
            vault_balance_after: poolData?._raw?.vaultBalanceMicro, // Micro-USDC
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
        }
      } catch (recordError) {
        console.error('[useSellTokens] ❌ Step 6 exception:', recordError);
        // Don't fail the whole transaction if recording fails
      }


      // Invalidate pool data cache to trigger immediate refresh
      invalidatePoolData(postId);

      // Add a small delay to ensure database writes (especially implied_relevance_history) are complete
      // This prevents race conditions where SWR fetches before the data is written
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger SWR to refetch all relevant data immediately
      // This ensures all components using these hooks get fresh data
      // Note: keepPreviousData in hook configs prevents loading flicker
      await Promise.all([
        mutate(`/api/posts/${postId}/trades?range=1H`),
        mutate(`/api/posts/${postId}/trades?range=24H`),
        mutate(`/api/posts/${postId}/trades?range=7D`),
        mutate(`/api/posts/${postId}/trades?range=ALL`),
        mutate(`/api/posts/${postId}/history`),
        mutate(`/api/posts/${postId}`),
      ]);

      // Prepare trade completion details
      const tradeDetails = {
        tradeType: 'sell' as const,
        side: side.toUpperCase() as 'LONG' | 'SHORT',
        tokenAmount: atomicToDisplay(asAtomic(tokenAmount)),
        usdcAmount: expectedUsdcOut || 0, // expectedUsdcOut is already in display USDC
        price: expectedUsdcOut ? expectedUsdcOut / atomicToDisplay(asAtomic(tokenAmount)) : 0,
        txSignature: signature,
        poolAddress,
        postId,
      };

      // Note: We removed onSuccess callback - SWR mutate handles all refreshing now

      return { signature, tradeDetails };
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
