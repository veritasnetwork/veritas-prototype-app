import { Belief, ComponentVariant } from '@/types/belief.types';

interface ChartData {
  type?: string;
  showHistory?: boolean;
  timeframe?: string;
}

interface BeliefWithOptions {
  options?: Array<{ id: string; label: string; probability?: number }>;
  distribution?: { mean?: number };
  unit?: string;
  title: string;
}

interface ChartComponentProps {
  belief: Belief;
  variant: ComponentVariant;
  layout?: 'binary' | 'election' | 'continuous' | 'multi-choice' | 'auto';
  isEditable?: boolean;
  onEdit?: () => void;
}

export const ChartComponent: React.FC<ChartComponentProps> = ({
  belief,
  variant,
  layout = 'auto',
  isEditable = false,
  onEdit
}) => {
  // Read chart configuration from JSON
  const chartData = belief.components?.chart?.currentVersion as ChartData;
  const showHistory = chartData?.showHistory || false;
  const timeframe = chartData?.timeframe || '7d';
  
  const chartHeight = variant === 'card' ? 'h-32' : 'h-64';

  // Determine what to render based on layout and belief type
  const renderChart = () => {
    if (layout === 'binary' || (layout === 'auto' && belief.type === 'discrete' && belief.options?.length === 2)) {
      // Binary consensus circle
      const consensusPercentage = Math.round(belief.consensusLevel * 100);
      const getPercentageColor = () => {
        if (consensusPercentage >= 70) return '#10b981'; // green
        if (consensusPercentage >= 40) return '#FFB800'; // yellow
        return '#ef4444'; // red
      };

      return (
        <div className="flex justify-center items-center h-full">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="rgba(148, 163, 184, 0.3)"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke={getPercentageColor()}
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${consensusPercentage * 2.83} ${283 - consensusPercentage * 2.83}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {consensusPercentage}%
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (layout === 'continuous' || (layout === 'auto' && belief.type === 'continuous')) {
      // Distribution chart for continuous values
      const beliefWithDist = belief as BeliefWithOptions;
      const distribution = beliefWithDist.distribution;
      const unit = beliefWithDist.unit;
      if (distribution) {
        return (
          <div className="flex flex-col justify-center items-center h-full px-4">
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {unit === 'USD' ? '$' : ''}{distribution.mean?.toLocaleString()}{unit !== 'USD' ? ` ${unit}` : ''}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Consensus estimate
              </div>
            </div>
            {/* Simple distribution visualization */}
            <div className="w-full max-w-xs h-8 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            </div>
          </div>
        );
      }
    }

    if (layout === 'election' || (layout === 'auto' && belief.title.toLowerCase().includes('election'))) {
      // Election results visualization
      const beliefWithOptions = belief as BeliefWithOptions;
      const options = beliefWithOptions.options?.slice(0, 3) || [];
      return (
        <div className="flex justify-center items-center h-full">
          <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
            {options.map((option) => (
              <div key={option.id} className="text-center">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-2 mx-auto">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {Math.round((option.probability || 0) * 100)}%
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {option.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default: Multi-choice or generic
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center">
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            {Math.round(belief.consensusLevel * 100)}% consensus
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {belief.participantCount} participants
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`chart-component ${isEditable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors duration-200' : ''} my-4`}
      onClick={isEditable ? onEdit : undefined}
    >
      <div className={`bg-slate-50 dark:bg-slate-800 rounded-lg ${chartHeight} flex items-center justify-center border border-slate-200 dark:border-slate-700`}>
        {renderChart()}
      </div>
      {showHistory && variant === 'detail' && (
        <div className="text-xs text-slate-400 mt-2 text-center">
          Showing {timeframe} history
        </div>
      )}
    </div>
  );
};
