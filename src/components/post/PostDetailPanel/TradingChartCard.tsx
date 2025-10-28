/**
 * TradingChartCard Component
 * Bubble card displaying trading history chart with time range selector
 * Now supports toggling between price history and relevance history
 */

'use client';

import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Connection } from '@solana/web3.js';
import { Activity, TrendingUp, RefreshCw } from 'lucide-react';
import { RelevanceHistoryChart } from '@/components/charts/RelevanceHistoryChart';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { FundingPromptModal } from '@/components/wallet/FundingPromptModal';
import { getRpcEndpoint } from '@/lib/solana/network-config';

const TradingHistoryChart = lazy(() =>
  import('@/components/charts/TradingHistoryChart').then(m => ({ default: m.TradingHistoryChart }))
);
import { useTradeHistory, TimeRange } from '@/hooks/api/useTradeHistory';
import { useRelevanceHistory } from '@/hooks/api/useRelevanceHistory';
import { useRebasePool } from '@/hooks/useRebasePool';
import { usePoolData } from '@/hooks/usePoolData';
import { useRebaseStatus } from '@/hooks/api/useRebaseStatus';
import { RebaseConfirmationModal } from '@/components/pool/RebaseConfirmationModal';

type ChartType = 'price' | 'relevance';

interface TradingChartCardProps {
  postId: string;
  refreshTrigger?: number; // Increment this to trigger chart refresh
}

