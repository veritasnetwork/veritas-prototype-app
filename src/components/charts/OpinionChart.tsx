'use client';

import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { OpinionHistoryPoint } from '@/types/post.types';

interface OpinionChartProps {
  history: OpinionHistoryPoint[];
  currentPercentage: number;
  className?: string;
}

export function OpinionChart({ history, currentPercentage, className = '' }: OpinionChartProps) {
  // If no history, show a flat line at current percentage
  const dataPoints = history.length > 0 ? history : [
    { yesPercentage: currentPercentage, recordedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    { yesPercentage: currentPercentage, recordedAt: new Date() }
  ];

  // Sort by time to ensure proper line drawing
  const sortedData = [...dataPoints].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  // Transform data for Recharts
  const chartData = sortedData.map(point => ({
    value: point.yesPercentage,
    timestamp: point.recordedAt.getTime()
  }));

  // Determine trend direction
  const trend = sortedData.length > 1 
    ? sortedData[sortedData.length - 1].yesPercentage - sortedData[0].yesPercentage
    : 0;
  
  const trendColor = trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-neutral-500';
  const lineColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#93c5fd';

  // Format time range for display
  const formatTimeRange = () => {
    if (sortedData.length < 2) return '24h';
    const minTime = sortedData[0].recordedAt.getTime();
    const maxTime = sortedData[sortedData.length - 1].recordedAt.getTime();
    const hoursDiff = (maxTime - minTime) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      return `${Math.round(hoursDiff)}h`;
    }
    const daysDiff = hoursDiff / 24;
    return `${Math.round(daysDiff)}d`;
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-neutral-600 dark:text-neutral-400 font-sans uppercase tracking-wider">
            Yes Trend
          </span>
          <span className={`text-xs font-medium ${trendColor}`}>
            {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'} {Math.abs(trend).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatTimeRange()}
          </span>
          <span className="text-sm font-semibold text-veritas-light-blue">
            {currentPercentage}%
          </span>
        </div>
      </div>
      
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <YAxis domain={[20, 80]} hide />
            <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, strokeWidth: 0, r: 2 }}
              activeDot={{ r: 4, fill: lineColor }}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}