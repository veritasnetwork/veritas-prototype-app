import { Belief, Content, SortOption, FilterStatus, Category } from '@/types/belief.types';
import { 
  ContentType,
  NewsContent,
  OpinionContent,
  ConversationContent,
  BlogContent,
  Content as ContentUnion
} from '@/types/content.types';
import { Algorithm, SignalConfig } from '@/types/algorithm.types';
import contentData from '@/data/content.json';
import algorithmsData from '@/data/algorithms.json';
import signalsConfig from '@/data/signals-config.json';
import { categories } from '@/data';
// Import sample data for new content types
import { 
  sampleOpinionContent,
  sampleConversationContent,
  sampleBlogContent 
} from '@/data/sample-content';

// Type the imported data - using unknown first to bypass strict type checking
const legacyContent = contentData as unknown as Content[];
const typedAlgorithms = algorithmsData as Algorithm[];
const typedSignalsConfig = signalsConfig as { signals: SignalConfig[] };
const typedCategories = categories as Category[];

// Combine legacy content with new content types
// Legacy content is treated as NewsContent for backward compatibility
const legacyAsNews: NewsContent[] = legacyContent.map(content => ({
  ...content,
  type: 'news' as const,
  article: (content as unknown as Record<string, unknown>).article as NewsContent['article'] || {
    content: '',
    credibility: 'medium' as const,
    headline: content.heading?.title || '',
    excerpt: ''
  }
} as NewsContent));

// Combine all content types
const typedContent: ContentUnion[] = [
  ...legacyAsNews,
  ...sampleOpinionContent,
  ...sampleConversationContent,
  ...sampleBlogContent
];

// Type guards for content types
export const isNewsContent = (content: ContentUnion): content is NewsContent => {
  return 'type' in content && content.type === 'news' || !('type' in content); // Legacy content without type is news
};

export const isOpinionContent = (content: ContentUnion): content is OpinionContent => {
  return 'type' in content && content.type === 'opinion';
};

export const isConversationContent = (content: ContentUnion): content is ConversationContent => {
  return 'type' in content && content.type === 'conversation';
};

export const isBlogContent = (content: ContentUnion): content is BlogContent => {
  return 'type' in content && content.type === 'blog';
};

// Convert Content to Belief for backward compatibility
const contentToBelief = (content: ContentUnion): Belief => {
  // Extract article data based on content type
  let articleData: NewsContent['article'] = {
    content: '',
    credibility: 'medium' as const,
    headline: '',
    excerpt: ''
  };
  
  if (isNewsContent(content) || isBlogContent(content)) {
    articleData = (content as unknown as Record<string, unknown>).article as NewsContent['article'] || articleData;
  } else if (isOpinionContent(content)) {
    articleData = {
      content: content.description || content.question,
      credibility: 'medium' as const,
      headline: content.question,
      excerpt: content.description || ''
    };
  } else if (isConversationContent(content)) {
    articleData = {
      content: content.description,
      credibility: 'medium' as const,
      headline: content.topic,
      excerpt: content.initialPost || content.description
    };
  } else if ('article' in content) {
    // Legacy content
    articleData = (content as unknown as Record<string, unknown>).article as NewsContent['article'];
  }
  
  return {
    ...content,
    article: articleData,
    objectRankingScores: {
      truth: content.signals?.truth?.currentValue || 0,
      relevance: content.signals?.relevance?.currentValue || 0,
      informativeness: content.signals?.informativeness?.currentValue || 0
    },
    charts: [],
    category: ('tags' in content && content.tags?.[0]) || undefined // Use first tag as category
  } as Belief;
};

const typedBeliefs = typedContent.map(contentToBelief);

// Content data access (new primary functions)
export const getAllContent = (): ContentUnion[] => {
  return typedContent;
};

export const getContentById = (id: string): ContentUnion | null => {
  const content = typedContent.find(c => c.id === id);
  return content || null;
};

// Get content by type
export const getContentByType = (type: ContentType): ContentUnion[] => {
  switch (type) {
    case 'news':
      return typedContent.filter(isNewsContent);
    case 'opinion':
      return typedContent.filter(isOpinionContent);
    case 'conversation':
      return typedContent.filter(isConversationContent);
    case 'blog':
      return typedContent.filter(isBlogContent);
    default:
      return [];
  }
};

// Get mixed content for feed (respects algorithm ranking)
export const getMixedFeedContent = (algorithm?: Algorithm): ContentUnion[] => {
  let content = [...typedContent];
  
  // Apply algorithm weights if provided
  if (algorithm) {
    content = sortContentByAlgorithm(content, algorithm);
  }
  
  return content;
};

