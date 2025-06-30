'use client';

import { useState, useEffect } from 'react';
import { GroupedCardContainer } from '@/components/feed/enhanced/GroupedCardContainer';
import { SkeletonGroupedContainer } from '@/components/feed/skeleton/SkeletonGroupedContainer';
import { useFeed } from '@/contexts/FeedContext';

// This component receives feed state via FeedContext from the layout
export default function FeedPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const { filteredBeliefs, searchQuery } = useFeed();

  // Enhanced loading with staggered reveal
  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
      // Small delay before showing content for smooth transition
      setTimeout(() => {
        setShowContent(true);
      }, 100);
    }, 1200); // Slightly longer to appreciate the premium skeleton
    
    return () => clearTimeout(loadingTimer);
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto pt-4 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <SkeletonGroupedContainer />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-2 pt-4">
      {/* Grouped card system with reveal animation */}
      <div className={`${showContent ? 'content-reveal' : 'opacity-0'}`}>
        <GroupedCardContainer 
          beliefs={filteredBeliefs}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
}