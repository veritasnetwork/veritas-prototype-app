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

  // Separate premier and regular beliefs
  const premierBeliefs = beliefs.filter(belief => belief.isPremier);
  const regularBeliefs = beliefs.filter(belief => !belief.isPremier);

  const handleBeliefClick = (beliefId: string) => {
    router.push(`/belief/${beliefId}`);
  };

  // Grid view - hide premier header, show enhanced grid
  if (viewMode === 'grid') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Full-width grid container with minimal padding */}
        <div className="w-full px-4 sm:px-6">
          <BeliefCardGrid 
            beliefs={beliefs}
            loading={loading}
            columns={3} // Fixed 3 columns for desktop grid view
            onLoadMore={() => {}}
            hasMore={false}
          />
        </div>
      </div>
    );
  }

  // Mobile feed - single column, no premier header
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MobileFeed 
          beliefs={beliefs}
          onBeliefClick={handleBeliefClick}
          loading={loading}
        />
      </div>
    );
  }

  // Desktop feed - premier header + news feed
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="space-y-12">
        {/* Premier Header - Show skeleton when loading or actual header when loaded */}
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