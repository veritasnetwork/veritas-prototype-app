'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Content } from '@/types/content.types';
import { PremierHeader } from './PremierHeader';
import { NewsFeed } from './NewsFeed';
import { MobileFeed } from './MobileFeed';
import { ContentCardGrid } from './ContentCardGrid';
import { SkeletonPremierHeader } from './skeleton/SkeletonPremierHeader';
import { useFeed } from '@/contexts/FeedContext';

interface MainFeedProps {
  contents: Content[];
  loading?: boolean;
}

export const MainFeed: React.FC<MainFeedProps> = ({ contents, loading = false }) => {
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
  const premierContents = contents.slice(0, 3);  // Top 3 based on algorithm
  const regularContents = contents.slice(3, 13); // Next 10 for main feed (total max 13)

  const handleContentClick = (contentId: string) => {
    router.push(`/content/${contentId}`);
  };

  // Grid view - show max 10 items
  if (viewMode === 'grid') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-veritas-darker-blue">
        {/* Full-width grid container with minimal padding */}
        <div className="w-full px-4 sm:px-6">
          <ContentCardGrid 
            contents={contents.slice(0, 10)} // Limit to 10 items
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
          contents={contents.slice(0, 10)} // Limit to 10 items
          onContentClick={handleContentClick}
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
          premierContents.length > 0 && (
            <PremierHeader 
              premierContents={premierContents}
              onContentClick={handleContentClick}
            />
          )
        )}
        
        {/* Regular Feed */}
        <NewsFeed 
          contents={regularContents}
          onContentClick={handleContentClick}
          loading={loading}
        />
      </div>
    </div>
  );
}; 