import { useEffect, useState } from 'react';
import { Connection } from '@solana/web3.js';
import { fetchPoolPrice, PoolPriceData } from '@/lib/solana/pool-price';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const PROGRAM_ID = process.env.NEXT_PUBLIC_VERITAS_PROGRAM_ID || 'GMwWgtvi2USgPa7BeVhDhxGprwpWEAjLm6VTMYHmyxAu';

export function usePoolPrice(postId?: string) {
  const [poolPrice, setPoolPrice] = useState<PoolPriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!postId) {
      setPoolPrice(null);
      return;
    }

    let cancelled = false;

    async function loadPoolPrice() {
      try {
        setLoading(true);
        setError(null);

        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const data = await fetchPoolPrice(connection, postId, PROGRAM_ID);

        if (!cancelled) {
          setPoolPrice(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching pool price:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch pool price'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPoolPrice();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  return { poolPrice, loading, error };
}
