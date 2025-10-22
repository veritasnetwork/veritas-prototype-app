import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/providers/AuthProvider';
import { getRpcEndpoint } from '@/lib/solana/network-config';
import { createClient } from '@supabase/supabase-js';

export function useSwapBalances(poolAddress: string, postId: string) {
  const { address } = useSolanaWallet();
  const { user } = useAuth();
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [shareBalance, setShareBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !user) {
        setUsdcBalance(0);
        setShareBalance(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const rpcEndpoint = getRpcEndpoint();
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const walletPubkey = new PublicKey(address);
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Step 1: Get LONG/SHORT mint addresses for ICBS pool
        const { data: poolData, error: poolError } = await supabase
          .from('pool_deployments')
          .select('long_mint_address, short_mint_address')
          .eq('pool_address', poolAddress)
          .single();

        if (poolError || !poolData) {
          console.error('[useSwapBalances] Pool not found:', poolError);
          setUsdcBalance(0);
          setShareBalance(0);
          setLoading(false);
          return;
        }

        // Step 2: Get USDC mint from environment (network-specific)
        // Localnet: Uses test USDC mint from deployment
        // Devnet/Mainnet: Uses standard USDC mint addresses
        const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'localnet';
        const usdcMintStr =
          network === 'localnet'
            ? process.env.NEXT_PUBLIC_USDC_MINT_LOCALNET
            : process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS;

        if (!usdcMintStr) {
          console.error('[useSwapBalances] USDC mint not configured');
          setUsdcBalance(0);
          setShareBalance(0);
          setLoading(false);
          return;
        }
        const usdcMint = new PublicKey(usdcMintStr);

        // Step 3: Get user's USDC token account balance
        try {
          const usdcTokenAccount = await getAssociatedTokenAddress(
            usdcMint,
            walletPubkey
          );

          const accountInfo = await getAccount(connection, usdcTokenAccount);
          // Convert from micro-USDC (6 decimals) to USDC
          const balance = Number(accountInfo.amount) / 1_000_000;
          setUsdcBalance(balance);
        } catch (err) {
          console.error('[useSwapBalances] USDC account error:', err);
          setUsdcBalance(0);
        }

        // Step 4: Fetch LONG token balance (ICBS pools have LONG/SHORT, not single share token)
        // For now, we'll track LONG balance as the primary "share" balance
        // TODO: Add separate state for LONG vs SHORT balances
        try {
          if (poolData.long_mint_address) {
            const longMint = new PublicKey(poolData.long_mint_address);
            const longTokenAccount = await getAssociatedTokenAddress(
              longMint,
              walletPubkey
            );

            const accountInfo = await getAccount(connection, longTokenAccount);
            // Convert from atomic units (6 decimals) to display units
            const balance = Number(accountInfo.amount) / 1_000_000;
            setShareBalance(balance);
          } else {
            setShareBalance(0);
          }
        } catch (err) {
          console.error('[useSwapBalances] LONG token account error:', err);
          setShareBalance(0);
        }
      } catch (error) {
        console.error('[useSwapBalances] Error fetching balances:', error);
        setUsdcBalance(0);
        setShareBalance(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [address, user, poolAddress, postId, refreshTrigger]);

  return {
    usdcBalance,
    shareBalance,
    loading,
    refresh,
  };
}
