// Additional types for enhanced data structure
export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  subCategories: string[];
}

export type LayoutType = 'minimal' | 'balanced' | 'article-heavy' | 'data-focused';
export type FilterStatus = 'all' | 'resolved' | 'closed';

// Sprint 2 additions - simplified sort options
export type SortOption = 'relevance' | 'truth' | 'informativeness';

// View mode for feed display
export type ViewMode = 'feed' | 'grid';

// Legacy interface - keeping for backward compatibility but no longer used
// export interface ConsensusHistoryPoint {
//   timestamp: string;
//   consensusLevel: number;
//   entropy: number;
// }

export interface ComponentVersion {
  [key: string]: unknown; // Component-specific data
}

export interface ComponentData {
  currentVersion: ComponentVersion;
  proposedChanges: ComponentChange[];
}

export interface ComponentChange {
  id: string;
  proposedBy: string;
  proposal: ComponentVersion;
  votes: { up: number; down: number };
  createdAt: string;
}

// NEW: Information Intelligence Structure
export interface ObjectRankingScores {
  truth: number;        // 0-100
  relevance: number;    // 0-100
  informativeness: number; // 0-100
}

export interface HeadingData {
  title: string;
  context?: string;
  subtitle?: string;
}

export interface ArticleData {
  content: string;
  credibility: 'high' | 'medium' | 'low';
  headline?: string;
  excerpt?: string;
  thumbnail?: string;
}

// Chart data structures for different types
export interface ChartAxes {
  xAxis: {
    label: string;
    unit?: string;
    type: 'time' | 'category' | 'numeric';
  };
  yAxis: {
    label: string;
    unit?: string;
    min?: number;
    max?: number;
  };
}

export interface ChartMetadata {
  updateFrequency: string;
}

// Chart type specific data structures
export interface ContinuousData {
  type: 'continuous';
  currentValue: number;
  trend: 'up' | 'down' | 'stable';
  timeline: Array<{
    date: string;
    value: number;
    event?: string;
  }>;
}

export interface ComparativeData {
  type: 'comparative';
  entities: Array<{
    name: string;
    value: number;
    change?: number;
    color?: string;
  }>;
}

export interface DualProbabilityData {
  type: 'dual-probability';
  probabilities: {
    primary: {
      label: string;
      value: number;
      trend: 'up' | 'down' | 'stable';
      timeline?: Array<{ date: string; value: number }>;
    };
    secondary: {
      label: string;
      value: number;
      trend: 'up' | 'down' | 'stable';
      timeline?: Array<{ date: string; value: number }>;
    };
  };
}

export interface HistoricalLineData {
  type: 'historical-line';
  series: Array<{
    name: string;
    color: string;
    data: Array<{
      date: string;
      value: number;
    }>;
  }>;
}

export type ChartDataPoints = 
  | ContinuousData 
  | ComparativeData 
  | DualProbabilityData 
  | HistoricalLineData;

export interface ChartData {
  id: number;
  title: string;
  type: 'continuous' | 'comparative' | 'dual-probability' | 'historical-line';
  caption: string;
  description: string;
  showInFeed: boolean;
  data: ChartDataPoints;
  axes: ChartAxes;
  metadata?: ChartMetadata;
}

// NEW: Main Belief Interface
export interface Belief {
  id: string;
  isPremier?: boolean; // NEW: For featuring in premier header
  objectRankingScores: ObjectRankingScores;
  heading: HeadingData;
  article: ArticleData;
  charts: ChartData[];
  
  // Legacy fields (keep for backward compatibility)
  category?: string;
  status?: 'resolved' | 'closed';
  createdAt?: string;
}

// Keep existing types but update as needed
export type ComponentVariant = 'card' | 'detail';

// Enhanced types for new card system
export interface CardGroupData {
  id: string;
  title: string;
  subtitle?: string;
  variant: 'featured' | 'accent' | 'primary' | 'mixed' | 'compact';
  beliefs: Belief[];
  layout: 'grid-2' | 'grid-3' | 'grid-4' | 'list';
}

export interface LayoutConfig {
  groupType: 'featured' | 'category' | 'trending' | 'quick';
  cardLayout: 'binary' | 'election' | 'multi-choice' | 'continuous';
  orientation: 'horizontal' | 'vertical' | 'mixed';
}

// Update interfaces for legacy compatibility
export type BaseBelief = Belief;
export interface ContinuousBelief extends Belief {
  type: 'continuous';
}
export interface DiscreteBelief extends Belief {
  type: 'discrete';
}
