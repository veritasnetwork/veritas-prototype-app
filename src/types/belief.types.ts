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

// NEW: Signal and Content Types for Veritas 2.0
export interface SignalDataPoint {
  timestamp: string;              // ISO timestamp
  value: number;                  // Signal value at this time (0-100)
  epochNumber?: number;           // Optional: which epoch this was from
}

export interface Signal {
  key: string;                    // Unique identifier (e.g., 'truth', 'relevance')
  name: string;                    // Display name (e.g., 'Truth Score')
  currentValue: number;            // Current value (0-100)
  historicalData: SignalDataPoint[];
  metadata: {
    contributors: number;          // Number of people who've contributed
    lastUpdated: string;          // ISO timestamp
    stake?: number;               // Optional: total stake on this signal
    volatility?: number;          // Optional: how much it changes
  };
}

export interface SignalCollection {
  [signalKey: string]: Signal;
}

// Content Structure (formerly Belief)
export interface Content {
  id: string;
  
  // Content information (unchanged)
  heading: HeadingData;
  article: ArticleData;
  
  // NEW: Multiple signals replace objectRankingScores
  signals: SignalCollection;
  
  // Metadata
  isPremier?: boolean;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'resolved';
  
  // REMOVED: category (now a signal)
  // REMOVED: objectRankingScores (replaced by signals)
  // REMOVED: charts array (generated from signal data)
}

// Legacy Information Intelligence Structure (kept for backward compatibility)
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

// NEW: Chart data types for new chart system
export interface BeliefChartData {
  [axisName: string]: (string | number)[];
}

export interface ChartConfig {
  id: string;
  beliefId: string;
  type: 'line' | 'bar';
  xAxis: string;
  yAxis: string;
  title: string;
  description: string;
  showInFeed: boolean;
  color?: string;
  order?: number;
}

export interface RenderableChart {
  config: ChartConfig;
  data: Array<{
    x: string | number;
    y: number;
    label?: string;
  }>;
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

// NEW: Main Belief Interface (extends Content for backward compatibility)
export interface Belief extends Content {
  // Legacy fields for backward compatibility during migration
  objectRankingScores?: ObjectRankingScores;
  charts?: ChartData[];
  category?: string;
  // Note: status is inherited from Content with type 'active' | 'resolved'
  // We don't redefine it here to avoid type conflicts
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
