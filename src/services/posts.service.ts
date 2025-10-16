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

      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
      }

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
        if (response.status === 503) {
          console.error('⚠️  Edge Functions not running - Start them with: npx supabase functions serve');
          throw new Error('Unable to load posts. Please try again.');
        }
        throw new Error('Unable to load posts. Please try again.');
      }

      const data = await response.json();

      if (!data.posts || !Array.isArray(data.posts)) {
        return [];
      }

      // Transform API posts to frontend posts
      return data.posts.map(this.transformApiPost);
    } catch (error) {
      console.error('Failed to fetch posts:', error);

      // Check if it's a network error (likely services not running)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('⚠️  Cannot connect to Supabase - Is it running? Try: npx supabase start');
        throw new Error('Unable to connect to the server. Please try again.');
      }

      // Re-throw with user-friendly message, but keep technical details in console
      if (error instanceof Error && !error.message.includes('Unable to')) {
        throw new Error('Unable to load posts. Please try again.');
      }

      throw error;
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

      // NEW SCHEMA: Use post_type, content_json, media_urls, caption
      post_type: apiPost.post_type,
      content_json: apiPost.content_json,
      media_urls: apiPost.media_urls,
      caption: apiPost.caption,
      content_text: apiPost.content_text,

      // ARTICLE-SPECIFIC FIELDS
      article_title: apiPost.article_title,
      cover_image_url: apiPost.cover_image_url,

      author: {
        username: apiPost.user?.username || 'anonymous',
        display_name: apiPost.user?.display_name,
        avatar_url: undefined,
        // Legacy fields for backward compatibility
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
      poolTokenSupply: parseFloat(apiPost.pool_token_supply) || 0,
      poolReserveBalance: parseFloat(apiPost.pool_reserve_balance) || 0, // Already in micro-USDC from database
      poolKQuadratic: Number(apiPost.pool_k_quadratic) || 1,
    };

    return post;
  }

}