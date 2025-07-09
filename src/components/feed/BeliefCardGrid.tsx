'use client';

import { useState, useEffect, useMemo } from 'react';
import { Belief } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';
import { SkeletonBeliefCard } from './skeleton/SkeletonBeliefCard';
import { useRouter } from 'next/navigation';
import { Brain, Sparkles, TrendingUp } from 'lucide-react';

interface BeliefCardGridProps {
  beliefs: Belief[];
  loading?: boolean;
  columns?: 2 | 3 | 4 | 5; // Responsive column count
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export const BeliefCardGrid: React.FC<BeliefCardGridProps> = ({
  beliefs,
  loading = false,
  columns = 3,
  onLoadMore,
  hasMore = false
}) => {
  const [isLoading, setIsLoading] = useState(loading);
  const [showContent, setShowContent] = useState(!loading);
  const [visibleCards, setVisibleCards] = useState(15); // Start with 15 cards for grid
  const router = useRouter();

  // Handle loading states
  useEffect(() => {
    if (loading) {
      setIsLoading(true);
      setShowContent(false);
    } else {
      const timer = setTimeout(() => {
        setIsLoading(false);
        setTimeout(() => setShowContent(true), 100);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Handle infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >= 
        document.documentElement.offsetHeight - 1000 &&
        !isLoading &&
        hasMore
      ) {
        if (onLoadMore) {
          onLoadMore();
        } else {
          // Load more cards from current beliefs
          setVisibleCards(prev => Math.min(prev + 12, beliefs.length));
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, beliefs.length, onLoadMore]);

  const handleBeliefClick = (beliefId: string) => {
    router.push(`/belief/${beliefId}`);
  };

  // Get beliefs to display
  const visibleBeliefs = useMemo(() => {
    return beliefs.slice(0, visibleCards);
  }, [beliefs, visibleCards]);

  // Get grid column classes based on columns prop
  const getGridClasses = () => {
    const baseClasses = 'grid gap-4 sm:gap-6';
    // For columns=3 (our new grid view), enforce exactly 3 columns on desktop
    if (columns === 3) {
      return `${baseClasses} grid-cols-1 md:grid-cols-2 lg:grid-cols-3`;
    }
    switch (columns) {
      case 2:
        return `${baseClasses} grid-cols-1 sm:grid-cols-2`;
      case 4:
        return `${baseClasses} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`;
      case 5:
        return `${baseClasses} grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`;
      default:
        return `${baseClasses} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full py-8">
        <div className={getGridClasses()}>
          {[...Array(12)].map((_, index) => (
            <div 
              key={index}
              className="animate-in fade-in duration-300"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <SkeletonBeliefCard variant="large" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && beliefs.length === 0) {
    return (
      <div className="w-full py-16">
        <div className="text-center space-y-6 max-w-2xl mx-auto">
          <div className="relative">
            <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
              <Brain className="w-16 h-16 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-yellow-900" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              No beliefs found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Be the first to share your insights! Create a belief to start engaging with the community.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={() => router.push('/create')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Create Belief
            </button>
            <button 
              onClick={() => router.push('/explore')}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors duration-200"
            >
              Explore Categories
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-8">
      {/* Grid Header */}
      <div className="mb-8 max-w-2xl mx-auto lg:max-w-none">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Grid View
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Browse beliefs in a compact grid layout with enhanced details
        </p>
      </div>

      {/* Belief Cards Grid */}
      <div className={`${getGridClasses()} ${showContent ? 'animate-in fade-in duration-500' : 'opacity-0'}`}>
        {visibleBeliefs.map((belief, index) => (
          <div
            key={belief.id}
            className="animate-in slide-in-from-bottom duration-300"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <BeliefCard
              belief={belief}
              variant="large"
              onClick={handleBeliefClick}
            />
          </div>
        ))}
      </div>

      {/* Load More / Loading Indicator */}
      {(visibleCards < beliefs.length || hasMore) && (
        <div className="mt-8 flex justify-center">
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <span className="text-sm">Loading more beliefs...</span>
          </div>
        </div>
      )}

      {/* End of grid indicator */}
      {!hasMore && visibleCards >= beliefs.length && beliefs.length > 0 && (
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400">
            <Sparkles className="w-4 h-4" />
            <span>You&apos;ve reached the end of the grid</span>
          </div>
        </div>
      )}
    </div>
  );
};
