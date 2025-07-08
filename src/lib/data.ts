import { Belief, SortOption, FilterStatus, Category } from '@/types/belief.types';
import beliefsData from '@/data/beliefs.json';
import { categories } from '@/data';

// Type the imported data
const typedBeliefs = beliefsData as Belief[];
const typedCategories = categories as Category[];

// Belief data access
export const getAllBeliefs = (): Belief[] => {
  return typedBeliefs;
};

export const getBeliefById = (id: string): Belief | null => {
  const belief = typedBeliefs.find(b => b.id === id);
  return belief || null;
};

export const getBeliefsByCategory = (category: string): Belief[] => {
  return typedBeliefs.filter(b => 
    b.category?.toLowerCase() === category.toLowerCase()
  );
};

export const getBeliefsByStatus = (status: FilterStatus): Belief[] => {
  if (status === 'all') return typedBeliefs;
  return typedBeliefs.filter(b => b.status === status);
};

export const searchBeliefs = (query: string): Belief[] => {
  if (!query.trim()) return typedBeliefs;
  
  const lowercaseQuery = query.toLowerCase();
  return typedBeliefs.filter(b => 
    b.heading.title.toLowerCase().includes(lowercaseQuery) ||
    b.article.content.toLowerCase().includes(lowercaseQuery) ||
    b.article.headline?.toLowerCase().includes(lowercaseQuery) ||
    b.category?.toLowerCase().includes(lowercaseQuery)
  );
};

// NEW: Ranking-based sorting for information intelligence
export const sortBeliefs = (beliefs: Belief[], sortBy: SortOption): Belief[] => {
  switch (sortBy) {
    case 'truth':
      return beliefs.sort((a, b) => b.objectRankingScores.truth - a.objectRankingScores.truth);
    case 'relevance':
      return beliefs.sort((a, b) => b.objectRankingScores.relevance - a.objectRankingScores.relevance);
    case 'informativeness':
      return beliefs.sort((a, b) => b.objectRankingScores.informativeness - a.objectRankingScores.informativeness);
    default:
      return beliefs;
  }
};

// NEW: Chart utility functions
export const getFeedChart = (belief: Belief) => {
  return belief.charts.find(chart => chart.showInFeed);
};

export const getDetailCharts = (belief: Belief) => {
  return belief.charts;
};

// Updated belief stats for information intelligence
export const getBeliefStats = () => {
  const total = typedBeliefs.length;
  const continuous = typedBeliefs.filter(b => !b.status).length;
  const resolved = typedBeliefs.filter(b => b.status === 'resolved').length;
  const closed = typedBeliefs.filter(b => b.status === 'closed').length;
  
  // Calculate average ranking scores
  const avgTruth = typedBeliefs.reduce((sum, b) => sum + b.objectRankingScores.truth, 0) / total;
  const avgRelevance = typedBeliefs.reduce((sum, b) => sum + b.objectRankingScores.relevance, 0) / total;
  const avgInformativeness = typedBeliefs.reduce((sum, b) => sum + b.objectRankingScores.informativeness, 0) / total;
  
  return {
    total,
    continuous,
    resolved,
    closed,
    avgTruth: Math.round(avgTruth * 100) / 100,
    avgRelevance: Math.round(avgRelevance * 100) / 100,
    avgInformativeness: Math.round(avgInformativeness * 100) / 100
  };
};

// Category data access
export const getAllCategories = (): Category[] => {
  return typedCategories;
};

export const getCategoryById = (id: string): Category | null => {
  const category = typedCategories.find(c => c.id === id);
  return category || null;
};

export const getCategoryByName = (name: string): Category | null => {
  const category = typedCategories.find(c => 
    c.name.toLowerCase() === name.toLowerCase()
  );
  return category || null;
};

export const getCategoryStats = () => {
  const categoryStats = typedCategories.map(category => ({
    ...category,
    beliefCount: getBeliefsByCategory(category.name).length,
    continuousBeliefs: getBeliefsByCategory(category.name).filter(b => !b.status).length,
    avgTruthScore: Math.round(getBeliefsByCategory(category.name).reduce((sum, b) => sum + b.objectRankingScores.truth, 0) / getBeliefsByCategory(category.name).length * 100) / 100 || 0
  }));
  
  return categoryStats;
};

// Related beliefs for detail page
export const getRelatedBeliefs = (currentBeliefId: string, category?: string): Belief[] => {
  const allBeliefs = getAllBeliefs();
  
  // Filter out current belief
  let relatedBeliefs = allBeliefs.filter(b => b.id !== currentBeliefId);
  
  // If category provided, prioritize same category
  if (category) {
    const sameCategoryBeliefs = relatedBeliefs.filter(b => b.category === category);
    const otherBeliefs = relatedBeliefs.filter(b => b.category !== category);
    relatedBeliefs = [...sameCategoryBeliefs, ...otherBeliefs];
  }
  
  return relatedBeliefs
    .sort((a, b) => b.objectRankingScores.relevance - a.objectRankingScores.relevance)
    .slice(0, 4);
};

export const getCategoryGradient = (category: string): string => {
  switch (category?.toLowerCase()) {
    case 'defense':
      return 'from-[#EF4444]/20 to-[#DC2626]/10';
    case 'environment':
      return 'from-[#10B981]/20 to-[#059669]/10';
    case 'technology':
      return 'from-[#3B82F6]/20 to-[#2563EB]/10';
    case 'finance':
      return 'from-[#FFB800]/20 to-[#F5A623]/10';
    case 'politics':
      return 'from-[#1B365D]/20 to-[#2D4A6B]/10';
    default:
      return 'from-[#1B365D]/20 to-[#FFB800]/10';
  }
};

// NEW: Information quality assessment
export const getInformationQuality = (belief: Belief): string => {
  const avgScore = (belief.objectRankingScores.truth + belief.objectRankingScores.relevance + belief.objectRankingScores.informativeness) / 3;
  
  if (avgScore >= 85) return 'Excellent';
  if (avgScore >= 70) return 'High';
  if (avgScore >= 55) return 'Good';
  if (avgScore >= 40) return 'Fair';
  return 'Low';
};

// NEW: Get beliefs by ranking threshold
export const getBeliefsByRankingThreshold = (
  ranking: 'truth' | 'relevance' | 'informativeness',
  minThreshold: number
): Belief[] => {
  return typedBeliefs.filter(b => b.objectRankingScores[ranking] >= minThreshold);
};

// NEW: Get top beliefs by ranking
export const getTopBeliefsByRanking = (
  ranking: 'truth' | 'relevance' | 'informativeness',
  limit: number = 10
): Belief[] => {
  return typedBeliefs
    .sort((a, b) => b.objectRankingScores[ranking] - a.objectRankingScores[ranking])
    .slice(0, limit);
}; 