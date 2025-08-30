// Core type definitions for multiple content types
export type ContentType = 'news' | 'opinion' | 'conversation' | 'blog';

export type OpinionType = 'percentage' | 'yes-no' | 'multiple-choice' | 'ranking';

// Import existing types from belief.types.ts for composition
import type {
  HeadingData,
  ArticleData,
  ChartData,
  SignalCollection,
  Content as LegacyContent,
} from './belief.types';

// Base content interface shared by all types
export interface BaseContent {
  id: string;
  type: ContentType;
  heading: HeadingData;
  signals: SignalCollection;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'resolved';
  isPremier?: boolean;
  author?: string;
  tags?: string[];
}

// News Content (existing, refined)
// For backward compatibility, this extends the legacy Content structure
export interface NewsContent extends BaseContent {
  type: 'news';
  article: ArticleData;
  charts?: ChartData[];
  source?: string;
  breakingNews?: boolean;
}

// Opinion Market Content
export interface OpinionContent extends BaseContent {
  type: 'opinion';
  question: string;
  description?: string;
  opinionType: OpinionType;
  
  // For percentage type
  currentValue?: number;
  range?: { min: number; max: number };
  unit?: string; // %, $, etc.
  
  // For yes-no type
  yesPercentage?: number;
  
  // For multiple-choice and ranking
  options?: string[];
  optionVotes?: { [option: string]: number };
  
  // User participation tracking
  totalParticipants: number;
  userPredictions?: Map<string, string | number | boolean | string[]>;
  
  // Resolution
  resolutionDate?: string;
  resolvedValue?: string | number | boolean | string[];
}

// Conversation Content
export interface ConversationContent extends BaseContent {
  type: 'conversation';
  topic: string;
  description: string;
  initialPost?: string;
  
  // Discussion metrics
  commentCount: number;
  participantCount: number;
  lastActivityAt: string;
  
  // Comments will be loaded separately
  featuredComments?: Comment[];
  
  // Moderation
  isLocked?: boolean;
  isPinned?: boolean;
}

// Blog Post Content
export interface BlogContent extends BaseContent {
  type: 'blog';
  article: ArticleData;
  author: string;
  authorBio?: string;
  
  // Blog-specific metadata
  readingTime: number; // in minutes
  wordCount: number;
  tags: string[];
  category: string;
  
  // Engagement
  relatedPosts?: string[]; // IDs of related content
  citations?: Citation[];
}

// Union type for all content - includes legacy for backward compatibility
export type Content = NewsContent | OpinionContent | ConversationContent | BlogContent | LegacyContent;

// Type guards for content types
export const isNewsContent = (content: Content): content is NewsContent => {
  return 'type' in content && content.type === 'news' || !('type' in content);
};

export const isOpinionContent = (content: Content): content is OpinionContent => {
  return 'type' in content && content.type === 'opinion';
};

export const isConversationContent = (content: Content): content is ConversationContent => {
  return 'type' in content && content.type === 'conversation';
};

export const isBlogContent = (content: Content): content is BlogContent => {
  return 'type' in content && content.type === 'blog';
};

// Helper interfaces
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
  parentId?: string;
}

export interface Citation {
  text: string;
  source: string;
  url?: string;
}

// Re-export types from belief.types.ts for backward compatibility
export type {
  Belief,
  Signal,
  SignalCollection,
  SignalDataPoint,
  HeadingData,
  ArticleData,
  ChartData,
  ChartConfig,
  RenderableChart,
  ChartDataPoints,
  ChartAxes,
  ChartMetadata,
  ContinuousData,
  ComparativeData,
  DualProbabilityData,
  HistoricalLineData,
  ObjectRankingScores,
  Category,
  LayoutType,
  FilterStatus,
  SortOption,
  ViewMode,
  ComponentVersion,
  ComponentData,
  ComponentChange,
  ComponentVariant,
  CardGroupData,
  LayoutConfig,
} from './belief.types';