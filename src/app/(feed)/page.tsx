'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { GroupedCardContainer } from '@/components/feed/enhanced/GroupedCardContainer';
import { useFeed } from '@/contexts/FeedContext';

// This component receives feed state via FeedContext from the layout
export default function FeedPage() {
  const [isLoading, setIsLoading] = useState(true);
  const { filteredBeliefs, searchQuery } = useFeed();

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-slate-900 flex items-center justify-center z-40">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1B365D] rounded-2xl flex items-center justify-center mb-4 mx-auto animate-pulse shadow-lg p-3">
            <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
              <Image
                src="/icons/veritas-logo.png"
                alt="Veritas"
                width={32}
                height={32}
                className="w-full h-full object-contain rounded-full"
                priority
                unoptimized
              />
            </div>
          </div>
          <p className="text-gray-600 dark:text-slate-400 font-medium">Loading beliefs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-2 pt-4">
      {/* Grouped card system using filtered beliefs from context */}
      <GroupedCardContainer 
        beliefs={filteredBeliefs}
        searchQuery={searchQuery}
      />
    </div>
  );
}