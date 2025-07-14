'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartComponentProps } from '@/types/component.types';
import { RenderableChart } from '@/types/belief.types';
import { getChartsForBelief, getFeedChart } from '@/lib/chartData';

export const ChartComponent: React.FC<ChartComponentProps> = ({
  charts,
  beliefId,
  variant,
  showOnlyFeedChart = false,
  isEditable = false,
  onEdit
}) => {
  const [renderableCharts, setRenderableCharts] = useState<RenderableChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use beliefId prop or extract from legacy charts prop structure  
  const actualBeliefId = beliefId || (charts && charts.length > 0 ? 
    (charts[0] as { metadata?: { beliefId?: string }; beliefId?: string })?.metadata?.beliefId || 
    (charts[0] as { metadata?: { beliefId?: string }; beliefId?: string })?.beliefId : 
    undefined);

  useEffect(() => {
    async function loadCharts() {
      if (!actualBeliefId) {
        setError('No belief ID found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (showOnlyFeedChart) {
          const feedChart = await getFeedChart(actualBeliefId);
          setRenderableCharts(feedChart ? [feedChart] : []);
        } else {
          const allCharts = await getChartsForBelief(actualBeliefId);
          setRenderableCharts(allCharts);
        }
        setError(null);
      } catch (err) {
        setError('Failed to load chart data');
        console.error('Chart loading error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCharts();
  }, [actualBeliefId, showOnlyFeedChart]);

  const chartHeight = variant === 'card' ? 'h-full' : 'h-64';

  // Loading state
  if (loading) {
    return (
      <div className={`chart-component my-4 ${isEditable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded' : ''}`}>
        <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg ${chartHeight} flex items-center justify-center animate-pulse`}>
          <div className="text-gray-500 dark:text-gray-400 text-sm">Loading chart...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || renderableCharts.length === 0) {
    return (
      <div className={`chart-component my-4 ${isEditable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded' : ''}`}>
        <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg ${chartHeight} flex items-center justify-center border border-gray-200 dark:border-gray-700`}>
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="text-sm font-medium">No chart data available</div>
            {variant === 'detail' && (
              <div className="text-xs mt-1">Charts will appear here when data is added</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const renderChart = (chart: RenderableChart, index: number) => {
    const { config, data } = chart;
    const color = config.color || '#3b82f6';

    const customTooltip = (props: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string | number }) => {
      const { active, payload, label } = props;
      if (active && payload && payload.length) {
        return (
          <div className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{`${label}`}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {`${payload[0].name}: ${payload[0].value}`}
            </p>
          </div>
        );
      }
      return null;
    };

    const chartElement = config.type === 'line' ? (
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <XAxis 
          dataKey="x" 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-gray-600 dark:text-gray-400"
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-gray-600 dark:text-gray-400"
          width={variant === 'card' ? 25 : 35}
        />
        <Tooltip content={customTooltip} />
        <Line 
          type="monotone" 
          dataKey="y" 
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 2, r: 3 }}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    ) : (
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <XAxis 
          dataKey="x" 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-gray-600 dark:text-gray-400"
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-gray-600 dark:text-gray-400"
          width={variant === 'card' ? 25 : 35}
        />
        <Tooltip content={customTooltip} />
        <Bar dataKey="y" fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    );

    return (
      <div key={config.id} className={index > 0 ? 'mt-6' : ''}>
        {variant === 'detail' && (
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {config.title}
          </h4>
        )}
        <div className={`bg-white dark:bg-gray-800 rounded-lg ${chartHeight} border border-gray-200 dark:border-gray-700`}>
          <ResponsiveContainer width="100%" height="100%">
            {chartElement}
          </ResponsiveContainer>
        </div>
        {variant === 'detail' && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.description}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`chart-component my-4 ${isEditable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      {renderableCharts.map((chart, index) => renderChart(chart, index))}
    </div>
  );
};
