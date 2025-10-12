/**
 * TradingChartCard Component
 * Bubble card displaying trading history chart with time range selector
 */

'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { TradingHistoryChart } from '@/components/charts/TradingHistoryChart';
import { useTradeHistory, TimeRange } from '@/hooks/api/useTradeHistory';

interface TradingChartCardProps {
  postId: string;
}

export function TradingChartCard({ postId }: TradingChartCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const { data: tradeHistory, isLoading: historyLoading } = useTradeHistory(postId, timeRange);

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl overflow-hidden">
      {/* Time Range Selector - Above chart */}
      <div className="flex justify-end p-4 pb-0">
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
      </div>

      {/* Chart or Loading/Empty State */}
      <div className="p-4 pt-2">
        {historyLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-[#B9D9EB] border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500 text-xs">Loading chart...</p>
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
        )}
      </div>
    </div>
  );
}
