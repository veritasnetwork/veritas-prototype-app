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
      <div className="space-y-1 pb-32">
        {[...Array(5)].map((_, index) => (
          <div 
            key={index} 
            className="bg-gray-200 dark:bg-gray-700 p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 animate-pulse"
          >
            {/* Mobile card skeleton content */}
            <div className="flex items-start gap-4">
              {/* Image skeleton */}
              <div className="w-20 h-20 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
              
              {/* Content skeleton */}
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                
                {/* Consensus skeleton */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="h-6 w-12 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  <div className="h-4 w-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (beliefs.length === 0) {
    return (
      <div className="px-4 py-16 pb-32 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No insights match your current filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-32">
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