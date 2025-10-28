/**
 * useWalletBalances Hook
 *
 * Single source of truth for fetching wallet balances (SOL + USDC)
 * Environment-aware - uses getRpcEndpoint() and getUsdcMint()
 */

import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { getRpcEndpoint, getUsdcMint } from '@/lib/solana/network-config';

interface WalletBalances {
  sol: number;
  usdc: number;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useWalletBalances(walletAddress?: string | null): WalletBalances {
  const [sol, setSol] = useState(0);
  const [usdc, setUsdc] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setSol(0);
      setUsdc(0);
      setLoading(false);
      return;
    }

    const fetchBalances = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use environment-aware RPC endpoint
        const rpcEndpoint = getRpcEndpoint();
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const walletPubkey = new PublicKey(walletAddress);

        // Fetch SOL balance
        const solBalanceLamports = await connection.getBalance(walletPubkey);
        setSol(solBalanceLamports / 1e9);

        // Fetch USDC balance using environment-aware mint
        try {
          const usdcMintPubkey = getUsdcMint();
          const ata = getAssociatedTokenAddressSync(usdcMintPubkey, walletPubkey);
          const tokenAccountInfo = await connection.getTokenAccountBalance(ata);
          const balance = parseFloat(tokenAccountInfo.value.uiAmount?.toFixed(2) || '0');
          setUsdc(balance);
        } catch (err) {
          // Token account doesn't exist or other error
          setUsdc(0);
        }
      } catch (err) {
        console.error('[useWalletBalances] Error fetching balances:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch balances'));
        setSol(0);
        setUsdc(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [walletAddress, refreshTrigger]);

  return {
    sol,
    usdc,
    loading,
    error,
    refresh,
  };
}
