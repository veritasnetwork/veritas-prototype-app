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
        {/* Section Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              {/* Header section skeleton */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
              
              {/* Consensus section skeleton */}
              <div className="flex items-center gap-4 mb-4">
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="flex gap-1">
                  <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="h-2 w-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
              </div>
              
              {/* Chart placeholder skeleton */}
              <div className="mb-4 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg"></div>
              
              {/* Content section skeleton */}
              <div className="mb-4 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
              </div>
              
              {/* Footer skeleton */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex gap-4">
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              </div>
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
    <div className="max-w-7xl mx-auto px-4 pb-16">
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