'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Content } from '@/types/content.types';
import { ContentCard } from './ContentCard';
import { SkeletonContentCard } from './skeleton/SkeletonContentCard';
import { useRouter } from 'next/navigation';
import { Brain, TrendingUp, Sparkles } from 'lucide-react';

interface ContentFeedProps {
  contents: Content[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export const ContentFeed: React.FC<ContentFeedProps> = ({
  contents,
  loading = false,
  onLoadMore,
  hasMore = false
}) => {
  const [isLoading, setIsLoading] = useState(loading);
  const [showContent, setShowContent] = useState(!loading);
  const [visibleCards, setVisibleCards] = useState(10); // Start with 10 cards
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
      }, 800);
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
          // Load more cards from current contents
          setVisibleCards(prev => Math.min(prev + 10, contents.length));
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, contents.length, onLoadMore]);

  const handleContentClick = (contentId: string) => {
    router.push(`/content/${contentId}`);
  };

  // Get contents to display
  const visibleContents = useMemo(() => {
    return contents.slice(0, visibleCards);
  }, [contents, visibleCards]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {[...Array(6)].map((_, index) => (
            <div 
              key={index}
              className="animate-in fade-in duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <SkeletonContentCard />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && contents.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center space-y-6">
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
              No content found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Be the first to share your insights! Create content to start engaging with the community.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={() => router.push('/create')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Create Content
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Feed Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Live Feed
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Explore the latest beliefs and predictions from the community
        </p>
      </div>

      {/* Content Cards */}
      <div className={`space-y-6 ${showContent ? 'animate-in fade-in duration-500' : 'opacity-0'}`}>
        {visibleContents.map((content, index) => (
          <div
            key={content.id}
            className="animate-in slide-in-from-bottom duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ContentCard
              content={content}
              variant="feed"
              onClick={handleContentClick}
            />
          </div>
        ))}
      </div>

      {/* Load More / Loading Indicator */}
      {(visibleCards < contents.length || hasMore) && (
        <div className="mt-8 flex justify-center">
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <span className="text-sm">Loading more content...</span>
          </div>
        </div>
      )}

      {/* End of feed indicator */}
      {!hasMore && visibleCards >= contents.length && contents.length > 0 && (
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400">
            <Sparkles className="w-4 h-4" />
            <span>You&apos;ve reached the end of the feed</span>
          </div>
        </div>
      )}
    </div>
  );
}; 