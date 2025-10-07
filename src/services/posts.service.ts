/**
 * Posts Service
 * Handles all data fetching and transformation for posts
 */

import { supabase } from '@/lib/supabase';
import type { Post, BeliefHistoryPoint } from '@/types/post.types';
import type { DbPost, DbBeliefHistory } from '@/types/database.types';

export class PostsService {
  /**
   * Fetches all posts from the app-post-get-feed API
   */
  static async fetchPosts(): Promise<Post[]> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/app-post-get-feed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: 'default-user', // Fallback user for API requirement
          limit: 50,
          offset: 0
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.posts || !Array.isArray(data.posts)) {
        return [];
      }

      // Transform API posts to frontend posts
      return data.posts.map(this.transformApiPost);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      throw new Error(`Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches belief history for a specific post
   */
  private static async fetchBeliefHistory(postId: string): Promise<BeliefHistoryPoint[]> {
    const { data, error } = await supabase
      .from('belief_history')
      .select('*')
      .eq('post_id', postId)
      .order('recorded_at', { ascending: true })
      .limit(50);

    if (error || !data) {
      return [];
    }

    return data.map((history: DbBeliefHistory) => ({
      yesPercentage: history.yes_percentage,
      recordedAt: new Date(history.recorded_at),
    }));
  }

  /**
   * Transforms an API post to frontend post format
   */
  private static transformApiPost(apiPost: any): Post {
    // All posts now have beliefs attached
    const aggregate = apiPost.belief?.previous_aggregate ?? 0.5;

    const post: Post = {
      id: apiPost.id,
      headline: apiPost.title || 'Untitled',
      content: apiPost.content || '',
      author: {
        name: apiPost.user?.display_name || apiPost.user?.username || 'Unknown',
        avatar: undefined,
      },
      timestamp: new Date(apiPost.created_at),
      relevanceScore: 85,
      signals: {
        truth: 80,
        novelty: 75,
        importance: 70,
        virality: 65,
      },
      sources: [],
      discussionCount: 0,
      belief: {
        yesPercentage: Math.round(aggregate * 100),
        history: undefined,
      },
      poolAddress: apiPost.pool_address,
      poolTokenSupply: apiPost.pool_token_supply,
      poolReserveBalance: apiPost.pool_reserve_balance,
      poolKQuadratic: apiPost.pool_k_quadratic,
    };

    return post;
  }

  /**
   * Transforms a database post to frontend post format (legacy method)
   */
  private static async transformPost(dbPost: DbPost): Promise<Post> {
    const history = await PostsService.fetchBeliefHistory(dbPost.id);

    const post: Post = {
      id: dbPost.id,
      headline: dbPost.headline,
      content: dbPost.content,
      author: {
        name: dbPost.author_name,
        avatar: dbPost.author_avatar,
      },
      timestamp: new Date(dbPost.created_at),
      relevanceScore: dbPost.relevance_score,
      signals: {
        truth: dbPost.truth_signal,
        novelty: dbPost.novelty_signal,
        importance: dbPost.importance_signal,
        virality: dbPost.virality_signal,
      },
      sources: dbPost.sources,
      discussionCount: dbPost.discussion_count,
      belief: {
        yesPercentage: dbPost.belief_yes_percentage,
        history: history.length > 0 ? history : undefined,
      },
    };

    return post;
  }
}