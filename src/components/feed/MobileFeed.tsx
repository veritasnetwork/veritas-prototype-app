'use client';

import { Belief } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';

interface MobileFeedProps {
  beliefs: Belief[];
  onBeliefClick: (beliefId: string) => void;
  loading?: boolean;
}

export const MobileFeed: React.FC<MobileFeedProps> = ({
  beliefs,
  onBeliefClick,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (beliefs.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No insights match your current filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {beliefs.map((belief) => (
        <div 
          key={belief.id}
          className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
        >
          <BeliefCard 
            belief={belief} 
            variant="mobile"
            onClick={() => onBeliefClick(belief.id)}
          />
        </div>
      ))}
    </div>
  );
}; 