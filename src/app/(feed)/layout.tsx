'use client';

import FeedNav from '@/components/layout/FeedNav';
import { FeedProvider, useFeed } from '@/contexts/FeedContext';

function FeedNavWrapper() {
  const {
    searchQuery,
    viewMode,
    currentAlgorithm,
    setSearchQuery,
    setViewMode,
    setCurrentAlgorithm,
  } = useFeed();

  return (
    <FeedNav
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      currentAlgorithm={currentAlgorithm}
      onAlgorithmChange={setCurrentAlgorithm}
    />
  );
}

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeedProvider>
      <div className="min-h-screen bg-background">
        <FeedNavWrapper />
        {/* Main content with padding for fixed nav */}
        <div className="pt-32 lg:pt-56 pb-4 lg:pb-0">
          {children}
        </div>
      </div>
    </FeedProvider>
  );
} 