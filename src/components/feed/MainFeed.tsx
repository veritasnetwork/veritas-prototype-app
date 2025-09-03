'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Content, isNewsContent, isBlogContent, isOpinionContent, isConversationContent } from '@/types/content.types';
import { PremierHeader } from './PremierHeader';
import { ContentCard } from './ContentCard';
import { ContentCardGrid } from './ContentCardGrid';
import { SkeletonPremierHeader } from './skeleton/SkeletonPremierHeader';
import { SkeletonContentCard } from './skeleton/SkeletonContentCard';
import { useFeed } from '@/contexts/FeedContext';
import { Loader2 } from 'lucide-react';
import { FadeTransition } from '@/components/common/ViewTransition';

interface MainFeedProps {
  contents: Content[];
  loading?: boolean;
}

// Helper function to determine card layout
const getCardLayout = (content: Content): 'full' | 'half' => {
  if (isNewsContent(content) || isBlogContent(content)) return 'full';
  if (isOpinionContent(content) || isConversationContent(content)) return 'half';
  return 'full'; // Default fallback
};

export const MainFeed: React.FC<MainFeedProps> = ({ contents, loading = false }) => {
  const router = useRouter();
  const { viewMode } = useFeed();
  const [isMobile, setIsMobile] = useState(false);
  const [displayedItems, setDisplayedItems] = useState(20); // Initial items to show
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Premier content (top 3) and feed content (rest)
  const premierContents = contents.slice(0, 3);
  const feedContents = contents.slice(3, displayedItems);
  const hasMore = displayedItems < contents.length;

  // Handle infinite scroll
  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    // Simulate loading delay for smooth UX
    setTimeout(() => {
      setDisplayedItems(prev => Math.min(prev + 10, contents.length));
      setIsLoadingMore(false);
    }, 500);
  }, [hasMore, isLoadingMore, contents.length]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, isLoadingMore, loadMore]);

  const handleContentClick = (contentId: string) => {
    router.push(`/content/${contentId}`);
  };

  // Group half-width cards intelligently
  const renderMixedContent = () => {
    const elements: React.ReactElement[] = [];
    const halfWidthCards: Content[] = [];
    
    feedContents.forEach((content) => {
      const layout = getCardLayout(content);
      
      if (layout === 'full') {
        // Flush any pending half-width card as full-width before rendering the next full-width card
        if (halfWidthCards.length === 1) {
          const card = halfWidthCards.pop()!;
          // Render the single half-width card as full-width to avoid empty space
          elements.push(
            <ContentCard
              key={card.id}
              content={card}
              variant="feed"
              onClick={handleContentClick}
            />
          );
        }
        
        // Render full-width card
        elements.push(
          <ContentCard
            key={content.id}
            content={content}
            variant="feed"
            onClick={handleContentClick}
          />
        );
      } else {
        // Collect half-width cards
        halfWidthCards.push(content);
        
        // If we have a pair, render them side by side
        if (halfWidthCards.length === 2) {
          const [first, second] = halfWidthCards;
          elements.push(
            <div key={`half-pair-${first.id}-${second.id}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ContentCard
                content={first}
                variant="feed"
                onClick={handleContentClick}
              />
              <ContentCard
                content={second}
                variant="feed"
                onClick={handleContentClick}
              />
            </div>
          );
          halfWidthCards.length = 0; // Clear the array
        }
      }
    });
    
    // Handle any remaining half-width card at the end
    if (halfWidthCards.length === 1) {
      const card = halfWidthCards[0];
      // Check if there might be more content coming (for infinite scroll)
      const mightHaveMore = hasMore && feedContents.length > 0;
      
      if (mightHaveMore) {
        // Keep it pending for pairing with next loaded content
        // For now, render as full-width to avoid empty space
        elements.push(
          <ContentCard
            key={card.id}
            content={card}
            variant="feed"
            onClick={handleContentClick}
          />
        );
      } else {
        // No more content, render as full-width
        elements.push(
          <ContentCard
            key={card.id}
            content={card}
            variant="feed"
            onClick={handleContentClick}
          />
        );
      }
    }
    
    return elements;
  };

  // Grid view - show all items with infinite scroll
  if (viewMode === 'grid') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-veritas-darker-blue">
        <div className="w-full px-4 sm:px-6">
          <ContentCardGrid 
            contents={feedContents}
            loading={loading}
            columns={3}
            onLoadMore={loadMore}
            hasMore={hasMore}
          />
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoadingMore && (
                <Loader2 className="h-8 w-8 animate-spin text-veritas-primary dark:text-veritas-light-blue" />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mobile feed - single column with infinite scroll
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-veritas-darker-blue">
        <div className="space-y-4 px-4">
          {/* Premier content on mobile */}
          {!loading && premierContents.length > 0 && (
            <div className="space-y-4 mb-6">
              {premierContents.map((content, index) => (
                <ContentCard
                  key={content.id}
                  content={content}
                  variant={index === 0 ? 'premier' : 'feed'}
                  onClick={handleContentClick}
                />
              ))}
            </div>
          )}
          
          {/* Regular feed */}
          <div className="space-y-4">
            {feedContents.map(content => (
              <ContentCard
                key={content.id}
                content={content}
                variant="mobile"
                onClick={handleContentClick}
              />
            ))}
          </div>
          
          {/* Loading indicator */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoadingMore ? (
                <Loader2 className="h-8 w-8 animate-spin text-veritas-primary dark:text-veritas-light-blue" />
              ) : (
                <button 
                  onClick={loadMore}
                  className="px-6 py-2 text-sm text-veritas-primary dark:text-veritas-light-blue hover:text-veritas-dark-blue dark:hover:text-veritas-light-blue/80 transition-colors"
                >
                  Load More
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop feed - premier header + mixed content feed
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-veritas-darker-blue">
      <div className="space-y-8">
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
        
        {/* Mixed Content Feed with intelligent grouping */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="space-y-6">
            {loading ? (
              // Show skeleton cards while loading
              <>
                <SkeletonContentCard variant="feed" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SkeletonContentCard variant="feed" />
                  <SkeletonContentCard variant="feed" />
                </div>
                <SkeletonContentCard variant="feed" />
              </>
            ) : (
              <FadeTransition show={!loading} duration={400}>
                <div className="space-y-6">
                  {renderMixedContent()}
                </div>
              </FadeTransition>
            )}
          </div>
          
          {/* Infinite scroll trigger */}
          {hasMore && !loading && (
            <div ref={loadMoreRef} className="flex justify-center py-12">
              {isLoadingMore ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-veritas-primary dark:text-veritas-light-blue" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Loading more content...
                  </span>
                </div>
              ) : (
                <button 
                  onClick={loadMore}
                  className="px-8 py-3 bg-white dark:bg-veritas-darker-blue border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-veritas-dark-blue transition-all hover:shadow-md"
                >
                  Load More Content
                </button>
              )}
            </div>
          )}
          
          {!hasMore && feedContents.length > 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You&apos;ve reached the end of the feed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};