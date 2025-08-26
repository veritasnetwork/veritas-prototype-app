import { Belief, Content, SortOption, FilterStatus, Category } from '@/types/belief.types';
import { Algorithm, SignalConfig } from '@/types/algorithm.types';
import contentData from '@/data/content.json';
import algorithmsData from '@/data/algorithms.json';
import signalsConfig from '@/data/signals-config.json';
import { categories } from '@/data';

// Type the imported data - using unknown first to bypass strict type checking
const typedContent = contentData as unknown as Content[];
const typedAlgorithms = algorithmsData as Algorithm[];
const typedSignalsConfig = signalsConfig as { signals: SignalConfig[] };
const typedCategories = categories as Category[];

// Convert Content to Belief for backward compatibility
const contentToBelief = (content: Content): Belief => {
  return {
    ...content,
    objectRankingScores: {
      truth: content.signals?.truth?.currentValue || 0,
      relevance: content.signals?.relevance?.currentValue || 0,
      informativeness: content.signals?.informativeness?.currentValue || 0
    },
    charts: [],
    category: undefined // Will need to infer from signals or metadata
  };
};

const typedBeliefs = typedContent.map(contentToBelief);

// Content data access (new primary functions)
export const getAllContent = (): Content[] => {
  return typedContent;
};

export const getContentById = (id: string): Content | null => {
  const content = typedContent.find(c => c.id === id);
  return content || null;
};

// Belief data access (backward compatibility)
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
      return beliefs.sort((a, b) => (b.objectRankingScores?.truth || 0) - (a.objectRankingScores?.truth || 0));
    case 'relevance':
      return beliefs.sort((a, b) => (b.objectRankingScores?.relevance || 0) - (a.objectRankingScores?.relevance || 0));
    case 'informativeness':
      return beliefs.sort((a, b) => (b.objectRankingScores?.informativeness || 0) - (a.objectRankingScores?.informativeness || 0));
    default:
      return beliefs;
  }
};

// Sort content by signal value
export const sortContentBySignal = (content: Content[], signalKey: string): Content[] => {
  return content.sort((a, b) => {
    const aValue = a.signals[signalKey]?.currentValue || 0;
    const bValue = b.signals[signalKey]?.currentValue || 0;
    return bValue - aValue;
  });
};

// NEW: Chart utility functions
export const getFeedChart = (belief: Belief) => {
  return belief.charts?.find(chart => chart.showInFeed);
};

export const getDetailCharts = (belief: Belief) => {
  return belief.charts || [];
};

// Algorithm data access
export const getAllAlgorithms = (): Algorithm[] => {
  return typedAlgorithms;
};

export const getAlgorithmById = (id: string): Algorithm | null => {
  return typedAlgorithms.find(a => a.id === id) || null;
};

// Signal configuration access
export const getSignalConfig = (signalKey: string): SignalConfig | undefined => {
  return typedSignalsConfig.signals.find(s => s.key === signalKey);
};

export const getAllSignalConfigs = (): SignalConfig[] => {
  return typedSignalsConfig.signals;
};

// Updated belief stats for information intelligence
export const getBeliefStats = () => {
  const total = typedBeliefs.length;
  const continuous = typedBeliefs.filter(b => !b.status).length;
  const resolved = typedBeliefs.filter(b => b.status === 'resolved').length;
  const closed = 0; // 'closed' status no longer exists, kept for backward compatibility
  
  // Calculate average ranking scores
  const avgTruth = typedBeliefs.reduce((sum, b) => sum + (b.objectRankingScores?.truth || 0), 0) / total;
  const avgRelevance = typedBeliefs.reduce((sum, b) => sum + (b.objectRankingScores?.relevance || 0), 0) / total;
  const avgInformativeness = typedBeliefs.reduce((sum, b) => sum + (b.objectRankingScores?.informativeness || 0), 0) / total;
  
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
    avgTruthScore: Math.round(getBeliefsByCategory(category.name).reduce((sum, b) => sum + (b.objectRankingScores?.truth || 0), 0) / getBeliefsByCategory(category.name).length * 100) / 100 || 0
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
    .sort((a, b) => (b.objectRankingScores?.relevance || 0) - (a.objectRankingScores?.relevance || 0))
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
  const avgScore = ((belief.objectRankingScores?.truth || 0) + (belief.objectRankingScores?.relevance || 0) + (belief.objectRankingScores?.informativeness || 0)) / 3;
  
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
  return typedBeliefs.filter(b => (b.objectRankingScores?.[ranking] || 0) >= minThreshold);
};

// NEW: Get top beliefs by ranking
export const getTopBeliefsByRanking = (
  ranking: 'truth' | 'relevance' | 'informativeness',
  limit: number = 10
): Belief[] => {
  return typedBeliefs
    .sort((a, b) => (b.objectRankingScores?.[ranking] || 0) - (a.objectRankingScores?.[ranking] || 0))
    .slice(0, limit);
};

// Get content signal value
export const getContentSignalValue = (content: Content, signalKey: string): number => {
  return content.signals[signalKey]?.currentValue || 0;
}; 