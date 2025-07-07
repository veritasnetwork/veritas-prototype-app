'use client';

import { useState, useEffect } from 'react';
import { MainFeed } from '@/components/feed/MainFeed';
import { useFeed } from '@/contexts/FeedContext';

// This component receives feed state via FeedContext from the layout
export default function FeedPage() {
  const [isLoading, setIsLoading] = useState(true);
  const { filteredBeliefs } = useFeed();

  // Enhanced loading with staggered reveal
  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Reduced loading time since we have better loading states in components
    
    return () => clearTimeout(loadingTimer);
  }, []);

  return (
    <MainFeed 
      beliefs={filteredBeliefs}
      loading={isLoading}
    />
  );
}