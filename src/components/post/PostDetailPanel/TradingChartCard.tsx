/**
 * TradingChartCard Component
 * Bubble card displaying trading history chart with time range selector
 * Now supports toggling between price history and relevance history
 */

'use client';

import { useState } from 'react';
import { Activity, TrendingUp, RefreshCw } from 'lucide-react';
import { TradingHistoryChart } from '@/components/charts/TradingHistoryChart';
import { RelevanceHistoryChart } from '@/components/charts/RelevanceHistoryChart';
import { useTradeHistory, TimeRange } from '@/hooks/api/useTradeHistory';
import { useRelevanceHistory } from '@/hooks/api/useRelevanceHistory';
import { useRebasePool } from '@/hooks/useRebasePool';
import { usePoolData } from '@/hooks/usePoolData';

type ChartType = 'price' | 'relevance';

interface TradingChartCardProps {
  postId: string;
}

export function TradingChartCard({ postId }: TradingChartCardProps) {
  const [chartType, setChartType] = useState<ChartType>('price');
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');

  const { data: tradeHistory, isLoading: historyLoading } = useTradeHistory(postId, timeRange);

  // ✅ OPTIMIZATION: Only fetch relevance when chart type is 'relevance'
  const { data: relevanceData, isLoading: relevanceLoading, refetch: refetchRelevance } = useRelevanceHistory(
    chartType === 'relevance' ? postId : undefined
  );

  const { poolData, refetch: refetchPoolData } = usePoolData(postId);
  const { rebasePool, isRebasing, error: rebaseError } = useRebasePool();

  const handleRebase = async () => {
    const result = await rebasePool(postId);

    if (result.success) {
      // Refresh data after successful rebase
      await refetchPoolData();
      await refetchRelevance();
      alert(`Pool rebased successfully!\nNew BD Score: ${(result.bdScore! * 100).toFixed(1)}%\nRewards: $${result.stakeChanges!.totalRewards.toFixed(2)}\nSlashes: $${result.stakeChanges!.totalSlashes.toFixed(2)}`);
    } else {
      alert(`Rebase failed: ${result.error}`);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl overflow-hidden">
      {/* Header with Chart Type Toggle, Rebase Button, and Time Range Selector */}
      <div className="flex justify-between items-center p-4 pb-0">
        <div className="flex items-center gap-3">
          {/* Chart Type Toggle */}
          <div className="flex gap-0.5 bg-black/50 rounded-md p-0.5">
            {(['price', 'relevance'] as ChartType[]).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                  chartType === type
                    ? 'bg-[#B9D9EB] text-black'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Rebase Button */}
          <button
            onClick={handleRebase}
            disabled={isRebasing}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#22c55e]/10 hover:bg-[#22c55e]/20 border border-[#22c55e]/30 rounded-md text-xs font-medium text-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Run epoch processing and settle pool"
          >
            <RefreshCw className={`w-3 h-3 ${isRebasing ? 'animate-spin' : ''}`} />
            {isRebasing ? 'Rebasing...' : 'Rebase'}
          </button>
        </div>

        {/* Time Range Selector (only for price chart) */}
        {chartType === 'price' && (
          <div className="flex gap-0.5 bg-black/50 rounded-md p-0.5">
            {(['1H', '24H', '7D', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-[#B9D9EB] text-black'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart Area */}
      <div className="p-4 pt-2">
        {chartType === 'price' ? (
          // Price Chart
          historyLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-[#B9D9EB] border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500 text-xs">Loading price data...</p>
              </div>
            </div>
          ) : tradeHistory && tradeHistory.priceData.length > 0 ? (
            <TradingHistoryChart
              priceData={tradeHistory.priceData}
              volumeData={tradeHistory.volumeData}
              height={400}
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm mb-1">No trades yet</p>
                <p className="text-gray-600 text-xs">Be the first to trade</p>
              </div>
            </div>
          )
        ) : (
          // Relevance Chart
          relevanceLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-[#22c55e] border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500 text-xs">Loading relevance data...</p>
              </div>
            </div>
          ) : relevanceData.length > 0 ? (
            <RelevanceHistoryChart relevanceData={relevanceData} height={400} />
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm mb-1">No relevance data yet</p>
                <p className="text-gray-600 text-xs">Scores appear after first epoch settlement</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
