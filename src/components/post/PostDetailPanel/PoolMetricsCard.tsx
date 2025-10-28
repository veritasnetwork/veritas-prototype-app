/**
 * PoolMetricsCard Component
 * Compact horizontal strip displaying pool metrics
 * Receives data as props from parent
 */

'use client';

import type { PoolData } from '@/hooks/usePoolData';
import type { TradeStats } from '@/hooks/api/useTradeHistory';

interface PoolMetricsCardProps {
  poolData: PoolData | null;
  stats?: TradeStats;
  side: 'LONG' | 'SHORT';
}

/**
 * Format numbers with appropriate precision and suffixes
 * - Large numbers: k/m/b suffixes (1.2k, 1.2m, 1.2b) with 1 decimal
 * - Small numbers: More decimal places (0.000068)
 * - Tiny numbers: Scientific notation (6.8e-5)
 * @param value - The number to format
 * @param isPrice - If true, shows 2 decimals for normal values; if false, shows whole numbers
 */
function formatCompactNumber(value: number, isPrice: boolean = false): string {
  // Handle large numbers with k/m/b suffixes
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}b`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  // Handle tiny values with appropriate precision (only relevant for prices)
  if (isPrice && value < 0.01 && value > 0) {
    if (value < 0.000001) {
      // Ultra-tiny: use scientific notation
      return value.toExponential(2);
    }
    if (value < 0.0001) {
      // Micro: show 6 decimals
      return value.toFixed(6);
    }
    if (value < 0.001) {
      // Small: show 5 decimals
      return value.toFixed(5);
    }
    // Show 4 decimals for values between 0.001 and 0.01
    return value.toFixed(4);
  }

  // Normal values: 2 decimals for prices, whole numbers for everything else
  return isPrice ? value.toFixed(2) : Math.round(value).toString();
}

export function PoolMetricsCard({
  poolData,
  stats,
  side,
}: PoolMetricsCardProps) {
  // Early return if no data
  if (!poolData) {
    return null;
  }

  // Extract values from poolData
  const { priceLong, priceShort, supplyLong, supplyShort, reserveBalance } = poolData;

  // Calculate side-specific market caps
  // Note: When supply is 0, price calculation may be undefined/zero but market cap should be 0
  const marketCapLong = (supplyLong > 0 && priceLong > 0) ? supplyLong * priceLong : 0;
  const marketCapShort = (supplyShort > 0 && priceShort > 0) ? supplyShort * priceShort : 0;

  // Calculate reserves based on ICBS virtual reserves (r = s × p)
  // When both supplies are 0, pool has no tokens and reserves should be 0
  // When only one supply is 0, that side has no reserves
  const totalMarketCap = marketCapLong + marketCapShort;
  let reserveLong = 0;
  let reserveShort = 0;

  if (totalMarketCap > 0) {
    // Normal case: distribute vault balance proportionally to market caps
    reserveLong = (reserveBalance * marketCapLong) / totalMarketCap;
    reserveShort = (reserveBalance * marketCapShort) / totalMarketCap;
  } else if (supplyLong === 0 && supplyShort === 0) {
    // Both supplies are 0: no reserves (pool is empty)
    reserveLong = 0;
    reserveShort = 0;
  } else {
    // Edge case: shouldn't happen in practice but split equally as fallback
    reserveLong = reserveBalance / 2;
    reserveShort = reserveBalance / 2;
  }

  // Debug logging
  console.log('[PoolMetricsCard] Reserve calculation:', {
    reserveBalance,
    marketCapLong,
    marketCapShort,
    totalMarketCap,
    reserveLong,
    reserveShort,
    side,
    sideReserve: side === 'LONG' ? reserveLong : reserveShort,
  });

  // Get stats values (with fallbacks)
  const priceChangeLong24h = stats?.priceChangePercentLong24h;
  const priceChangeShort24h = stats?.priceChangePercentShort24h;
  const volumeLong = stats?.volumeLong;
  const volumeShort = stats?.volumeShort;

  // Select metrics based on active side
  const currentPrice = side === 'LONG' ? priceLong : priceShort;
  const marketCap = side === 'LONG' ? marketCapLong : marketCapShort;
  const totalSupply = side === 'LONG' ? supplyLong : supplyShort;
  const sideReserve = side === 'LONG' ? reserveLong : reserveShort;
  const priceChangePercent24h = side === 'LONG' ? priceChangeLong24h : priceChangeShort24h;
  const totalVolume = side === 'LONG' ? volumeLong : volumeShort;
  const sideColor = side === 'LONG' ? 'text-[#B9D9EB]' : 'text-orange-400';

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3">
      {/* Desktop: Horizontal layout with label-value pairs */}
      <div className="hidden md:flex items-center justify-center gap-2 overflow-x-auto">
        {/* Side Indicator Dot */}
        <div className="shrink-0">
          <div className={`w-2 h-2 rounded-full ${side === 'LONG' ? 'bg-[#B9D9EB]' : 'bg-orange-400'}`} />
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Price</span>
          <p className="text-sm font-semibold text-white tabular-nums">${currentPrice.toFixed(2)}</p>
        </div>

        {/* 24h Change (only if available) */}
        {priceChangePercent24h !== undefined && priceChangePercent24h !== 0 && (
          <div className={`px-1.5 py-0.5 rounded text-xs font-medium tabular-nums shrink-0 ${
            priceChangePercent24h > 0
              ? 'bg-[#B9D9EB]/20 text-[#B9D9EB]'
              : 'bg-orange-400/20 text-orange-400'
          }`}>
            {priceChangePercent24h >= 0 ? '+' : ''}{Math.round(priceChangePercent24h)}%
          </div>
        )}

        {/* Divider */}
        <div className="h-8 w-px bg-[#2a2a2a] shrink-0 mx-1.5" />

        {/* Market Cap */}
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Mkt</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(marketCap)}</p>
        </div>

        {/* Supply */}
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Supply</span>
          <p className="text-sm font-semibold text-white tabular-nums">{formatCompactNumber(totalSupply)}</p>
        </div>

        {/* Reserve */}
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Reserve</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(sideReserve)}</p>
        </div>

        {/* Volume (if available) */}
        {totalVolume !== undefined && (
          <>
            <div className="h-8 w-px bg-[#2a2a2a] shrink-0 mx-1.5" />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Vol</span>
              <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(totalVolume)}</p>
            </div>
          </>
        )}
      </div>

      {/* Mobile: Horizontal scrollable layout */}
      <div className="md:hidden flex items-center gap-3 overflow-x-auto">
        {/* Side Indicator Dot */}
        <div className="shrink-0">
          <div className={`w-2 h-2 rounded-full ${side === 'LONG' ? 'bg-[#B9D9EB]' : 'bg-orange-400'}`} />
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Price</span>
          <p className="text-sm font-semibold text-white tabular-nums">${currentPrice.toFixed(2)}</p>
        </div>

        {/* 24h Change (only if available) */}
        {priceChangePercent24h !== undefined && priceChangePercent24h !== 0 && (
          <div className={`px-1.5 py-0.5 rounded text-xs font-medium tabular-nums shrink-0 ${
            priceChangePercent24h > 0
              ? 'bg-[#B9D9EB]/20 text-[#B9D9EB]'
              : 'bg-orange-400/20 text-orange-400'
          }`}>
            {priceChangePercent24h >= 0 ? '+' : ''}{Math.round(priceChangePercent24h)}%
          </div>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-[#2a2a2a] shrink-0" />

        {/* Market Cap */}
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Mkt</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(marketCap)}</p>
        </div>

        {/* Supply */}
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Supply</span>
          <p className="text-sm font-semibold text-white tabular-nums">{formatCompactNumber(totalSupply)}</p>
        </div>

        {/* Reserve */}
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Reserve</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(sideReserve)}</p>
        </div>

        {/* Volume (if available) */}
        {totalVolume !== undefined && (
          <>
            <div className="h-6 w-px bg-[#2a2a2a] shrink-0" />
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Vol</span>
              <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(totalVolume)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
