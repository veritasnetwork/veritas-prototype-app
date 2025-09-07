export type PostType = 'text' | 'image' | 'video' | 'longform' | 'opinion';

export interface Signal {
  name: string;
  value: number;
  weight: number;
}

export interface Post {
  id: string;
  type: PostType;
  headline: string;
  content: string;
  thumbnail?: string;
  author: {
    name: string;
    avatar?: string;
  };
  timestamp: Date;
  relevanceScore: number;
  signals: {
    truth: number;
    novelty: number;
    importance: number;
    virality: number;
  };
  sources?: string[];
  discussionCount: number;
  // Opinion-specific fields
  opinion?: {
    yesPercentage: number;
    history?: OpinionHistoryPoint[];
  };
}

export interface OpinionHistoryPoint {
  yesPercentage: number;
  recordedAt: Date;
}