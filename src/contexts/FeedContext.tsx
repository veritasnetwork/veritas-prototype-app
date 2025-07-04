'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { FilterStatus, SortOption, Belief } from '@/types/belief.types';
import { getAllBeliefs, searchBeliefs, sortBeliefs, getBeliefsByCategory, getBeliefsByStatus } from '@/lib/data';

interface FeedContextType {
  // State
  searchQuery: string;
  activeCategory: string;
  activeFilters: string[];
  sortBy: SortOption;
  filterStatus: FilterStatus;
  filteredBeliefs: Belief[];
  allBeliefs: Belief[];
  
  // Actions
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  setSortBy: (sort: SortOption) => void;
  setFilterStatus: (status: FilterStatus) => void;
  handleFilterToggle: (filter: string) => void;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: React.ReactNode }) {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('trending');
  const [activeFilters, setActiveFilters] = useState<string[]>(['all']);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Data
  const allBeliefs = getAllBeliefs();

  // Filter and sort beliefs
  const filteredBeliefs = useMemo(() => {
    let beliefs = allBeliefs;

    // Apply search
    if (searchQuery.trim()) {
      const searchResults = searchBeliefs(searchQuery);
      beliefs = beliefs.filter(b => searchResults.some(sb => sb.id === b.id));
    }

    // Apply category filter
    if (activeCategory !== 'trending' && activeCategory !== 'new') {
      const categoryResults = getBeliefsByCategory(activeCategory);
      beliefs = beliefs.filter(b => categoryResults.some(cb => cb.id === b.id));
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      const statusResults = getBeliefsByStatus(filterStatus);
      beliefs = beliefs.filter(b => statusResults.some(sb => sb.id === b.id));
    }

    // Apply quick filters
    if (!activeFilters.includes('all') && activeFilters.length > 0) {
      beliefs = beliefs.filter(belief => {
        return activeFilters.some(filter => {
          switch (filter) {
            case 'breaking-news':
              // High informativeness indicates breaking/noteworthy content
              return belief.objectRankingScores.informativeness > 75;
            case 'high-stakes':
              // High truth score indicates high-stakes/important information
              return belief.objectRankingScores.truth > 85;
            case 'ending-soon':
              // High relevance indicates time-sensitive content
              return belief.objectRankingScores.relevance > 80;
            case 'recently-active':
              // Combination of high relevance and informativeness
              return belief.objectRankingScores.relevance > 70 && belief.objectRankingScores.informativeness > 70;
            case 'high-consensus':
              // High truth score indicates strong consensus/confidence
              return belief.objectRankingScores.truth > 90;
            default:
              return true;
          }
        });
      });
    }

    // Apply sorting
    beliefs = sortBeliefs(beliefs, sortBy);

    return beliefs;
  }, [allBeliefs, searchQuery, activeCategory, filterStatus, activeFilters, sortBy]);

  // Handle filter toggle
  const handleFilterToggle = (filter: string) => {
    if (filter === 'All') {
      setActiveFilters(['all']);
    } else {
      const filterKey = filter.toLowerCase().replace(' ', '-');
      setActiveFilters(prev => {
        if (prev.includes('all')) {
          return [filterKey];
        }
        if (prev.includes(filterKey)) {
          const newFilters = prev.filter(f => f !== filterKey);
          return newFilters.length === 0 ? ['all'] : newFilters;
        }
        return [...prev, filterKey];
      });
    }
  };

  const contextValue: FeedContextType = {
    searchQuery,
    activeCategory,
    activeFilters,
    sortBy,
    filterStatus,
    filteredBeliefs,
    allBeliefs,
    setSearchQuery,
    setActiveCategory,
    setSortBy,
    setFilterStatus,
    handleFilterToggle,
  };

  return (
    <FeedContext.Provider value={contextValue}>
      {children}
    </FeedContext.Provider>
  );
}

export function useFeed() {
  const context = useContext(FeedContext);
  if (context === undefined) {
    throw new Error('useFeed must be used within a FeedProvider');
  }
  return context;
} 