import React from 'react';
import { Belief } from '@/types/belief.types';
import { HeadingComponent } from '@/components/belief-details/components/HeadingComponent';
import { useTheme } from '@/contexts/ThemeContext';
import { Eye, TrendingUp } from 'lucide-react';

type LayoutVariant = 'binary' | 'election' | 'continuous' | 'multi-choice' | 'auto';

interface BeliefCardProps {
  belief: Belief;
  theme?: 'light' | 'dark';
  layout?: LayoutVariant;
  compact?: boolean;
  onClick: (beliefId: string) => void;
}

export const BeliefCard: React.FC<BeliefCardProps> = ({
  belief,
  theme = 'light',
  layout = 'auto',
  compact = false,
  onClick
}) => {
  const { isDark } = useTheme();
  const effectiveTheme = theme === 'dark' || isDark ? 'dark' : 'light';

  // Determine layout variant
  const determineLayout = (belief: Belief): LayoutVariant => {
    if (belief.type === 'discrete') {
      if (belief.title.toLowerCase().includes('election') || belief.title.toLowerCase().includes('winner')) {
        return 'election';
      }
      const beliefWithOptions = belief as Belief & { options?: Array<unknown> };
      const options = beliefWithOptions.options;
      if (options && options.length > 3) {
        return 'multi-choice';
      }
      return 'binary';
    }
    return 'continuous';
  };

  const cardLayout = layout === 'auto' ? determineLayout(belief) : layout;

  // Premium glassmorphism styling based on layout
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getCardClasses = (_layout: LayoutVariant) => {
    const baseClasses = `
      belief-card cursor-pointer group relative overflow-hidden
      rounded-2xl transition-all duration-300 ease-out
      hover:scale-[1.02] hover:shadow-2xl
      border backdrop-blur-md
    `;
    
    // Universal glassmorphism with theme-aware transparency
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

  // Compact padding for different card sizes
  const cardPadding = compact ? 'p-4' : 'p-6';

  return (
    <div 
      className={`${getCardClasses(cardLayout)} ${cardPadding}`}
      onClick={() => onClick(belief.id)}
    >
      {/* Premium gradient glow overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/10 via-transparent to-[#1B365D]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Subtle inner glow */}
      <div className="absolute inset-px bg-gradient-to-br from-white/20 via-transparent to-transparent rounded-2xl opacity-50" />
      
      {/* Content Container */}
      <div className="relative z-10 h-full flex flex-col">
        
        {/* Status and Category Header */}
        <div className="flex items-start justify-between mb-4">
          {/* Category badge */}
          <div className="flex-shrink-0">
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
          </div>
          
          {/* Status indicator */}
          <div className="flex-shrink-0">
            <div className={`
              w-3 h-3 rounded-full transition-all duration-300
              ${belief.status === 'active' 
                ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse' 
                : belief.status === 'resolved'
                ? 'bg-blue-400 shadow-lg shadow-blue-400/50'
                : 'bg-slate-400'
              }
            `} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-grow space-y-4">
          {/* Heading with improved typography */}
          <div className="space-y-2">
            <HeadingComponent belief={belief} variant="card" theme={effectiveTheme} />
          </div>

          {/* Key Metrics - Compact and Clean */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-lg font-bold ${
                effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                {belief.participantCount?.toLocaleString() || '0'}
              </div>
              <div className={`text-xs font-medium ${
                effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              }`}>
                Participants
              </div>
            </div>

            <div className="text-center">
              <div className={`text-lg font-bold ${
                effectiveTheme === 'dark' ? 'text-[#FFB800]' : 'text-[#1B365D]'
              }`}>
                {Math.round((belief.consensusLevel || 0) * 100)}%
              </div>
              <div className={`text-xs font-medium ${
                effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              }`}>
                Consensus
              </div>
            </div>

            <div className="text-center">
              <div className={`text-lg font-bold ${
                effectiveTheme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
                ${(belief.totalStake / 1000).toFixed(0)}K
              </div>
              <div className={`text-xs font-medium ${
                effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              }`}>
                Stake
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Actions - Only for non-compact cards */}
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
              <span>Predict</span>
            </button>
          </div>
        )}

        {/* Compact view minimal action */}
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

      {/* Premium shine effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
    </div>
  );
};