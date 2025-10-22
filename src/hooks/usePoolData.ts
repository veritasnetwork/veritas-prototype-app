/**
 * Hook to fetch ICBS pool data from on-chain (via API)
 * - Defensive number coercion
 * - Real request cancellation
 * - NaN/Infinity guards
 */

import { useEffect, useMemo, useState } from 'react';

export interface PoolData {
  priceLong: number;       // USDC (display units)
  priceShort: number;      // USDC (display units)
  supplyLong: number;      // tokens (display units, not atomic)
  supplyShort: number;     // tokens (display units, not atomic)
  f: number;
  betaNum: number;
  betaDen: number;
  vaultBalance: number;    // USDC (display units)
  totalSupply: number;     // tokens (display units)
  currentPrice: number;    // weighted avg price (USDC)
  reserveBalance: number;  // alias of vaultBalance (compat)
  marketCap: number;       // USDC (display units)
}

type ApiPool = {
  poolPriceLong?: number | string | null;
  poolPriceShort?: number | string | null;
  poolSupplyLong?: number | string | null;
  poolSupplyShort?: number | string | null;
  poolVaultBalance?: number | string | null;
  poolF?: number | string | null;
  poolBetaNum?: number | string | null;
  poolBetaDen?: number | string | null;
};

function coerceNumber(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  if (typeof x === 'string') {
    const v = Number(x);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

function safeNumber(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function usePoolData(poolAddress: string | undefined, postId: string | undefined) {
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Memoize URL to avoid unnecessary effect triggers
  const url = useMemo(() => (postId ? `/api/posts/${postId}` : null), [postId]);

  useEffect(() => {
    if (!url) {
      setPoolData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Prefer fresh data for prices
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

        const raw: unknown = await response.json();
        const data = (raw ?? {}) as ApiPool;

        const priceLong = coerceNumber(data.poolPriceLong);
        const priceShort = coerceNumber(data.poolPriceShort);
        const supplyLong = coerceNumber(data.poolSupplyLong);
        const supplyShort = coerceNumber(data.poolSupplyShort);

        if (priceLong === null || priceShort === null || supplyLong === null || supplyShort === null) {
          // Don't throw hard—treat as "no data"
          setPoolData(null);
          return;
        }

        // Defaults aligned with on-chain F=1, β=1/2
        const f = coerceNumber(data.poolF) ?? 1;
        const betaNum = coerceNumber(data.poolBetaNum) ?? 1;
        const betaDen = coerceNumber(data.poolBetaDen) ?? 2;

        // Vault balance (display units, not lamports)
        const vaultBalance = coerceNumber(data.poolVaultBalance) ?? 0;

        // Derived values with NaN/Infinity guards
        const totalSupply = safeNumber(supplyLong + supplyShort);
        const marketCapLong = safeNumber(supplyLong * priceLong);
        const marketCapShort = safeNumber(supplyShort * priceShort);
        const marketCap = safeNumber(marketCapLong + marketCapShort);
        const currentPrice = totalSupply > 0 ? safeNumber(marketCap / totalSupply) : 0;

        setPoolData({
          priceLong,
          priceShort,
          supplyLong,
          supplyShort,
          f,
          betaNum,
          betaDen,
          vaultBalance,
          totalSupply,
          currentPrice,
          reserveBalance: vaultBalance, // for PoolMetricsCard compatibility
          marketCap,
        });
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        console.error('Error fetching pool data:', e);
        setError(e instanceof Error ? e : new Error('Unknown error'));
        setPoolData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [url, poolAddress]); // keep poolAddress to refetch when it changes

  return { poolData, loading, error };
}
