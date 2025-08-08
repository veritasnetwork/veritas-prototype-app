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
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Set up observer for class changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

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

  const chartHeight = variant === 'card' ? 'h-full' : variant === 'news' ? 'h-40' : 'h-64';
  const wrapperMargin = variant === 'card' ? '' : variant === 'news' ? '' : 'my-4';

  // Loading state
  if (loading) {
    return (
      <div className={`chart-component ${wrapperMargin} ${isEditable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-veritas-eggshell/5 p-2 rounded' : ''}`}>
        <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg ${chartHeight} flex items-center justify-center animate-pulse`}>
          <div className="text-veritas-primary/60 dark:text-veritas-eggshell/60 text-sm">Loading chart...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || renderableCharts.length === 0) {
    return (
      <div className={`chart-component ${wrapperMargin} ${isEditable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-veritas-eggshell/5 p-2 rounded' : ''}`}>
        <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg ${chartHeight} flex items-center justify-center border border-gray-200 dark:border-gray-700`}>
          <div className="text-center text-veritas-primary/60 dark:text-veritas-eggshell/60">
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
    // Use Veritas colors: eggshell in dark mode, dark blue in light mode
    const color = isDarkMode ? '#F0EAD6' : '#0C1D51';

    // Calculate optimal Y-axis domain for line charts
    const calculateYDomain = (data: Array<{x: string | number; y: number}>, chartType: string) => {
      if (chartType !== 'line' || data.length === 0) {
        return undefined; // Let Recharts auto-calculate for bar charts and empty data
      }
      
      const yValues = data.map(point => point.y);
      const minValue = Math.min(...yValues);
      const maxValue = Math.max(...yValues);
      
      // Start from minValue - 10, but don't go below 0 if all values are positive
      const domainMin = minValue > 10 ? minValue - 10 : 0;
      
      return [domainMin, maxValue];
    };

    const yDomain = calculateYDomain(data, config.type);

    const customTooltip = (props: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string | number }) => {
      const { active, payload, label } = props;
      if (active && payload && payload.length) {
        return (
          <div className="bg-white dark:bg-veritas-darker-blue/90 px-3 py-2 border border-gray-200 dark:border-veritas-eggshell/10 rounded-lg shadow-lg">
            <p className="text-sm font-medium text-veritas-primary dark:text-veritas-eggshell">{`${label}`}</p>
            <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70">
              {`${payload[0].name}: ${payload[0].value}`}
            </p>
          </div>
        );
      }
      return null;
    };

    const chartElement = config.type === 'line' ? (
      <LineChart data={data} margin={{ top: 10, right: 15, left: 15, bottom: 10 }}>
        <XAxis 
          dataKey="x" 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-veritas-primary/60 dark:text-veritas-eggshell/60"
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-veritas-primary/60 dark:text-veritas-eggshell/60"
          width={variant === 'card' ? 25 : 35}
          domain={yDomain}
        />
        <Tooltip content={customTooltip} />
        <Line 
          type="monotone" 
          dataKey="y" 
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: isDarkMode ? '#F0EAD6' : '#0C1D51' }}
        />
      </LineChart>
    ) : (
      <BarChart data={data} margin={{ top: 10, right: 15, left: 15, bottom: 10 }}>
        <XAxis 
          dataKey="x" 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-veritas-primary/60 dark:text-veritas-eggshell/60"
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-veritas-primary/60 dark:text-veritas-eggshell/60"
          width={variant === 'card' ? 25 : 35}
        />
        <Tooltip content={customTooltip} />
        <Bar dataKey="y" fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    );

    return (
      <div key={config.id} className={`${index > 0 && variant !== 'card' ? 'mt-6' : ''} ${variant === 'card' ? 'h-full' : ''}`}>
        {(variant === 'detail' || variant === 'news') && (
          <h4 className={`font-medium text-veritas-primary dark:text-veritas-eggshell mb-2 ${variant === 'news' ? 'text-xs' : 'text-sm'}`}>
            {config.title}
          </h4>
        )}
        <div className={`bg-white dark:bg-gray-800 rounded-lg ${chartHeight} border border-gray-200 dark:border-gray-700`}>
          <ResponsiveContainer width="100%" height="100%">
            {chartElement}
          </ResponsiveContainer>
        </div>
        {(variant === 'detail' || variant === 'news') && (
          <div className="mt-2">
            <p className={`text-veritas-primary/50 dark:text-veritas-eggshell/50 ${variant === 'news' ? 'text-xs line-clamp-2' : 'text-xs'}`}>
              {config.description}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`chart-component ${wrapperMargin} ${variant === 'card' ? 'h-full' : ''} ${isEditable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-veritas-eggshell/5 p-2 rounded transition-colors' : ''}`}
      onClick={isEditable ? onEdit : undefined}
    >
      {renderableCharts.map((chart, index) => renderChart(chart, index))}
    </div>
  );
};
