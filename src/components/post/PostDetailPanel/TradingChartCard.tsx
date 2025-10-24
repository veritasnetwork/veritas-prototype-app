/**
 * TradingChartCard Component
 * Bubble card displaying trading history chart with time range selector
 * Now supports toggling between price history and relevance history
 */

'use client';

import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Activity, TrendingUp, RefreshCw } from 'lucide-react';
import { RelevanceHistoryChart } from '@/components/charts/RelevanceHistoryChart';

const TradingHistoryChart = lazy(() =>
  import('@/components/charts/TradingHistoryChart').then(m => ({ default: m.TradingHistoryChart }))
);
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

  // Refs for measuring button positions
  const chartTypeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const timeRangeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [chartTypeSliderStyle, setChartTypeSliderStyle] = useState<React.CSSProperties>({});
  const [timeRangeSliderStyle, setTimeRangeSliderStyle] = useState<React.CSSProperties>({});

  const { data: tradeHistory, isLoading: historyLoading } = useTradeHistory(postId, timeRange);

  // ✅ OPTIMIZATION: Only fetch relevance when chart type is 'relevance'
  const { data: relevanceData, isLoading: relevanceLoading, error: relevanceError, refetch: refetchRelevance } = useRelevanceHistory(
    chartType === 'relevance' ? postId : undefined
  );

  const { poolData } = usePoolData(undefined, postId);
  const { rebasePool, isRebasing, error: rebaseError } = useRebasePool();

  const handleRebase = async () => {
    const result = await rebasePool(postId);

    if (result.success) {
      // Refresh data after successful rebase
      await refetchRelevance();
      alert(`Pool rebased successfully!\nNew BD Score: ${(result.bdScore! * 100).toFixed(1)}%\nRewards: $${result.stakeChanges!.totalRewards.toFixed(2)}\nSlashes: $${result.stakeChanges!.totalSlashes.toFixed(2)}`);
    } else {
      alert(`Rebase failed: ${result.error}`);
    }
  };

  // Update slider position when chartType changes
  useEffect(() => {
    const updateChartTypeSlider = () => {
      const activeButton = chartTypeRefs.current[chartType];
      if (activeButton) {
        const { offsetLeft, offsetWidth } = activeButton;
        setChartTypeSliderStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        });
      }
    };

    // Use setTimeout to ensure buttons are rendered
    const timer = setTimeout(updateChartTypeSlider, 0);

    return () => clearTimeout(timer);
  }, [chartType]);

  // Update slider position when timeRange changes
  useEffect(() => {
    const updateTimeRangeSlider = () => {
      const activeButton = timeRangeRefs.current[timeRange];
      if (activeButton) {
        const { offsetLeft, offsetWidth } = activeButton;
        setTimeRangeSliderStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        });
      }
    };

    // Use setTimeout to ensure buttons are rendered
    const timer = setTimeout(updateTimeRangeSlider, 0);

    return () => clearTimeout(timer);
  }, [timeRange]);

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl overflow-hidden">
      {/* Header with Chart Type Toggle, Rebase Button, and Time Range Selector */}
      <div className="flex justify-between items-center p-4 pb-0">
        {/* Chart Type Toggle */}
        <div className="relative flex bg-black/50 rounded-md p-0.5 gap-0.5">
          {/* Animated background slider */}
          <div
            className="absolute top-0.5 bottom-0.5 rounded transition-all duration-300 ease-in-out bg-[#F0EAD6]"
            style={chartTypeSliderStyle}
          />
          {(['price', 'relevance'] as ChartType[]).map((type) => (
            <button
              key={type}
              ref={(el) => (chartTypeRefs.current[type] = el)}
              onClick={() => setChartType(type)}
              className={`flex-1 px-3 py-1 rounded text-xs font-medium transition-colors duration-300 capitalize relative z-10 ${
                chartType === type
                  ? 'text-black'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Rebase Button - Centered */}
        <button
          onClick={handleRebase}
          disabled={isRebasing}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#F0EAD6]/10 hover:bg-[#F0EAD6]/20 border border-[#F0EAD6]/30 rounded-md text-xs font-medium text-[#F0EAD6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Run epoch processing and settle pool"
        >
          <RefreshCw className={`w-3 h-3 ${isRebasing ? 'animate-spin' : ''}`} />
          {isRebasing ? 'Rebasing...' : 'Rebase'}
        </button>

        {/* Time Range Selector - always rendered but invisible on relevance chart */}
        <div className={`relative flex bg-black/50 rounded-md p-0.5 gap-0.5 ${chartType === 'relevance' ? 'invisible' : ''}`}>
          {/* Animated background slider */}
          <div
            className="absolute top-0.5 bottom-0.5 rounded transition-all duration-300 ease-in-out bg-[#F0EAD6]"
            style={timeRangeSliderStyle}
          />
          {(['1H', '24H', '7D', 'ALL'] as TimeRange[]).map((range) => (
            <button
              key={range}
              ref={(el) => (timeRangeRefs.current[range] = el)}
              onClick={() => setTimeRange(range)}
              className={`flex-1 px-2 py-0.5 rounded text-xs font-medium transition-colors duration-300 relative z-10 ${
                timeRange === range
                  ? 'text-black'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
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
          ) : tradeHistory && tradeHistory.priceLongData && tradeHistory.priceShortData && (tradeHistory.priceLongData.length > 0 || tradeHistory.priceShortData.length > 0) ? (
            <Suspense fallback={
              <div className="w-full h-[400px] bg-[#0a0a0a] rounded-lg flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#B9D9EB] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400 text-sm">Loading chart...</p>
                </div>
              </div>
            }>
              <TradingHistoryChart
                priceLongData={tradeHistory.priceLongData}
                priceShortData={tradeHistory.priceShortData}
                volumeData={tradeHistory.volumeData}
                height={400}
              />
            </Suspense>
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
          relevanceLoading && !relevanceError ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-[#22c55e] border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500 text-xs">Loading relevance data...</p>
              </div>
            </div>
          ) : relevanceData && (relevanceData.actualRelevance.length > 0 || relevanceData.impliedRelevance.length > 0) ? (
            <RelevanceHistoryChart
              actualRelevance={relevanceData.actualRelevance}
              impliedRelevance={relevanceData.impliedRelevance}
              height={400}
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm mb-1">No relevance data yet</p>
                <p className="text-gray-600 text-xs">Scores appear after first rebase</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
