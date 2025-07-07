'use client';

import { Belief } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';

interface TwoColumnFeedProps {
  beliefs: Belief[];
  onBeliefClick: (beliefId: string) => void;
  loading?: boolean;
}

export const TwoColumnFeed: React.FC<TwoColumnFeedProps> = ({
  beliefs,
  onBeliefClick,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-80"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (beliefs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No insights match your current filters
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Section Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Latest Insights
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Discover what the community is exploring
        </p>
      </div>
      
      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {beliefs.map((belief, index) => (
          <div 
            key={belief.id}
            className="animate-in fade-in duration-500"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <BeliefCard 
              belief={belief} 
              variant="feed"
              onClick={() => onBeliefClick(belief.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}; 