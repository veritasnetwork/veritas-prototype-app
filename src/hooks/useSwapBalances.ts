import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useSolanaWallet } from './useSolanaWallet';
import { getRpcEndpoint, getUsdcMint } from '@/lib/solana/network-config';
import { createClient } from '@supabase/supabase-js';

// Cache balances in memory (persists during session, across component remounts)
const balanceCache = new Map<string, {
  usdcBalance: number;
  longBalance: number;
  shortBalance: number;
  timestamp: number;
}>();

const CACHE_DURATION = 30 * 1000; // 30 seconds

export function useSwapBalances(poolAddress: string, postId: string) {
  const { address, isLoading: walletLoading, needsReconnection } = useSolanaWallet();

  // Initialize state from cache if available
  const getCachedBalances = () => {
    if (!address) return { usdc: 0, long: 0, short: 0 };

    const cacheKey = `${address}-${poolAddress || 'no-pool'}`;
    const cached = balanceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        usdc: cached.usdcBalance,
        long: cached.longBalance,
        short: cached.shortBalance,
      };
    }

    return { usdc: 0, long: 0, short: 0 };
  };

  const initialBalances = getCachedBalances();
  const [usdcBalance, setUsdcBalance] = useState<number>(initialBalances.usdc);
  const [shareBalance, setShareBalance] = useState<number>(initialBalances.long);
  const [longBalance, setLongBalance] = useState<number>(initialBalances.long);
  const [shortBalance, setShortBalance] = useState<number>(initialBalances.short);
  const [loading, setLoading] = useState(!address || initialBalances.usdc === 0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Track if we've ever successfully fetched balances for this wallet
  const lastSuccessfulAddress = useRef<string | null>(null);
  const hasFetchedOnce = useRef(false);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Reset state when wallet address changes (user switches accounts)
  useEffect(() => {
    if (address && lastSuccessfulAddress.current && address !== lastSuccessfulAddress.current) {
      // Different wallet connected, reset state and clear cache for old wallet
      hasFetchedOnce.current = false;
      lastSuccessfulAddress.current = null;
    }
  }, [address]);

  useEffect(() => {
    const fetchBalances = async () => {
      // If wallet is still loading or needs reconnection, wait
      if (walletLoading) {
        return; // Keep showing cached balances
      }

      if (!address) {
        // User logged out - only clear if we don't have cached balances
        const cached = getCachedBalances();
        if (cached.usdc === 0) {
          setUsdcBalance(0);
          setShareBalance(0);
          setLongBalance(0);
          setShortBalance(0);
          setLoading(false);
        }
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
        let fetchedUsdcBalance = 0;
        try {
          const usdcTokenAccount = await getAssociatedTokenAddress(
            usdcMint,
            walletPubkey
          );

          const accountInfo = await getAccount(connection, usdcTokenAccount);
          // Convert from micro-USDC (6 decimals) to USDC
          fetchedUsdcBalance = Number(accountInfo.amount) / 1_000_000;
          setUsdcBalance(fetchedUsdcBalance);
        } catch (err) {
          console.error('[useSwapBalances] USDC account error:', err);
          setUsdcBalance(0);
        }

        // Step 4: Fetch LONG token balance (only if pool data available)
        let fetchedLongBalance = 0;
        if (poolData?.long_mint_address) {
          try {
            const longMint = new PublicKey(poolData.long_mint_address);
            const longTokenAccount = await getAssociatedTokenAddress(
              longMint,
              walletPubkey
            );

            const accountInfo = await getAccount(connection, longTokenAccount);
            // Convert from atomic units (6 decimals) to display units
            fetchedLongBalance = Number(accountInfo.amount) / 1_000_000;
            setLongBalance(fetchedLongBalance);
            setShareBalance(fetchedLongBalance); // Keep shareBalance for backward compatibility
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
        let fetchedShortBalance = 0;
        if (poolData?.short_mint_address) {
          try {
            const shortMint = new PublicKey(poolData.short_mint_address);
            const shortTokenAccount = await getAssociatedTokenAddress(
              shortMint,
              walletPubkey
            );

            const accountInfo = await getAccount(connection, shortTokenAccount);
            // Convert from atomic units (6 decimals) to display units
            fetchedShortBalance = Number(accountInfo.amount) / 1_000_000;
            setShortBalance(fetchedShortBalance);
          } catch (err) {
            // Token account doesn't exist yet - that's OK
            setShortBalance(0);
          }
        } else {
          setShortBalance(0);
        }

        // Mark that we've successfully loaded balances and cache them
        hasFetchedOnce.current = true;
        lastSuccessfulAddress.current = address;

        // Cache balances for this wallet + pool combination
        const cacheKey = `${address}-${poolAddress || 'no-pool'}`;
        balanceCache.set(cacheKey, {
          usdcBalance: fetchedUsdcBalance,
          longBalance: fetchedLongBalance,
          shortBalance: fetchedShortBalance,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('[useSwapBalances] Error fetching balances:', error);
        // On error, keep showing cached balances if available
        // Only reset to 0 if this is first fetch and no cache
        if (!hasFetchedOnce.current) {
          const cached = getCachedBalances();
          if (cached.usdc === 0) {
            setUsdcBalance(0);
            setShareBalance(0);
            setLongBalance(0);
            setShortBalance(0);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [address, poolAddress, postId, refreshTrigger, walletLoading]);

  return {
    usdcBalance,
    shareBalance,
    longBalance,
    shortBalance,
    loading,
    refresh,
  };
}
