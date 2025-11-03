import { useState } from 'react';
import { Connection, Transaction } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { getRpcEndpoint, getNetworkName } from '@/lib/solana/network-config';
import { invalidatePoolData } from '@/services/PoolDataService';
import { mutate } from 'swr';

export function useBuyTokens() {
  const { wallet, address } = useSolanaWallet();
  const { user } = useAuth();
  const { user: privyUser, getAccessToken } = usePrivy();
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

      // Validate balances BEFORE preparing transaction
      const { PublicKey } = await import('@solana/web3.js');
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      const { getUsdcMint } = await import('@/lib/solana/network-config');

      const solBalance = await connection.getBalance(new PublicKey(walletAddress));
      const solBalanceInSol = solBalance / 1e9;
      const minSolRequired = 0.005; // Minimum SOL for transaction fees

      if (solBalanceInSol < minSolRequired) {
        throw new Error(
          `You need at least ${minSolRequired} SOL for transaction fees. Please add SOL to your wallet and try again.`
        );
      }

      const usdcMint = getUsdcMint();
      const usdcAta = await getAssociatedTokenAddress(usdcMint, new PublicKey(walletAddress));

      let usdcBalance = 0;
      try {
        const tokenBalance = await connection.getTokenAccountBalance(usdcAta);
        usdcBalance = (tokenBalance.value.uiAmount || 0) * 1_000_000; // Convert to micro-USDC
      } catch (e) {
        // No token account = 0 balance
        usdcBalance = 0;
      }

      const usdcNeeded = usdcAmount / 1_000_000; // Convert micro-USDC to display USDC
      if (usdcBalance < usdcAmount) {
        throw new Error(
          `You need ${usdcNeeded.toFixed(2)} USDC to buy ${side} tokens. Please add USDC to your wallet and try again.`
        );
      }

      // Step 1: Prepare transaction with stake skim via backend
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
          tradeType: 'BUY',
          usdcAmount,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();

        // Handle excessive skim blocking error (400 status with specific error code)
        if (prepareResponse.status === 400 && errorData.error === 'excessive_skim') {
          console.warn('[useBuyTokens] ⚠️  Excessive skim blocked:', errorData);

          // Return data for UI to show deposit modal
          setIsLoading(false);
          return {
            requiresDeposit: true,
            excessiveSkimData: errorData,
          };
        }

        console.error('[useBuyTokens] ❌ Step 1 failed:', errorData);
        throw new Error(errorData.error || 'Failed to prepare transaction');
      }

      const { transaction: serializedTx, skimAmount, expectedTokensOut } = await prepareResponse.json();

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
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          postId,
          tradeType: 'buy',
          side: side.toUpperCase() as 'LONG' | 'SHORT',
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        console.error('[useBuyTokens] ❌ Execute failed:', errorData);
        throw new Error(errorData.error || 'Failed to execute transaction');
      }

      const executeResult = await executeResponse.json();
      const signature = executeResult.signature;

      console.log('[useBuyTokens] ✅ Transaction executed:', signature);

      // Step 5: Parse transaction to get ACTUAL amounts transferred
      let actualTokensReceived = expectedTokensOut || 0; // Fallback to expected amount
      let actualUsdcSpent = usdcAmount / 1_000_000; // Fallback to requested amount

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
            console.warn('[useBuyTokens] ⚠️  Could not find pool deployment for parsing');
          } else {
            const tokenMintAddress = side === 'LONG'
              ? poolDeployment.long_mint_address
              : poolDeployment.short_mint_address;
            const usdcMint = getUsdcMint();

            console.log('[useBuyTokens] 🔍 Looking for token changes:', {
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
                // Token account balance change (should be positive for buy)
                const preBal = preBalance?.uiTokenAmount?.uiAmount || 0;
                const postBal = postBalance.uiTokenAmount?.uiAmount || 0;
                const tokensReceived = postBal - preBal;

                console.log('[useBuyTokens] 📊 Token balance change:', {
                  pre: preBal,
                  post: postBal,
                  diff: tokensReceived
                });

                // Only update if we got a valid positive amount
                if (tokensReceived > 0) {
                  actualTokensReceived = tokensReceived;
                  foundTokenChange = true;
                  console.log('[useBuyTokens] ✅ Actual tokens received from tx:', actualTokensReceived);
                }
              }

              if (postBalance.mint === usdcMint.toBase58() && postBalance.owner === walletAddress) {
                // USDC account balance change (should be negative for buy)
                const preBal = preBalance?.uiTokenAmount?.uiAmount || 0;
                const postBal = postBalance.uiTokenAmount?.uiAmount || 0;
                const usdcSpent = Math.abs(preBal - postBal);

                console.log('[useBuyTokens] 💰 USDC balance change:', {
                  pre: preBal,
                  post: postBal,
                  diff: preBal - postBal,
                  abs: usdcSpent
                });

                // Only update if we got a valid positive amount
                if (usdcSpent > 0) {
                  actualUsdcSpent = usdcSpent;
                  foundUsdcChange = true;
                  console.log('[useBuyTokens] ✅ Actual USDC spent from tx:', actualUsdcSpent);
                }
              }
            }

            if (!foundTokenChange) {
              console.warn('[useBuyTokens] ⚠️  Did not find token balance change in transaction');
            }
            if (!foundUsdcChange) {
              console.warn('[useBuyTokens] ⚠️  Did not find USDC balance change in transaction');
            }
          }
        } else {
          console.warn('[useBuyTokens] ⚠️  Transaction details missing token balances');
        }
      } catch (parseError) {
        console.warn('[useBuyTokens] ⚠️  Could not parse transaction amounts, using estimates:', parseError);
      }

      // CRITICAL: Ensure we never send 0 amounts to the database
      if (actualTokensReceived <= 0) {
        console.warn('[useBuyTokens] ⚠️  Token amount is 0, using expected amount:', expectedTokensOut);
        actualTokensReceived = expectedTokensOut || 0.000001; // Use minimum value if expected is also 0
      }
      if (actualUsdcSpent <= 0) {
        console.warn('[useBuyTokens] ⚠️  USDC amount is 0, using requested amount:', usdcAmount / 1_000_000);
        actualUsdcSpent = usdcAmount / 1_000_000;
      }

      // Step 6: Fetch updated pool state for complete ICBS data
      let poolData: any = null;
      try {
        const { fetchPoolData } = await import('@/lib/solana/fetch-pool-data');
        poolData = await fetchPoolData(poolAddress, rpcEndpoint);
      } catch (fetchError) {
        console.warn('[useBuyTokens] ⚠️  Step 6 - Could not fetch pool data:', fetchError);
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
            wallet_address: walletAddress,
            user_id: user.id,
            side,
            trade_type: 'buy',
            // Use ACTUAL amounts from transaction parsing
            usdc_amount: String(actualUsdcSpent),
            token_amount: String(actualTokensReceived),
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
            // Skim amount for custodian accounting
            skim_amount: skimAmount ? skimAmount / 1_000_000 : 0,  // Convert micro-USDC to display USDC
          }),
        });

        if (!recordResponse.ok) {
          const errorText = await recordResponse.text();
          console.error('[useBuyTokens] ❌ Step 6 failed - record API error:', errorText);
        } else {
          const recordResult = await recordResponse.json();
        }
      } catch (recordError) {
        console.error('[useBuyTokens] ❌ Step 6 exception:', recordError);
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
        tradeType: 'buy' as const,
        side: side.toUpperCase() as 'LONG' | 'SHORT',
        tokenAmount: expectedTokensOut || 0,
        usdcAmount: usdcAmount / 1_000_000, // Convert micro-USDC to display USDC
        price: expectedTokensOut ? (usdcAmount / 1_000_000) / expectedTokensOut : 0,
        skimAmount: skimAmount ? skimAmount / 1_000_000 : 0,
        txSignature: signature,
        poolAddress,
        postId,
      };

      // Note: We removed onSuccess callback - SWR mutate handles all refreshing now
      // If parent needs notification, they can use the return value

      return { signature, tradeDetails };
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
