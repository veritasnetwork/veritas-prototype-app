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

        // Step 1: Get the pool's vault and token mint addresses from database
        const { data: poolData, error: poolError } = await supabase
          .from('pool_deployments')
          .select('usdc_vault_address, token_mint_address')
          .eq('pool_address', poolAddress)
          .single();

        if (poolError || !poolData?.usdc_vault_address || !poolData?.token_mint_address) {
          console.error('[useSwapBalances] Pool not found:', poolError);
          setUsdcBalance(0);
          setShareBalance(0);
          setLoading(false);
          return;
        }

        const vaultAddress = new PublicKey(poolData.usdc_vault_address);
        const tokenMint = new PublicKey(poolData.token_mint_address);

        // Step 2: Fetch the vault account to get the USDC mint address
        // This is network-agnostic - works on localnet, devnet, and mainnet
        const vaultAccount = await getAccount(connection, vaultAddress);
        const usdcMint = vaultAccount.mint; // The actual USDC mint used by this pool

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

        // Step 4: Fetch share balance from blockchain (use the pool's token mint)
        try {
          const shareTokenAccount = await getAssociatedTokenAddress(
            tokenMint, // Use the pool's share token mint, not USDC mint
            walletPubkey
          );

          const accountInfo = await getAccount(connection, shareTokenAccount);
          // Convert from atomic units (6 decimals) to display units
          const balance = Number(accountInfo.amount) / 1_000_000;
          setShareBalance(balance);
        } catch (err) {
          console.error('[useSwapBalances] Share account error:', err);
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
