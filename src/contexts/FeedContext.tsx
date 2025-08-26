'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { FilterStatus, SortOption, Belief, Content, ViewMode } from '@/types/belief.types';
import { Algorithm } from '@/types/algorithm.types';
import { getAllBeliefs, getAllContent, getAllAlgorithms } from '@/lib/data';
import { rankContent } from '@/lib/algorithmEngine';

interface FeedContextType {
  // State
  searchQuery: string;
  activeCategory: string;
  activeFilters: string[];
  sortBy: SortOption;
  filterStatus: FilterStatus;
  viewMode: ViewMode;
  filteredBeliefs: Belief[];
  allBeliefs: Belief[];
  
  // Algorithm-related
  currentAlgorithm: Algorithm | null;
  rankedContent: Content[];
  
  // Actions
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  setSortBy: (sort: SortOption) => void;
  setFilterStatus: (status: FilterStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  handleFilterToggle: (filter: string) => void;
  setCurrentAlgorithm: (algorithm: Algorithm) => void;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: React.ReactNode }) {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('trending');
  const [activeFilters, setActiveFilters] = useState<string[]>(['all']);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [currentAlgorithm, setCurrentAlgorithm] = useState<Algorithm | null>(null);

  // Initialize with first preset algorithm
  useEffect(() => {
    const algorithms = getAllAlgorithms();
    if (algorithms.length > 0 && !currentAlgorithm) {
      setCurrentAlgorithm(algorithms[0]); // Default to "Balanced Discovery"
    }
  }, [currentAlgorithm]);

  // Data
  const allBeliefs = getAllBeliefs();
  const allContent = getAllContent();

  // Rank content using algorithm
  const rankedContent = useMemo(() => {
    if (!currentAlgorithm) return allContent;
    
    let content = allContent;
    
    // Apply search filter to content
    if (searchQuery.trim()) {
      const lowercaseQuery = searchQuery.toLowerCase();
      content = content.filter(c => 
        c.heading.title.toLowerCase().includes(lowercaseQuery) ||
        c.article.content.toLowerCase().includes(lowercaseQuery) ||
        c.article.headline?.toLowerCase().includes(lowercaseQuery)
      );
    }
    
    // Apply status filter
    if (filterStatus !== 'all') {
      content = content.filter(c => {
        if (filterStatus === 'resolved') return c.status === 'resolved';
        if (filterStatus === 'closed') return c.status === 'resolved'; // Map closed to resolved for backward compatibility
        return true;
      });
    }
    
    // Rank using algorithm
    return rankContent(content, currentAlgorithm);
  }, [allContent, searchQuery, filterStatus, currentAlgorithm]);

  // Convert ranked content to beliefs for backward compatibility
  const filteredBeliefs = useMemo(() => {
    return rankedContent.map(content => ({
      ...content,
      objectRankingScores: {
        truth: content.signals.truth?.currentValue || 0,
        relevance: content.signals.relevance?.currentValue || 0,
        informativeness: content.signals.informativeness?.currentValue || 0
      },
      charts: [],
      category: undefined
    } as Belief));
  }, [rankedContent]);

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

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('veritas-view-mode', mode);
    }
  };

  // Load view mode from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('veritas-view-mode') as ViewMode;
      if (savedMode && ['feed', 'grid'].includes(savedMode)) {
        setViewMode(savedMode);
      }
    }
  }, []);

  const contextValue: FeedContextType = {
    searchQuery,
    activeCategory,
    activeFilters,
    sortBy,
    filterStatus,
    viewMode,
    filteredBeliefs,
    allBeliefs,
    currentAlgorithm,
    rankedContent,
    setSearchQuery,
    setActiveCategory,
    setSortBy,
    setFilterStatus,
    setViewMode: handleViewModeChange,
    handleFilterToggle,
    setCurrentAlgorithm,
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