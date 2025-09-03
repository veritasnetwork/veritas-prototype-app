import React, { useState } from 'react';
import { OpinionContent } from '@/types/content.types';
import { 
  Users, 
  BarChart3, 
  ListOrdered, 
  CheckCircle,
  Percent,
  ChevronUp,
  ChevronDown,
  Minus
} from 'lucide-react';

interface OpinionCardProps {
  content: OpinionContent;
  variant?: 'feed' | 'grid' | 'compact' | 'mobile' | 'news' | 'large' | 'premier';
  onClick: (contentId: string) => void;
  layout?: 'full' | 'half';
}

export const OpinionCard: React.FC<OpinionCardProps> = ({
  content,
  variant = 'feed',
  onClick,
  layout = 'half'
}) => {
  void layout; // Layout is handled by parent grid
  const [isValidating, setIsValidating] = useState(false);
  
  const handleClick = () => {
    onClick(content.id);
  };
  
  const handleValidate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsValidating(true);
    // TODO: Open validation modal or inline validation
  };
  
  // Get trend from historical data
  const getTrend = () => {
    const signal = content.signals?.truth;
    if (!signal?.historicalData || signal.historicalData.length < 2) return 'stable';
    
    const recent = signal.historicalData[signal.historicalData.length - 1].value;
    const previous = signal.historicalData[signal.historicalData.length - 2].value;
    
    if (recent > previous + 2) return 'up';
    if (recent < previous - 2) return 'down';
    return 'stable';
  };
  
  // Get trend icon
  const getTrendIcon = () => {
    const trend = getTrend();
    switch (trend) {
      case 'up':
        return <ChevronUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <ChevronDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };
  
  // Get icon based on opinion type
  const getTypeIcon = () => {
    const iconSize = variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5';
    switch (content.opinionType) {
      case 'percentage':
        return <Percent className={iconSize} />;
      case 'yes-no':
        return <CheckCircle className={iconSize} />;
      case 'multiple-choice':
        return <BarChart3 className={iconSize} />;
      case 'ranking':
        return <ListOrdered className={iconSize} />;
      default:
        return <BarChart3 className={iconSize} />;
    }
  };
  
  // Card sizing based on variant and layout
  const getCardSizing = () => {
    if (variant === 'compact') return 'w-full h-28';
    if (variant === 'mobile') return 'w-full';
    if (variant === 'premier') return 'w-full h-48';
    
    // Always use full width - the parent grid handles the actual sizing
    return 'w-full';
  };
  
  // Render the main value display based on type
  const renderMainDisplay = () => {
    switch (content.opinionType) {
      case 'percentage':
        return (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2">
              <div className="text-6xl font-bold text-veritas-blue dark:text-veritas-light-blue">
                {content.currentValue || 0}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {content.unit || '%'}
                </span>
                {getTrendIcon()}
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Current Prediction
            </div>
            {content.range && (
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-veritas-blue dark:bg-veritas-light-blue rounded-full transition-all duration-500"
                  style={{ 
                    width: `${((content.currentValue || 0) - content.range.min) / (content.range.max - content.range.min) * 100}%` 
                  }}
                />
              </div>
            )}
          </div>
        );
        
      case 'yes-no':
        const yesPercent = content.yesPercentage || 50;
        const noPercent = 100 - yesPercent;
        const isYesWinning = yesPercent > 50;
        
        return (
          <div className="py-4">
            <div className="relative">
              {/* Background bar */}
              <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                <div className="flex h-full">
                  <div 
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${yesPercent}%` }}
                  />
                  <div 
                    className="bg-red-500 transition-all duration-500"
                    style={{ width: `${noPercent}%` }}
                  />
                </div>
              </div>
              
              {/* Overlay text */}
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <div className={`font-bold ${isYesWinning ? 'text-white' : 'text-gray-600'}`}>
                  YES {yesPercent}%
                </div>
                <div className={`font-bold ${!isYesWinning ? 'text-white' : 'text-gray-600'}`}>
                  NO {noPercent}%
                </div>
              </div>
            </div>
            
            <div className="text-center text-sm text-gray-500 mt-3">
              Community Consensus
            </div>
          </div>
        );
        
      case 'multiple-choice':
        const sortedOptions = content.options?.sort((a, b) => {
          const aVotes = content.optionVotes?.[a] || 0;
          const bVotes = content.optionVotes?.[b] || 0;
          return bVotes - aVotes;
        }) || [];
        
        const totalVotes = Object.values(content.optionVotes || {}).reduce((a, b) => a + b, 0);
        
        return (
          <div className="py-4">
            <div className="space-y-2">
              {sortedOptions.slice(0, 3).map((option, index) => {
                const votes = content.optionVotes?.[option] || 0;
                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                
                return (
                  <div key={option} className="relative">
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          index === 0 
                            ? 'bg-veritas-blue dark:bg-veritas-light-blue' 
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-between px-2">
                      <span className="text-xs font-medium truncate">{option}</span>
                      <span className="text-xs font-bold">{Math.round(percentage)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {sortedOptions.length > 3 && (
              <div className="text-center text-xs text-gray-500 mt-2">
                +{sortedOptions.length - 3} more options
              </div>
            )}
          </div>
        );
        
      case 'ranking':
        const top5 = content.options?.slice(0, 5) || [];
        return (
          <div className="py-4">
            <div className="space-y-2">
              {top5.map((option, index) => {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return (
                  <div 
                    key={option} 
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                      index < 3 ? 'bg-gray-50 dark:bg-gray-900' : ''
                    }`}
                  >
                    <span className="text-lg">{medals[index]}</span>
                    <span className={`text-sm ${index === 0 ? 'font-bold' : ''} truncate`}>
                      {option}
                    </span>
                  </div>
                );
              })}
            </div>
            {content.options && content.options.length > 5 && (
              <div className="text-center text-xs text-gray-500 mt-2">
                +{content.options.length - 5} more items
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // Get question text for compact mode
  const getQuestionPreview = () => {
    if (content.question.length > 50) {
      return content.question.substring(0, 47) + '...';
    }
    return content.question;
  };
  
  return (
    <div
      className={`
        ${getCardSizing()}
        bg-white dark:bg-veritas-darker-blue/80 
        rounded-xl shadow-sm hover:shadow-lg 
        transition-all duration-300 
        border border-slate-200 dark:border-veritas-eggshell/10
        hover:border-veritas-blue dark:hover:border-veritas-light-blue
        cursor-pointer group
        overflow-hidden
        relative
      `}
      onClick={handleClick}
    >
      {/* Resolution status badge */}
      {content.status === 'resolved' && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full z-10">
          Resolved
        </div>
      )}
      
      <div className={`${variant === 'compact' ? 'p-3' : 'p-4'} h-full flex flex-col`}>
        {/* Header */}
        <div className={`flex items-start justify-between ${variant === 'compact' ? 'mb-2' : 'mb-3'}`}>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-veritas-blue transition-colors">
              {content.heading.title}
            </h3>
            {variant !== 'compact' && content.heading.subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                {content.heading.subtitle}
              </p>
            )}
          </div>
          <div className="ml-2 text-veritas-blue">
            {getTypeIcon()}
          </div>
        </div>
        
        {/* Question preview in compact mode */}
        {variant === 'compact' && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            {getQuestionPreview()}
          </p>
        )}
        
        {/* Main Display */}
        {variant !== 'compact' && (
          <div className="flex-1 flex flex-col justify-center">
            {renderMainDisplay()}
          </div>
        )}
        
        {/* Footer */}
        <div className={`flex items-center justify-between ${variant === 'compact' ? 'mt-2' : 'mt-3 pt-3 border-t border-gray-100 dark:border-veritas-eggshell/10'}`}>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            <span>{content.totalParticipants.toLocaleString()}</span>
            {variant !== 'compact' && <span>participants</span>}
          </div>
          
          {/* Validate Button */}
          {variant !== 'compact' && !isValidating && (
            <button
              className="px-4 py-1.5 text-sm bg-veritas-blue dark:bg-veritas-light-blue text-white dark:text-veritas-dark-blue rounded-lg hover:shadow-md transition-all duration-200 transform hover:scale-105"
              onClick={handleValidate}
            >
              Validate
            </button>
          )}
          
          {/* Validation in progress */}
          {isValidating && (
            <div className="text-sm text-veritas-blue">
              Validating...
            </div>
          )}
        </div>
        
        {/* Signal Indicators - More prominent */}
        {content.signals && variant !== 'compact' && (
          <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-veritas-eggshell/10">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Truth: {content.signals.truth?.currentValue || 0}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Relevance: {content.signals.relevance?.currentValue || 0}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};