/**
 * Posts Service
 * Handles all data fetching and transformation for posts
 */

import { supabase } from '@/lib/supabase';
import type { Post, OpinionHistoryPoint } from '@/types/post.types';
import type { DbPost, DbOpinionHistory } from '@/types/database.types';

export class PostsService {
  /**
   * Fetches all posts from the database
   */
  static async fetchPosts(): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Transform database posts to frontend posts
    return Promise.all(data.map(this.transformPost));
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
   * Transforms a database post to frontend post format
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