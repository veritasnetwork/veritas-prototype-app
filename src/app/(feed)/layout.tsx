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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <FeedNavWrapper />
        {/* Main content with padding for fixed nav */}
        <div className="pt-48 lg:pt-56 pb-4 lg:pb-8">
          {children}
        </div>
      </div>
    </FeedProvider>
  );
} 