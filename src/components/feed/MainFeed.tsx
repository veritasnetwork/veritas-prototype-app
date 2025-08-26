'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Belief } from '@/types/belief.types';
import { PremierHeader } from './PremierHeader';
import { NewsFeed } from './NewsFeed';
import { MobileFeed } from './MobileFeed';
import { BeliefCardGrid } from './BeliefCardGrid';
import { SkeletonPremierHeader } from './skeleton/SkeletonPremierHeader';
import { useFeed } from '@/contexts/FeedContext';

interface MainFeedProps {
  beliefs: Belief[];
  loading?: boolean;
}

export const MainFeed: React.FC<MainFeedProps> = ({ beliefs, loading = false }) => {
  const router = useRouter();
  const { viewMode } = useFeed();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use algorithm-ranked content: top 3 for premier, next 10 for feed
  const premierBeliefs = beliefs.slice(0, 3);  // Top 3 based on algorithm
  const regularBeliefs = beliefs.slice(3, 13); // Next 10 for main feed (total max 13)

  const handleBeliefClick = (beliefId: string) => {
    router.push(`/belief/${beliefId}`);
  };

  // Grid view - show max 10 items
  if (viewMode === 'grid') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-veritas-darker-blue">
        {/* Full-width grid container with minimal padding */}
        <div className="w-full px-4 sm:px-6">
          <BeliefCardGrid 
            beliefs={beliefs.slice(0, 10)} // Limit to 10 items
            loading={loading}
            columns={3} // Fixed 3 columns for desktop grid view
            onLoadMore={() => {}}
            hasMore={false}
          />
        </div>
      </div>
    );
  }

  // Mobile feed - single column, limit to 10 items
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-veritas-darker-blue">
        <MobileFeed 
          beliefs={beliefs.slice(0, 10)} // Limit to 10 items
          onBeliefClick={handleBeliefClick}
          loading={loading}
        />
      </div>
    );
  }

  // Desktop feed - premier header + news feed
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-veritas-darker-blue">
      <div className="space-y-12">
        {/* Premier Header - Top 3 from algorithm ranking */}
        {loading ? (
          <SkeletonPremierHeader />
        ) : (
          premierBeliefs.length > 0 && (
            <PremierHeader 
              premierBeliefs={premierBeliefs}
              onBeliefClick={handleBeliefClick}
            />
          )
        )}
        
        {/* Regular Feed */}
        <NewsFeed 
          beliefs={regularBeliefs}
          onBeliefClick={handleBeliefClick}
          loading={loading}
        />
      </div>
    </div>
  );
}; 