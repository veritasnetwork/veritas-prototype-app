/**
 * Frontend types for the application
 * These types represent how data is used in the UI
 */

export type PostType = 'text' | 'image' | 'video' | 'longform' | 'opinion';

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

export interface OpinionData {
  yesPercentage: number;
  history?: OpinionHistoryPoint[];
}

export interface OpinionHistoryPoint {
  yesPercentage: number;
  recordedAt: Date;
}

export interface Post {
  id: string;
  type: PostType;
  headline: string;
  content: string;
  thumbnail?: string;
  author: Author;
  timestamp: Date;
  relevanceScore: number;
  signals: PostSignals;
  sources?: string[];
  discussionCount: number;
  opinion?: OpinionData;
}