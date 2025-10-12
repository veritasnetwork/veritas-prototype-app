/**
 * PoolMetricsCard Component
 * Compact horizontal strip displaying pool metrics
 */

'use client';

interface PoolMetricsCardProps {
  currentPrice: number;
  marketCap: number;
  totalSupply: number;
  reserveBalance: number;
  priceChangePercent24h?: number;
  totalVolume?: number;
}

export function PoolMetricsCard({
  currentPrice,
  marketCap,
  totalSupply,
  reserveBalance,
  priceChangePercent24h,
  totalVolume,
}: PoolMetricsCardProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3">
      <div className="flex items-center justify-center gap-6 overflow-x-auto">
        {/* Price */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Price</span>
          <p className="text-sm font-semibold text-white">${currentPrice.toFixed(4)}</p>
          {/* 24h Change */}
          {priceChangePercent24h !== undefined && priceChangePercent24h !== 0 && (
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              priceChangePercent24h >= 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {priceChangePercent24h >= 0 ? '+' : ''}{priceChangePercent24h.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-[#2a2a2a] shrink-0" />

        {/* Market Cap */}
        <div className="shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block">Mkt Cap</span>
          <p className="text-sm font-semibold text-white">${marketCap.toFixed(2)}</p>
        </div>

        {/* Supply */}
        <div className="shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block">Supply</span>
          <p className="text-sm font-semibold text-white">{Math.floor(totalSupply).toLocaleString()}</p>
        </div>

        {/* Reserve */}
        <div className="shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide block">Reserve</span>
          <p className="text-sm font-semibold text-white">${reserveBalance.toFixed(2)}</p>
        </div>

        {/* Volume (if available) */}
        {totalVolume !== undefined && (
          <>
            <div className="h-8 w-px bg-[#2a2a2a] shrink-0" />
            <div className="shrink-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide block">24h Vol</span>
              <p className="text-sm font-semibold text-white">${totalVolume.toFixed(2)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