// Search across all content types
export const searchContent = (query: string): ContentUnion[] => {
  if (!query.trim()) return typedContent;
  
  const lowercaseQuery = query.toLowerCase();
  return typedContent.filter(c => {
    // Common fields
    if (c.heading.title.toLowerCase().includes(lowercaseQuery)) return true;
    if (c.heading.subtitle?.toLowerCase().includes(lowercaseQuery)) return true;
    
    // Type-specific fields
    if (isNewsContent(c) || isBlogContent(c)) {
      if (c.article.content.toLowerCase().includes(lowercaseQuery)) return true;
      if (c.article.headline?.toLowerCase().includes(lowercaseQuery)) return true;
    }
    
    if (isOpinionContent(c)) {
      if (c.question.toLowerCase().includes(lowercaseQuery)) return true;
      if (c.description?.toLowerCase().includes(lowercaseQuery)) return true;
    }
    
    if (isConversationContent(c)) {
      if (c.topic.toLowerCase().includes(lowercaseQuery)) return true;
      if (c.description.toLowerCase().includes(lowercaseQuery)) return true;
    }
    
    return false;
  });
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
export const sortContentBySignal = (content: ContentUnion[], signalKey: string): ContentUnion[] => {
  return content.sort((a, b) => {
    const aValue = a.signals?.[signalKey]?.currentValue || 0;
    const bValue = b.signals?.[signalKey]?.currentValue || 0;
    return bValue - aValue;
  });
};

// Sort content by algorithm (applies weighted signal calculation)
export const sortContentByAlgorithm = (content: ContentUnion[], algorithm: Algorithm): ContentUnion[] => {
  return content.sort((a, b) => {
    const aScore = calculateAlgorithmScore(a, algorithm);
    const bScore = calculateAlgorithmScore(b, algorithm);
    return bScore - aScore;
  });
};

// Calculate weighted score for content based on algorithm
export const calculateAlgorithmScore = (content: ContentUnion, algorithm: Algorithm): number => {
  if (!content.signals) return 0;
  
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const [signalKey, weight] of Object.entries(algorithm.weights)) {
    const signal = content.signals[signalKey];
    if (signal) {
      totalScore += signal.currentValue * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : 0;
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
export const getContentSignalValue = (content: ContentUnion, signalKey: string): number => {
  return content.signals?.[signalKey]?.currentValue || 0;
};

// NEW: Content type statistics
export const getContentTypeStats = () => {
  const total = typedContent.length;
  const news = typedContent.filter(isNewsContent).length;
  const opinions = typedContent.filter(isOpinionContent).length;
  const conversations = typedContent.filter(isConversationContent).length;
  const blogs = typedContent.filter(isBlogContent).length;
  
  return {
    total,
    byType: {
      news,
      opinion: opinions,
      conversation: conversations,
      blog: blogs
    },
    percentages: {
      news: Math.round((news / total) * 100),
      opinion: Math.round((opinions / total) * 100),
      conversation: Math.round((conversations / total) * 100),
      blog: Math.round((blogs / total) * 100)
    }
  };
};

// Get related content (works across all content types)
export const getRelatedContent = (currentContentId: string, limit: number = 4): ContentUnion[] => {
  const currentContent = getContentById(currentContentId);
  if (!currentContent) return [];
  
  // Filter out current content
  const relatedContent = typedContent.filter(c => c.id !== currentContentId);
  
  // Prioritize same type
  const currentType = 'type' in currentContent ? currentContent.type : 'news';
  const sameType = relatedContent.filter(c => ('type' in c ? c.type : 'news') === currentType);
  const otherTypes = relatedContent.filter(c => ('type' in c ? c.type : 'news') !== currentType);
  
  // Prioritize by tag overlap
  const currentTags = 'tags' in currentContent ? currentContent.tags : undefined;
  if (currentTags && currentTags.length > 0) {
    sameType.sort((a, b) => {
      const aTags = 'tags' in a ? a.tags : undefined;
      const bTags = 'tags' in b ? b.tags : undefined;
      const aOverlap = aTags?.filter((t: string) => currentTags?.includes(t)).length || 0;
      const bOverlap = bTags?.filter((t: string) => currentTags?.includes(t)).length || 0;
      return bOverlap - aOverlap;
    });
  }
  
  // Combine and return top results
  return [...sameType, ...otherTypes]
    .sort((a, b) => {
      const aRelevance = a.signals?.relevance?.currentValue || 0;
      const bRelevance = b.signals?.relevance?.currentValue || 0;
      return bRelevance - aRelevance;
    })
    .slice(0, limit);
};

// Get premier content (high-value content across all types)
export const getPremierContent = (limit: number = 3): ContentUnion[] => {
  return typedContent
    .filter(c => c.isPremier || (c.signals?.relevance?.currentValue || 0) > 80)
    .sort((a, b) => {
      const aScore = calculateAverageSignalScore(a);
      const bScore = calculateAverageSignalScore(b);
      return bScore - aScore;
    })
    .slice(0, limit);
};

// Calculate average signal score for content
const calculateAverageSignalScore = (content: ContentUnion): number => {
  if (!content.signals) return 0;
  
  const signalValues = Object.values(content.signals)
    .map(signal => signal.currentValue)
    .filter(value => typeof value === 'number');
  
  if (signalValues.length === 0) return 0;
  
  return signalValues.reduce((sum, value) => sum + value, 0) / signalValues.length;
}; 