import { ChartComponentProps } from '@/types/component.types';
import { ChartData, ContinuousData, ComparativeData, DualProbabilityData, HistoricalLineData } from '@/types/belief.types';

export const ChartComponent: React.FC<ChartComponentProps> = ({
  charts,
  variant,
  showOnlyFeedChart = false
}) => {
  const chartsToRender = showOnlyFeedChart 
    ? charts.filter(chart => chart.showInFeed)
    : charts;

  const chartHeight = variant === 'card' ? 'h-32' : 'h-64';

  if (chartsToRender.length === 0) return null;

  const renderChartByType = (chart: ChartData) => {
    switch (chart.type) {
      case 'continuous':
        const continuousData = chart.data as ContinuousData;
        return (
          <div className="flex flex-col justify-center items-center h-full px-4">
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {continuousData.currentValue}
                {chart.axes.yAxis.unit && (
                  <span className="text-sm ml-1">{chart.axes.yAxis.unit}</span>
                )}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Current Index
              </div>
              <div className={`text-xs font-medium mt-1 ${
                continuousData.trend === 'up' ? 'text-green-600' : 
                continuousData.trend === 'down' ? 'text-red-600' : 'text-slate-600'
              }`}>
                {continuousData.trend === 'up' ? '↗' : continuousData.trend === 'down' ? '↘' : '→'} {continuousData.trend}
              </div>
            </div>
            <div className="w-full max-w-xs h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000"
                style={{ width: `${continuousData.currentValue}%` }}
              />
            </div>
          </div>
        );

      case 'comparative':
        const comparativeData = chart.data as ComparativeData;
        return (
          <div className="flex justify-center items-center h-full px-4">
            <div className="w-full max-w-sm">
              <div className="space-y-2">
                {comparativeData.entities.slice(0, variant === 'card' ? 3 : 4).map((entity, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-20">
                      {entity.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${entity.value}%`,
                            backgroundColor: entity.color || '#3B82F6'
                          }}
                        />
                      </div>
                      <span className="text-slate-600 dark:text-slate-400 w-8 text-right">
                        {entity.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'dual-probability':
        const dualProbData = chart.data as DualProbabilityData;
        return (
          <div className="flex justify-center items-center h-full px-4">
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
              <div className="text-center">
                <div className="text-lg font-bold text-red-600 mb-1">
                  {dualProbData.probabilities.primary.value}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {dualProbData.probabilities.primary.label}
                </div>
                <div className={`text-xs mt-1 ${
                  dualProbData.probabilities.primary.trend === 'up' ? 'text-red-600' : 
                  dualProbData.probabilities.primary.trend === 'down' ? 'text-green-600' : 'text-slate-600'
                }`}>
                  {dualProbData.probabilities.primary.trend === 'up' ? '↗' : 
                   dualProbData.probabilities.primary.trend === 'down' ? '↘' : '→'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600 mb-1">
                  {dualProbData.probabilities.secondary.value}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {dualProbData.probabilities.secondary.label}
                </div>
                <div className={`text-xs mt-1 ${
                  dualProbData.probabilities.secondary.trend === 'up' ? 'text-orange-600' : 
                  dualProbData.probabilities.secondary.trend === 'down' ? 'text-green-600' : 'text-slate-600'
                }`}>
                  {dualProbData.probabilities.secondary.trend === 'up' ? '↗' : 
                   dualProbData.probabilities.secondary.trend === 'down' ? '↘' : '→'}
                </div>
              </div>
            </div>
          </div>
        );

      case 'historical-line':
        const historicalData = chart.data as HistoricalLineData;
        return (
          <div className="flex justify-center items-center h-full px-4">
            <div className="w-full max-w-sm">
              <div className="space-y-2">
                {historicalData.series.slice(0, variant === 'card' ? 3 : 5).map((series, index) => {
                  const latestValue = series.data[series.data.length - 1]?.value || 0;
                  const previousValue = series.data[series.data.length - 2]?.value || 0;
                  const change = latestValue - previousValue;
                  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
                  
                  return (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: series.color }}
                        />
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-20">
                          {series.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 dark:text-slate-400">
                          {latestValue.toLocaleString()}
                        </span>
                        <div className={`text-xs ${
                          trend === 'up' ? 'text-green-600' : 
                          trend === 'down' ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex justify-center items-center h-full">
            <div className="text-center text-slate-500 dark:text-slate-400">
              <div className="text-sm font-medium">{chart.title}</div>
              <div className="text-xs">Chart type: {chart.type}</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="chart-component my-4">
      {chartsToRender.map((chart, index) => (
        <div key={chart.id} className={index > 0 ? 'mt-6' : ''}>
          {variant === 'detail' && (
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {chart.title}
            </h4>
          )}
          <div className={`bg-slate-50 dark:bg-slate-800 rounded-lg ${chartHeight} flex items-center justify-center border border-slate-200 dark:border-slate-700`}>
            {renderChartByType(chart)}
          </div>
          {variant === 'detail' && (
            <div className="mt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {chart.caption}
              </p>
              {chart.metadata && (
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                  <span>Source: {chart.metadata.dataSource}</span>
                  <span>Updated: {new Date(chart.metadata.lastUpdated).toLocaleDateString()}</span>
                  <span className={`px-2 py-1 rounded ${
                    chart.metadata.confidence === 'high' ? 'bg-green-100 text-green-800' :
                    chart.metadata.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {chart.metadata.confidence} confidence
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
