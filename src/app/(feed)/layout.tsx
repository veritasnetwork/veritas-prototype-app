'use client';

import FeedNav from '@/components/layout/FeedNav';
import { FeedProvider, useFeed } from '@/contexts/FeedContext';

function FeedNavWrapper() {
  const {
    searchQuery,
    activeCategory,
    activeFilters,
    sortBy,
    filterStatus,
    setSearchQuery,
    setActiveCategory,
    setSortBy,
    setFilterStatus,
    handleFilterToggle,
  } = useFeed();

  return (
    <FeedNav
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      activeFilters={activeFilters}
      sortBy={sortBy}
      filterStatus={filterStatus}
      onFilterToggle={handleFilterToggle}
      onSortChange={setSortBy}
      onStatusChange={setFilterStatus}
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
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <FeedNavWrapper />
        
        {/* Main Content with proper spacing for the enhanced navbar */}
        <main className="pt-[100px] md:pt-[200px] pb-24 md:pb-8">
          {children}
        </main>
      </div>
    </FeedProvider>
  );
} 