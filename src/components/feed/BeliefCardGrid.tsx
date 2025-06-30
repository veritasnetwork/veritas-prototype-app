'use client';

import { useState, useEffect, useMemo } from 'react';
import { SortOption, FilterStatus } from '@/types/belief.types';
import { BeliefCard } from './BeliefCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { getAllBeliefs, getBeliefsByCategory, getBeliefsByStatus, searchBeliefs, sortBeliefs } from '@/lib/data';

interface BeliefCardGridProps {
  searchQuery?: string;
  selectedCategory?: string;
  sortBy?: SortOption;
  filterStatus?: FilterStatus;
}

export const BeliefCardGrid: React.FC<BeliefCardGridProps> = ({
  searchQuery = '',
  selectedCategory = '',
  sortBy = 'recent',
  filterStatus = 'all'
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Get and filter beliefs using our data utilities
  const beliefs = useMemo(() => {
    let filteredBeliefs = getAllBeliefs();

    // Apply search first
    if (searchQuery) {
      filteredBeliefs = searchBeliefs(searchQuery);
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filteredBeliefs = filteredBeliefs.filter(belief => 
        getBeliefsByCategory(selectedCategory).includes(belief)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filteredBeliefs = filteredBeliefs.filter(belief =>
        getBeliefsByStatus(filterStatus).includes(belief)
      );
    }

    // Apply sorting
    return sortBeliefs(filteredBeliefs, sortBy);
  }, [searchQuery, selectedCategory, sortBy, filterStatus]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleCardClick = (beliefId: string) => {
    router.push(`/belief/${beliefId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (beliefs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 dark:text-slate-400">
          No beliefs found matching your criteria.
        </p>
        {(searchQuery || selectedCategory || filterStatus !== 'all') && (
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
            Try adjusting your search or filters.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {beliefs.map((belief) => (
        <BeliefCard
          key={belief.id}
          belief={belief}
          compact={belief.layoutType === 'minimal'}
          onClick={handleCardClick}
        />
      ))}
    </div>
  );
};
