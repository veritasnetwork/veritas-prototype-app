/**
 * Database schema types
 * These types represent the structure of data as stored in Supabase
 */

export interface DbPost {
  id: string;
  headline: string;
  content: string;
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
  belief_yes_percentage: number;
}

export interface DbBeliefHistory {
  id: string;
  post_id: string;
  yes_percentage: number;
  recorded_at: string;
  created_at: string;
}