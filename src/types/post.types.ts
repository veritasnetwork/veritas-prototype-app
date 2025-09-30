/**
 * Frontend types for the application
 * These types represent how data is used in the UI
 */

export interface Author {
  name: string;
  avatar?: string;
}

export interface PostSignals {
  truth: number;
  novelty: number;
  importance: number;
  virality: number;
}

export interface BeliefData {
  yesPercentage: number;
  history?: BeliefHistoryPoint[];
}

export interface BeliefHistoryPoint {
  yesPercentage: number;
  recordedAt: Date;
}

export interface Post {
  id: string;
  headline: string;
  content: string;
  author: Author;
  timestamp: Date;
  relevanceScore: number;
  signals: PostSignals;
  sources?: string[];
  discussionCount: number;
  belief: BeliefData;
}