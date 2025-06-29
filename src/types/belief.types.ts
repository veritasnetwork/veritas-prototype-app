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
export type SortOption = 'recent' | 'active' | 'stakes' | 'consensus';
export type FilterStatus = 'all' | 'active' | 'resolved' | 'closed';

export interface ConsensusHistoryPoint {
  timestamp: string;
  consensusLevel: number;
  entropy: number;
}

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

export interface BaseBelief {
  id: string;
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  createdAt: string;
  resolvedAt?: string | null;
  status: 'active' | 'resolved' | 'closed';
  totalStake: number;
  participantCount: number;
  consensusLevel: number; // 0-1 scale
  entropy: number;
  layoutType: LayoutType;
  tags?: string[];
  consensusHistory: ConsensusHistoryPoint[];
  components: {
    heading: ComponentData;
    chart: ComponentData;
    article: ComponentData;
    metadata?: ComponentData;
  };
  resolution?: {
    outcome: string;
    finalProbability: number;
    resolvedBy: string;
  };
}

export interface ContinuousBelief extends BaseBelief {
  type: 'continuous';
  distribution: {
    mean: number;
    variance: number;
    min?: number;
    max?: number;
  };
  unit: string; // e.g., "USD", "°C", etc.
}

export interface DiscreteBelief extends BaseBelief {
  type: 'discrete';
  options: Array<{
    id: string;
    label: string;
    probability: number;
  }>;
}

export type Belief = ContinuousBelief | DiscreteBelief;

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
