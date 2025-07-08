'use client';

import { Belief } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';

interface NewsFeedProps {
  beliefs: Belief[];
  onBeliefClick: (beliefId: string) => void;
  loading?: boolean;
}

export const NewsFeed: React.FC<NewsFeedProps> = ({
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
        
        {/* Single Column News Skeleton */}
        <div className="space-y-8">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg h-80 animate-pulse">
              <div className="flex h-full">
                {/* Hero Image skeleton with overlays */}
                <div className="relative w-1/2 bg-gray-200 dark:bg-gray-700 rounded-l-2xl overflow-hidden">
                  {/* Category badge skeleton */}
                  <div className="absolute top-4 left-4 w-16 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  
                  {/* Text overlay skeleton */}
                  <div className="absolute bottom-4 left-4 right-4 space-y-3">
                    {/* Title skeleton */}
                    <div className="space-y-2">
                      <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                      <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
                    </div>
                    {/* Subtitle skeleton */}
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/5"></div>
                    
                    {/* News section skeleton */}
                    <div className="pt-3 border-t border-gray-400/20">
                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-12 mb-2"></div>
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Content skeleton - cleaner layout */}
                <div className="w-1/2 p-6 flex flex-col">
                  {/* Top: Metrics skeleton */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-full">
                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-full">
                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                    </div>
                  </div>
                  
                  {/* Chart skeleton */}
                  <div className="flex-1 mb-4">
                    <div className="h-42 bg-gray-100 dark:bg-gray-700/50 rounded-xl"></div>
                  </div>
                  
                  {/* Footer skeleton */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center gap-4">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                  </div>
                </div>
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
      
      {/* Single Column Layout */}
      <div className="space-y-8">
        {beliefs.map((belief, index) => (
          <div 
            key={belief.id}
            className="animate-in fade-in duration-500"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <BeliefCard 
              belief={belief} 
              variant="news"
              onClick={() => onBeliefClick(belief.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}; 