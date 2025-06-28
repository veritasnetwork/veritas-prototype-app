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
      <div className="absolute inset-0 bg-gradient-to-br from-[#B9D9EB]/5 to-[#0C1D51]/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
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
            ? 'bg-green-500 animate-pulse' 
            : belief.status === 'resolved'
            ? 'bg-blue-500'
            : 'bg-gray-400'
        }`} />
      </div>

      {/* Category tag */}
      <div className="absolute top-4 left-4">
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-[#B9D9EB]/20 to-[#0C1D51]/10 text-[#0C1D51] dark:text-[#B9D9EB] border border-[#B9D9EB]/30">
          {belief.category}
        </span>
      </div>
    </div>
  );
};