import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our database
export interface Post {
  id: string;
  type: 'text' | 'image' | 'video' | 'longform' | 'opinion';
  headline: string;
  content: string;
  thumbnail?: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
  relevance_score: number;
  // Signals
  truth_signal: number;
  novelty_signal: number;
  importance_signal: number;
  virality_signal: number;
  // Metadata
  discussion_count: number;
  sources?: string[];
  // Opinion-specific fields
  opinion_yes_percentage?: number;
}

// Type for opinion history records
export interface OpinionHistory {
  id: string;
  post_id: string;
  yes_percentage: number;
  recorded_at: string;
  created_at: string;
}