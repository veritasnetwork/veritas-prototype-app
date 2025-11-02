import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useSolanaWallet } from './useSolanaWallet';
import { getRpcEndpoint, getUsdcMint } from '@/lib/solana/network-config';
import { createClient } from '@supabase/supabase-js';

export function useSwapBalances(poolAddress: string, postId: string) {
  const { address } = useSolanaWallet();
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [shareBalance, setShareBalance] = useState<number>(0);
  const [longBalance, setLongBalance] = useState<number>(0);
  const [shortBalance, setShortBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address) {
        // Keep loading state true while wallet is reconnecting
        // Don't reset balances to 0 immediately
        setLoading(true);
        return;
      }

      try {
        setLoading(true);

        const rpcEndpoint = getRpcEndpoint();
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const walletPubkey = new PublicKey(address);

        // Step 1: Get LONG/SHORT mint addresses for ICBS pool (only if poolAddress provided)
        let poolData = null;
        if (poolAddress) {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );

          const { data, error: poolError } = await supabase
            .from('pool_deployments')
            .select('long_mint_address, short_mint_address')
            .eq('pool_address', poolAddress)
            .single();

          if (poolError) {
            console.error('[useSwapBalances] Pool not found:', poolError);
          } else {
            poolData = data;
          }
        }

        // Step 2: Get USDC mint from network config
        const usdcMint = getUsdcMint();

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

        // Step 4: Fetch LONG token balance (only if pool data available)
        if (poolData?.long_mint_address) {
          try {
            const longMint = new PublicKey(poolData.long_mint_address);
            const longTokenAccount = await getAssociatedTokenAddress(
              longMint,
              walletPubkey
            );

            const accountInfo = await getAccount(connection, longTokenAccount);
            // Convert from atomic units (6 decimals) to display units
            const balance = Number(accountInfo.amount) / 1_000_000;
            setLongBalance(balance);
            setShareBalance(balance); // Keep shareBalance for backward compatibility
          } catch (err) {
            // Token account doesn't exist yet - that's OK
            setLongBalance(0);
            setShareBalance(0);
          }
        } else {
          setLongBalance(0);
          setShareBalance(0);
        }

        // Step 5: Fetch SHORT token balance (only if pool data available)
        if (poolData?.short_mint_address) {
          try {
            const shortMint = new PublicKey(poolData.short_mint_address);
            const shortTokenAccount = await getAssociatedTokenAddress(
              shortMint,
              walletPubkey
            );

            const accountInfo = await getAccount(connection, shortTokenAccount);
            // Convert from atomic units (6 decimals) to display units
            const balance = Number(accountInfo.amount) / 1_000_000;
            setShortBalance(balance);
          } catch (err) {
            // Token account doesn't exist yet - that's OK
            setShortBalance(0);
          }
        } else {
          setShortBalance(0);
        }
      } catch (error) {
        console.error('[useSwapBalances] Error fetching balances:', error);
        setUsdcBalance(0);
        setShareBalance(0);
        setLongBalance(0);
        setShortBalance(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [address, poolAddress, postId, refreshTrigger]);

  return {
    usdcBalance,
    shareBalance,
    longBalance,
    shortBalance,
    loading,
    refresh,
  };
}
