'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Belief } from '@/types/belief.types';
import { PremierHeader } from './PremierHeader';
import { TwoColumnFeed } from './TwoColumnFeed';
import { MobileFeed } from './MobileFeed';
import { BeliefCardGrid } from './BeliefCardGrid';
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
        <BeliefCardGrid 
          beliefs={beliefs}
          loading={loading}
          columns={isMobile ? 3 : 5}
          onLoadMore={() => {}}
          hasMore={false}
        />
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

  // Desktop feed - premier header + two column feed
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="space-y-12">
        {/* Premier Header */}
        {premierBeliefs.length > 0 && !loading && (
          <PremierHeader 
            premierBeliefs={premierBeliefs}
            onBeliefClick={handleBeliefClick}
          />
        )}
        
        {/* Regular Feed */}
        <TwoColumnFeed 
          beliefs={regularBeliefs}
          onBeliefClick={handleBeliefClick}
          loading={loading}
        />
      </div>
    </div>
  );
}; 