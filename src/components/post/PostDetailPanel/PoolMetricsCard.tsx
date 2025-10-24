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
 * Format large numbers with k/m/b suffixes
 * Examples: 1234 -> 1.23k, 1234567 -> 1.23m, 1234567890 -> 1.23b
 */
function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}b`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k`;
  }
  return value.toFixed(2);
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
  const marketCapLong = supplyLong * priceLong;
  const marketCapShort = supplyShort * priceShort;

  // Split reserves proportionally by market cap
  const totalMarketCap = marketCapLong + marketCapShort;
  const reserveLong = totalMarketCap > 0 ? (reserveBalance * marketCapLong) / totalMarketCap : reserveBalance / 2;
  const reserveShort = totalMarketCap > 0 ? (reserveBalance * marketCapShort) / totalMarketCap : reserveBalance / 2;

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
      {/* Desktop: Horizontal scroll */}
      <div className="hidden md:flex items-center gap-4 overflow-x-auto">
        {/* Side Indicator Dot - far left */}
        <div className="shrink-0 mr-2">
          <div className={`w-2 h-2 rounded-full ${side === 'LONG' ? 'bg-[#B9D9EB]' : 'bg-orange-400'}`} />
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Price</span>
          <p className="text-sm font-semibold text-white tabular-nums w-[55px] text-right">${currentPrice.toFixed(4)}</p>
          {/* 24h Change */}
          <div className="w-[72px]">
            {priceChangePercent24h !== undefined && priceChangePercent24h !== 0 && (
              <div className={`px-2 py-1 rounded text-xs font-medium tabular-nums text-center ${
                priceChangePercent24h > 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {priceChangePercent24h >= 0 ? '+' : ''}{priceChangePercent24h.toFixed(2)}%
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-[#2a2a2a] shrink-0" />

        {/* Market Cap */}
        <div className="shrink-0 w-[60px]">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block">Mkt Cap</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(marketCap)}</p>
        </div>

        {/* Supply */}
        <div className="shrink-0 w-[55px]">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block">Supply</span>
          <p className="text-sm font-semibold text-white tabular-nums">{formatCompactNumber(totalSupply)}</p>
        </div>

        {/* Reserve */}
        <div className="shrink-0 w-[60px]">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block">Reserve</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(sideReserve)}</p>
        </div>

        {/* Volume (if available) */}
        {totalVolume !== undefined && (
          <>
            <div className="h-8 w-px bg-[#2a2a2a] shrink-0" />
            <div className="shrink-0 w-[60px]">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide block">24h Vol</span>
              <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(totalVolume)}</p>
            </div>
          </>
        )}
      </div>

      {/* Mobile: Grid layout (2 columns) */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        {/* Price + Change */}
        <div className="col-span-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Side Indicator Dot */}
            <div className={`w-2 h-2 rounded-full ${side === 'LONG' ? 'bg-[#B9D9EB]' : 'bg-orange-400'}`} />
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Price</span>
            <p className="text-base font-semibold text-white tabular-nums">${currentPrice.toFixed(4)}</p>
          </div>
          {priceChangePercent24h !== undefined && priceChangePercent24h !== 0 && (
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              priceChangePercent24h > 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {priceChangePercent24h >= 0 ? '+' : ''}{priceChangePercent24h.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Market Cap */}
        <div>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Mkt Cap</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(marketCap)}</p>
        </div>

        {/* Supply */}
        <div>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Supply</span>
          <p className="text-sm font-semibold text-white tabular-nums">{formatCompactNumber(totalSupply)}</p>
        </div>

        {/* Reserve */}
        <div>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Reserve</span>
          <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(sideReserve)}</p>
        </div>

        {/* Volume (if available) */}
        {totalVolume !== undefined && (
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">24h Vol</span>
            <p className="text-sm font-semibold text-white tabular-nums">${formatCompactNumber(totalVolume)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
