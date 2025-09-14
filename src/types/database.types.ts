/**
 * Database schema types
 * These types represent the structure of data as stored in Supabase
 */

export interface DbPost {
  id: string;
  type: 'text' | 'image' | 'video' | 'longform' | 'opinion';
  headline: string;
  content: string;
  thumbnail?: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
  updated_at: string;
  relevance_score: number;
  truth_signal: number;
  novelty_signal: number;
  importance_signal: number;
  virality_signal: number;
  discussion_count: number;
  sources?: string[];
  opinion_yes_percentage?: number;
}

export interface DbOpinionHistory {
  id: string;
  post_id: string;
  yes_percentage: number;
  recorded_at: string;
  created_at: string;
}