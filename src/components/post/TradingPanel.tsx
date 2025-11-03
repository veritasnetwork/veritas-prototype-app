/**
 * TradingPanel Component
 * Reusable trading panel showing charts, metrics, and swap interface
 * Used in both Feed (sidebar) and PostDetailPage
 */

'use client';

import { Suspense } from 'react';
import { TradingChartCard } from './PostDetailPanel/TradingChartCard';
import { PoolMetricsCard } from './PostDetailPanel/PoolMetricsCard';
import { UnifiedSwapComponent } from './PostDetailPanel/UnifiedSwapComponent';
import { DeployPoolCard } from './PostDetailPanel/DeployPoolCard';
import { useRebaseStatus } from '@/hooks/api/useRebaseStatus';
import type { PoolData } from '@/hooks/usePoolData';
import type { TradeStats } from '@/hooks/api/useTradeHistory';

interface TradingPanelProps {
  postId: string;
  poolAddress?: string;
  poolData?: PoolData | null;
  tradeStats?: TradeStats;
  selectedSide: 'LONG' | 'SHORT';
  onSideChange: (side: 'LONG' | 'SHORT') => void;
  onTradeSuccess?: () => void;
  loadingPoolData?: boolean;
  // Initial pool data from post (for instant rendering)
  initialPoolData?: {
    priceLong: number;
    priceShort: number;
    supplyLong: number;
    supplyShort: number;
    f: number;
    betaNum: number;
    betaDen: number;
    vaultBalance: number;
  };
}

// Loading skeleton component
function LoadingCard({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg ${height} flex items-center justify-center`}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    </div>
  );
}

export function TradingPanel({
  postId,
  poolAddress,
  poolData,
  tradeStats,
  selectedSide,
  onSideChange,
  onTradeSuccess,
  loadingPoolData = false,
  initialPoolData,
}: TradingPanelProps) {
  // Fetch rebase status for TradingChartCard
  const { data: rebaseStatus } = useRebaseStatus(postId);

  // Use poolData if available, fallback to initialPoolData for instant rendering
  const displayPoolData = poolData || (initialPoolData ? {
    priceLong: initialPoolData.priceLong,
    priceShort: initialPoolData.priceShort,
    supplyLong: initialPoolData.supplyLong,
    supplyShort: initialPoolData.supplyShort,
    f: initialPoolData.f,
    betaNum: initialPoolData.betaNum,
    betaDen: initialPoolData.betaDen,
    vaultBalance: initialPoolData.vaultBalance,
    totalSupply: initialPoolData.supplyLong + initialPoolData.supplyShort,
    currentPrice: 0, // Will be calculated by component
    reserveBalance: initialPoolData.vaultBalance,
    marketCap: 0, // Will be calculated by component
    rLong: initialPoolData.supplyLong,
    rShort: initialPoolData.supplyShort,
  } : null);

  return (
    <div className="space-y-4">
      {/* Deploy Pool Card - Show if no pool exists */}
      {!poolAddress && (
        <Suspense fallback={<LoadingCard />}>
          <DeployPoolCard
            postId={postId}
            onDeploySuccess={onTradeSuccess}
          />
        </Suspense>
      )}

      {/* Trading Chart Card - Show if pool exists */}
      {poolAddress && (
        <Suspense fallback={<LoadingCard height="h-96" />}>
          <TradingChartCard
            postId={postId}
            poolData={displayPoolData}
            rebaseStatus={rebaseStatus}
          />
        </Suspense>
      )}

      {/* Pool Metrics Card - Show if pool exists */}
      {poolAddress && (
        <Suspense fallback={<LoadingCard height="h-48" />}>
          {displayPoolData ? (
            <PoolMetricsCard
              poolData={displayPoolData}
              stats={tradeStats}
              side={selectedSide}
            />
          ) : (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3">
              <div className="flex items-center justify-center py-2">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-gray-400">Loading pool data...</span>
                </div>
              </div>
            </div>
          )}
        </Suspense>
      )}

      {/* Swap Card - Show if pool exists */}
      {poolAddress && (
        <Suspense fallback={<LoadingCard />}>
          {displayPoolData ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <UnifiedSwapComponent
                poolAddress={poolAddress}
                postId={postId}
                priceLong={displayPoolData.priceLong}
                priceShort={displayPoolData.priceShort}
                supplyLong={displayPoolData.supplyLong}
                supplyShort={displayPoolData.supplyShort}
                f={displayPoolData.f}
                betaNum={displayPoolData.betaNum}
                betaDen={displayPoolData.betaDen}
                selectedSide={selectedSide}
                onSideChange={onSideChange}
                onTradeSuccess={onTradeSuccess}
              />
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-gray-400">Loading trading interface...</span>
                </div>
              </div>
            </div>
          )}
        </Suspense>
      )}
    </div>
  );
}
