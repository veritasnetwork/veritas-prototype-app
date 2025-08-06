'use client';

import FeedNav from '@/components/layout/FeedNav';
import { FeedProvider, useFeed } from '@/contexts/FeedContext';

function FeedNavWrapper() {
  const {
    searchQuery,
    activeCategory,
    sortBy,
    viewMode,
    setSearchQuery,
    setActiveCategory,
    setSortBy,
    setViewMode,
  } = useFeed();

  return (
    <FeedNav
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      sortBy={sortBy}
      onSortChange={setSortBy}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
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