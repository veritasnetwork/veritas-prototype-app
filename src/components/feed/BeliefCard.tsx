import { Belief } from '@/types/belief.types';
import { HeadingComponent } from '@/components/belief-details/components/HeadingComponent';
import { ChartComponent } from '@/components/belief-details/components/ChartComponent';
import { MetadataComponent } from '@/components/belief-details/components/MetadataComponent';
import { useTheme } from '@/contexts/ThemeContext';

interface BeliefCardProps {
  belief: Belief;
  displayMode?: 'minimal' | 'balanced' | 'detailed';
  onCardClick: (beliefId: string) => void;
}

export const BeliefCard: React.FC<BeliefCardProps> = ({
  belief,
  displayMode = 'balanced',
  onCardClick
}) => {
  const { isDark } = useTheme();

  return (
    <div
      className="group relative belief-card cursor-pointer transform transition-all duration-500 hover:scale-[1.02]"
      onClick={() => onCardClick(belief.id)}
    >
      {/* Premium gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/5 to-[#1B365D]/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Content */}
      <div className="relative z-10">
        <HeadingComponent belief={belief} variant="card" />
        
        {(displayMode === 'balanced' || displayMode === 'detailed') && (
          <ChartComponent belief={belief} variant="card" />
        )}
        
        <MetadataComponent belief={belief} variant="card" />
      </div>

      {/* Status indicator */}
      <div className="absolute top-4 right-4">
        <div className={`w-3 h-3 rounded-full ${
          belief.status === 'active' 
            ? 'bg-yellow-500 animate-pulse' 
            : belief.status === 'resolved'
            ? 'bg-blue-500'
            : 'bg-gray-400'
        }`} />
      </div>

      {/* Category tag */}
      <div className="absolute top-4 left-4">
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-[#FFB800]/20 to-[#1B365D]/10 text-[#1B365D] dark:text-[#D4A574] border border-[#FFB800]/30">
          {belief.category}
        </span>
      </div>
    </div>
  );
};