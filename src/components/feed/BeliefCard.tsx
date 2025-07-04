import React from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from '@/components/belief-details/components/HeadingComponent';
import { ArticleComponent } from '@/components/belief-details/components/ArticleComponent';
import { ChartComponent } from '@/components/belief-details/components/ChartComponent';
import { useTheme } from '@/contexts/ThemeContext';
import { getFeedChart } from '@/lib/data';
import { Eye, TrendingUp } from 'lucide-react';

interface BeliefCardProps {
  belief: Belief;
  theme?: 'light' | 'dark';
  compact?: boolean;
  onClick: (beliefId: string) => void;
}

export const BeliefCard: React.FC<BeliefCardProps> = ({
  belief,
  theme = 'light',
  compact = false,
  onClick
}) => {
  const { isDark } = useTheme();
  const effectiveTheme = theme === 'dark' || isDark ? 'dark' : 'light';
  const feedChart = getFeedChart(belief);

  const getCardClasses = () => {
    const baseClasses = `
      belief-card cursor-pointer group relative overflow-hidden
      rounded-2xl transition-all duration-300 ease-out
      hover:scale-[1.02] hover:shadow-2xl
      border backdrop-blur-md
    `;
    
    const glassClasses = effectiveTheme === 'dark' 
      ? 'bg-white/5 border-white/10 hover:bg-white/10' 
      : 'bg-white/20 border-white/30 hover:bg-white/30';
    
    return `${baseClasses} ${glassClasses}`;
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(belief.id);
  };

  const handleSubmitBelief = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Navigate to submit belief for:', belief.id);
  };

  const cardPadding = compact ? 'p-4' : 'p-6';

  return (
    <div 
      className={`${getCardClasses()} ${cardPadding}`}
      onClick={() => onClick(belief.id)}
    >
      {/* Premium gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/10 via-transparent to-[#1B365D]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-px bg-gradient-to-br from-white/20 via-transparent to-transparent rounded-2xl opacity-50" />
      
      <div className="relative z-10 h-full flex flex-col">
        
        {/* Header with ranking scores instead of financial metrics */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex space-x-3">
            <div className="text-center">
              <div className={`text-lg font-bold ${effectiveTheme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {belief.objectRankingScores.truth}%
              </div>
              <div className={`text-xs font-medium ${effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Truth
              </div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${effectiveTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {belief.objectRankingScores.relevance}%
              </div>
              <div className={`text-xs font-medium ${effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Relevance
              </div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${effectiveTheme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                {belief.objectRankingScores.informativeness}%
              </div>
              <div className={`text-xs font-medium ${effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Info
              </div>
            </div>
          </div>
          
          {/* Category and status */}
          <div className="flex flex-col items-end gap-2">
            {belief.category && (
              <span className={`
                inline-flex items-center px-3 py-1 text-xs font-medium rounded-full
                transition-all duration-300 group-hover:scale-105
                ${effectiveTheme === 'dark'
                  ? 'bg-gradient-to-r from-[#FFB800]/20 to-[#1B365D]/10 text-[#FFB800] border border-[#FFB800]/30'
                  : 'bg-gradient-to-r from-[#1B365D]/20 to-[#FFB800]/10 text-[#1B365D] border border-[#1B365D]/30'
                }
              `}>
                {belief.category}
              </span>
            )}
            
            {belief.status && (
              <div className={`w-3 h-3 rounded-full ${
                belief.status === 'active' 
                  ? 'bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50' 
                  : belief.status === 'resolved'
                  ? 'bg-blue-400 shadow-lg shadow-blue-400/50'
                  : 'bg-slate-400'
              }`} />
            )}
          </div>
        </div>

        {/* Content using new component structure */}
        <div className="flex-grow space-y-4">
          <HeadingComponent heading={belief.heading} variant="card" theme={effectiveTheme} />
          <ArticleComponent article={belief.article} variant="card" />
          {feedChart && (
            <ChartComponent charts={[feedChart]} variant="card" showOnlyFeedChart={true} />
          )}
        </div>

        {/* Actions */}
        {!compact && (
          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleViewDetails}
              className={`
                flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-medium
                transition-all duration-300 hover:scale-105 active:scale-95
                ${effectiveTheme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/30'
                  : 'bg-[#1B365D]/10 hover:bg-[#1B365D]/20 text-[#1B365D] border border-[#1B365D]/20 hover:border-[#1B365D]/30'
                }
              `}
            >
              <Eye className="w-4 h-4" />
              <span>View</span>
            </button>
            
            <button
              onClick={handleSubmitBelief}
              className={`
                flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-medium
                transition-all duration-300 hover:scale-105 active:scale-95
                ${effectiveTheme === 'dark'
                  ? 'bg-[#FFB800]/20 hover:bg-[#FFB800]/30 text-[#FFB800] border border-[#FFB800]/30 hover:border-[#FFB800]/50'
                  : 'bg-[#FFB800]/20 hover:bg-[#FFB800]/30 text-[#FFB800] border border-[#FFB800]/30 hover:border-[#FFB800]/50'
                }
              `}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Analyze</span>
            </button>
          </div>
        )}

        {compact && (
          <div className="mt-4">
            <button
              onClick={handleViewDetails}
              className={`
                w-full py-2 px-4 rounded-lg text-xs font-medium
                transition-all duration-300 hover:scale-105
                ${effectiveTheme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-[#1B365D]/10 hover:bg-[#1B365D]/20 text-[#1B365D]'
                }
              `}
            >
              View Details
            </button>
          </div>
        )}
      </div>

      {/* Premium shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
    </div>
  );
};