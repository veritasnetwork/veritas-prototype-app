/**
 * Posts Service
 * Handles all data fetching and transformation for posts
 */

import { supabase } from '@/lib/supabase';
import type { Post, OpinionHistoryPoint } from '@/types/post.types';
import type { DbPost, DbOpinionHistory } from '@/types/database.types';

export class PostsService {
  /**
   * Fetches all posts from the app-post-get-feed API
   */
  static async fetchPosts(): Promise<Post[]> {
    try {
      const response = await fetch('http://127.0.0.1:54321/functions/v1/app-post-get-feed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
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
   * Fetches opinion history for a specific post
   */
  private static async fetchOpinionHistory(postId: string): Promise<OpinionHistoryPoint[]> {
    const { data, error } = await supabase
      .from('opinion_history')
      .select('*')
      .eq('post_id', postId)
      .order('recorded_at', { ascending: true })
      .limit(50);

    if (error || !data) {
      return [];
    }

    return data.map((history: DbOpinionHistory) => ({
      yesPercentage: history.yes_percentage,
      recordedAt: new Date(history.recorded_at),
    }));
  }

  /**
   * Transforms an API post to frontend post format
   */
  private static transformApiPost(apiPost: any): Post {
    const post: Post = {
      id: apiPost.id,
      type: apiPost.opinion_belief_id ? 'opinion' : 'news', // Determine type based on opinion_belief_id
      headline: apiPost.title || 'Untitled', // Keep headline for Post type compatibility
      content: apiPost.content || '',
      thumbnail: apiPost.media_urls?.[0] || undefined,
      author: {
        name: apiPost.user?.display_name || apiPost.user?.username || 'Unknown',
        avatar: undefined, // API doesn't provide avatar currently
      },
      timestamp: new Date(apiPost.created_at),
      relevanceScore: 85, // Default fixed score since not provided by API
      signals: {
        truth: 80,
        novelty: 75,
        importance: 70,
        virality: 65,
      },
      sources: [],
      discussionCount: 0,
    };

    // Add opinion data if applicable
    if (apiPost.opinion_belief_id) {
      // Use previous_aggregate from protocol beliefs table (creator's initial belief becomes first previous_aggregate)
      const aggregate = apiPost.belief?.previous_aggregate ?? 0.5; // Fallback until API returns belief data
      post.opinion = {
        yesPercentage: Math.round(aggregate * 100),
        history: undefined, // Could be fetched separately if needed
      };
    }

    return post;
  }

  /**
   * Transforms a database post to frontend post format (legacy method)
   */
  private static async transformPost(dbPost: DbPost): Promise<Post> {
    const post: Post = {
      id: dbPost.id,
      type: dbPost.type,
      headline: dbPost.headline,
      content: dbPost.content,
      thumbnail: dbPost.thumbnail,
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
    };

    // Add opinion data if applicable
    if (dbPost.type === 'opinion' && dbPost.opinion_yes_percentage !== undefined) {
      const history = await PostsService.fetchOpinionHistory(dbPost.id);
      post.opinion = {
        yesPercentage: dbPost.opinion_yes_percentage,
        history: history.length > 0 ? history : undefined,
      };
    }

    return post;
  }
}