export function TradingChartCard({ postId, refreshTrigger }: TradingChartCardProps) {
  // Randomly choose initial chart type: 50% price, 50% relevance
  const [chartType, setChartType] = useState<ChartType>(() => Math.random() < 0.5 ? 'price' : 'relevance');
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [relevanceTimeRange, setRelevanceTimeRange] = useState<TimeRange>('24H');
  const { requireAuth } = useRequireAuth();
  const { address } = useSolanaWallet();
  const [showFundingPrompt, setShowFundingPrompt] = useState(false);
  const [showRebaseModal, setShowRebaseModal] = useState(false);
  const [solBalance, setSolBalance] = useState<number>(0);

  // Refs for measuring button positions
  const chartTypeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const timeRangeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const relevanceTimeRangeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [chartTypeSliderStyle, setChartTypeSliderStyle] = useState<React.CSSProperties>({});
  const [timeRangeSliderStyle, setTimeRangeSliderStyle] = useState<React.CSSProperties>({});
  const [relevanceTimeRangeSliderStyle, setRelevanceTimeRangeSliderStyle] = useState<React.CSSProperties>({});

  const { data: tradeHistory, isLoading: historyLoading, refresh: refreshTradeHistory } = useTradeHistory(postId, timeRange);

  // ✅ OPTIMIZATION: Only fetch relevance when chart type is 'relevance'
  const { data: relevanceData, isLoading: relevanceLoading, error: relevanceError, refetch: refetchRelevance } = useRelevanceHistory(
    chartType === 'relevance' ? postId : undefined
  );

  const { poolData } = usePoolData(undefined, postId);
  const { rebasePool, isRebasing, error: rebaseError } = useRebasePool();
  const { data: rebaseStatus } = useRebaseStatus(postId);

  // Listen for refreshTrigger changes and refresh trade history
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refreshTradeHistory();
    }
  }, [refreshTrigger, refreshTradeHistory]);

  const handleRebaseClick = async () => {
    // Check auth first
    const isAuthed = await requireAuth();
    if (!isAuthed) return;

    // Check SOL balance for transaction fees
    if (address) {
      try {
        const rpcEndpoint = getRpcEndpoint();
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const { PublicKey } = await import('@solana/web3.js');
        const pubkey = new PublicKey(address);
        const balance = await connection.getBalance(pubkey);
        const currentSolBalance = balance / 1e9;
        setSolBalance(currentSolBalance);

        // Need at least 0.015 SOL for rebase transaction fees
        if (currentSolBalance < 0.015) {
          setShowFundingPrompt(true);
          return;
        }
      } catch (error) {
        console.error('Error checking SOL balance:', error);
        // Continue anyway, let the transaction fail with proper error
      }
    }

    // Show confirmation modal
    setShowRebaseModal(true);
  };

  const handleRebaseConfirm = async () => {
    const result = await rebasePool(postId);

    if (result.success) {
      // Close modal and refresh all chart data after successful rebase
      setShowRebaseModal(false);
      await Promise.all([
        refetchRelevance(),     // Refresh relevance chart
        refreshTradeHistory(),  // Refresh price chart (settlement may affect prices)
      ]);
    }
    // If failed, modal stays open to show error
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

  // Update slider position when relevanceTimeRange changes or chartType switches to relevance
  useEffect(() => {
    if (chartType !== 'relevance') return;

    const updateRelevanceTimeRangeSlider = () => {
      const activeButton = relevanceTimeRangeRefs.current[relevanceTimeRange];
      if (activeButton) {
        const { offsetLeft, offsetWidth } = activeButton;
        setRelevanceTimeRangeSliderStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        });
      }
    };

    // Use setTimeout to ensure buttons are rendered
    const timer = setTimeout(updateRelevanceTimeRangeSlider, 0);

    return () => clearTimeout(timer);
  }, [relevanceTimeRange, chartType]);

  // Initialize relevance slider on mount if relevance chart is shown first
  useEffect(() => {
    if (chartType === 'relevance') {
      const timer = setTimeout(() => {
        const activeButton = relevanceTimeRangeRefs.current[relevanceTimeRange];
        if (activeButton) {
          const { offsetLeft, offsetWidth } = activeButton;
          setRelevanceTimeRangeSliderStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          });
        }
      }, 100); // Slightly longer delay for initial mount
      return () => clearTimeout(timer);
    }
  }, []);

  // Refresh chart when trade completes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refreshTradeHistory();
      if (chartType === 'relevance') {
        refetchRelevance();
      }
    }
  }, [refreshTrigger, refreshTradeHistory, refetchRelevance, chartType]);

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl overflow-hidden">
      {/* Header with Chart Type Toggle, Rebase Button, and Time Range Selector */}
      <div className="flex justify-between items-center p-4 pb-0 gap-2">
        {/* Chart Type Toggle */}
        <div className="relative flex bg-black/50 rounded-md p-0.5 gap-0.5 shrink-0">
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

        {/* Rebase Button - always in middle */}
        <button
          onClick={handleRebaseClick}
          disabled={isRebasing}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#F0EAD6]/10 hover:bg-[#F0EAD6]/20 border border-[#F0EAD6]/30 rounded-md text-xs font-medium text-[#F0EAD6] transition-colors disabled:opacity-50 disabled:cursor-default shrink-0"
          title="Run epoch processing and settle pool"
        >
          <RefreshCw className={`w-3 h-3 ${isRebasing ? 'animate-spin' : ''}`} />
          {isRebasing ? 'Rebasing...' : 'Rebase'}
        </button>

        {/* Time Range Selector - for both price and relevance */}
        {chartType === 'price' ? (
          <div className="relative flex bg-black/50 rounded-md p-0.5 gap-0.5 shrink-0">
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
        ) : (
          <div className="relative flex bg-black/50 rounded-md p-0.5 gap-0.5 shrink-0">
            {/* Animated background slider */}
            <div
              className="absolute top-0.5 bottom-0.5 rounded transition-all duration-300 ease-in-out bg-[#F0EAD6]"
              style={relevanceTimeRangeSliderStyle}
            />
            {(['1H', '24H', '7D', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                ref={(el) => (relevanceTimeRangeRefs.current[range] = el)}
                onClick={() => setRelevanceTimeRange(range)}
                className={`flex-1 px-2 py-0.5 rounded text-xs font-medium transition-colors duration-300 relative z-10 ${
                  relevanceTimeRange === range
                    ? 'text-black'
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
          // Price Chart - show data if available (even while loading fresh data in background)
          tradeHistory && tradeHistory.priceLongData && tradeHistory.priceShortData && (tradeHistory.priceLongData.length > 0 || tradeHistory.priceShortData.length > 0) ? (
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
          ) : historyLoading ? (
            // Only show loading if we have no data and are actually fetching
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-[#B9D9EB] border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500 text-xs">Loading price data...</p>
              </div>
            </div>
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
          // Show data if available (even while loading fresh data in background)
          relevanceData && (relevanceData.actualRelevance.length > 0 || relevanceData.impliedRelevance.length > 0) ? (
            <RelevanceHistoryChart
              actualRelevance={relevanceData.actualRelevance}
              impliedRelevance={relevanceData.impliedRelevance}
              rebaseEvents={relevanceData.rebaseEvents}
              height={400}
            />
          ) : relevanceLoading && !relevanceError ? (
            // Only show loading if we have no data and are actually fetching
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-[#B9D9EB] border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500 text-xs">Loading relevance data...</p>
              </div>
            </div>
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

      {/* Funding Prompt Modal */}
      <FundingPromptModal
        isOpen={showFundingPrompt}
        onClose={() => setShowFundingPrompt(false)}
        type="SOL"
        currentSolBalance={solBalance}
        requiredSolAmount={0.015}
      />

      {/* Rebase Confirmation Modal */}
      <RebaseConfirmationModal
        isOpen={showRebaseModal}
        onClose={() => setShowRebaseModal(false)}
        onConfirm={handleRebaseConfirm}
        isRebasing={isRebasing}
        error={rebaseError}
        unaccountedSubmissions={rebaseStatus?.unaccountedSubmissions}
        minRequiredSubmissions={rebaseStatus?.minRequiredSubmissions}
        cooldownRemaining={rebaseStatus?.cooldownRemaining}
      />
    </div>
  );
}
