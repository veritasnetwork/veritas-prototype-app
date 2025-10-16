import { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { buildBuyTransaction } from '@/lib/solana/buy-transaction';
import { getRpcEndpoint, getProgramId, getNetworkName } from '@/lib/solana/network-config';

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

      // Helper to read u128 as BigInt, then convert to Number (safe for values < 2^53)
      const readU128LE = (data: Buffer, offset: number): number => {
        const low = data.readBigUInt64LE(offset);
        const high = data.readBigUInt64LE(offset + 8);
        const result = (high << 64n) | low;
        return Number(result);
      };

      // Read supply BEFORE transaction
      const tokenSupplyBefore = readU128LE(poolAccountBefore.data, 56); // offset: 8 + 32 + 16 = 56

      // Build the transaction
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
      // ContentPool layout: discriminator(8) + post_id(32) + k_quadratic(16) + token_supply(16) + reserve(16) + ...
      // All u128 fields are 16 bytes (little-endian)
      const data = poolAccountAfter.data;

      const kQuadratic = readU128LE(data, 40); // offset: 8 (discriminator) + 32 (post_id) = 40
      const tokenSupplyAfter = readU128LE(data, 56); // offset: 40 + 16 (k_quadratic) = 56
      const reserveAfter = readU128LE(data, 72); // offset: 56 + 16 (token_supply) = 72

      console.log('[BUY HOOK] Raw values from chain:', {
        kQuadratic,
        tokenSupplyAfter,
        reserveAfter
      });

      // Calculate actual tokens received by comparing before/after supply
      const tokensReceived = tokenSupplyAfter - tokenSupplyBefore;

      // Convert from lamports to tokens (divide by 10^6)
      const TOKEN_PRECISION = 1_000_000;
      const tokensReceivedConverted = tokensReceived / TOKEN_PRECISION;
      const tokenSupplyConverted = tokenSupplyAfter / TOKEN_PRECISION;
      const reserveConverted = reserveAfter / TOKEN_PRECISION;
      // k_quadratic is stored as-is on chain (1 = 1, not scaled)
      const kQuadraticConverted = kQuadratic; // No conversion needed
      const usdcAmountConverted = usdcAmount / TOKEN_PRECISION;

      // Record trade in database
      const jwt = await getAccessToken();

      if (jwt) {
        try {
          // Send atomic units to API (no precision loss)
          const tradeData = {
            user_id: user.id,
            pool_address: poolAddress,
            post_id: postId,
            wallet_address: address,
            trade_type: 'buy',
            token_amount: tokensReceivedConverted.toString(),
            usdc_amount: usdcAmountConverted.toString(),
            token_supply_after: tokenSupplyAfter.toString(), // Atomic units
            reserve_after: reserveAfter.toString(), // Atomic units (micro-USDC)
            k_quadratic: kQuadraticConverted.toString(),
            tx_signature: signature
          };

          console.log('[BUY HOOK] Sending to API:', tradeData);

          const response = await fetch('/api/trades/record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeData)
          });

          if (!response.ok) {
            const responseText = await response.text();
            console.error('[TRADE RECORDING] Failed to record trade. Status:', response.status);
            console.error('[TRADE RECORDING] Response:', responseText);
          }
        } catch (recordError) {
          console.error('[TRADE RECORDING] Error recording trade:', recordError);
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
