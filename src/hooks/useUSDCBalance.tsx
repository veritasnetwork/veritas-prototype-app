import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getUsdcMint, getRpcEndpoint } from '@/lib/solana/network-config';

export function useUSDCBalance(walletAddress: string | null | undefined) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      // Validate wallet address before proceeding
      if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
        setBalance(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Use the network-aware RPC endpoint
        const rpcUrl = getRpcEndpoint();
        const connection = new Connection(rpcUrl, 'confirmed');

        let publicKey: PublicKey;
        try {
          publicKey = new PublicKey(walletAddress);
        } catch (pubkeyError: any) {
          console.warn('Skipping USDC balance fetch - invalid wallet address:', walletAddress);
          // Don't throw - just silently set balance to null
          setBalance(null);
          setLoading(false);
          return;
        }

        // Use the network-aware USDC mint (handles localnet, devnet, mainnet)
        const usdcMint = getUsdcMint();

        // Get token accounts for this wallet with the USDC mint
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { mint: usdcMint }
        );

        if (tokenAccounts.value.length > 0) {
          // Get the UI amount (already adjusted for decimals)
          const uiAmount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
          setBalance(uiAmount || 0);
        } else {
          // No USDC token account found
          setBalance(0);
        }
      } catch (err: any) {
        console.error('Failed to fetch USDC balance:', err);
        setError(err.message || 'Failed to fetch balance');
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [walletAddress]);

  return { balance, loading, error };
}
