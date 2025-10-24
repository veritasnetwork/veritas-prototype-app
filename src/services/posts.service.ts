/**
 * Posts Service
 * Handles all data fetching and transformation for posts
 */

import { supabase } from '@/lib/supabase';
import type { Post, BeliefHistoryPoint } from '@/types/post.types';
import type { DbPost, DbBeliefHistory } from '@/types/database.types';
import { sqrtPriceX96ToPrice, USDC_PRECISION } from '@/lib/solana/sqrt-price-helpers';
import { feedRankingService } from '@/services/feed';

export class PostsService {
  /**
   * Fetches all posts from Supabase, enriched with on-chain pool state and ranked by relevance
   */
  static async fetchPosts(options?: { limit?: number; offset?: number }): Promise<Post[]> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
      }

      // Query posts directly with joins for user and pool data
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          total_volume_usdc,
          user:users!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          ),
          belief:beliefs!posts_belief_id_fkey (
            previous_aggregate
          ),
          pool_deployments (
            pool_address,
            token_supply,
            reserve,
            f,
            beta_num,
            beta_den,
            long_mint_address,
            short_mint_address,
            s_long_supply,
            s_short_supply,
            sqrt_price_long_x96,
            sqrt_price_short_x96,
            vault_balance
          )
        `)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 15)
        .range(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 15) - 1);

      if (error) {
        throw new Error(error.message || 'Unable to load posts. Please try again.');
      }

      if (!posts || !Array.isArray(posts)) {
        return [];
      }

      // Transform database posts to frontend posts
      const transformedPosts = posts.map(this.transformDbPost);

      // Enrich with on-chain pool state and rank by decay-based relevance
      const rankedPosts = await feedRankingService.rank(transformedPosts, {
        enrichWithPoolState: true,
        // Use default DecayBasedRanking strategy
      });

      return rankedPosts;
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
   * Transforms a database post to frontend post format
   */
  private static transformDbPost(dbPost: any): Post {
    // Extract nested relations - handle both array and single object formats
    const userData = Array.isArray(dbPost.user) ? dbPost.user[0] : dbPost.user;
    const beliefData = Array.isArray(dbPost.belief) ? dbPost.belief[0] : dbPost.belief;
    const poolData = Array.isArray(dbPost.pool_deployments) ? dbPost.pool_deployments[0] : dbPost.pool_deployments;

    // All posts now have beliefs attached
    const aggregate = beliefData?.previous_aggregate ?? 0.5;

    const post: Post = {
      id: dbPost.id,

      // NEW SCHEMA: Use post_type, content_json, media_urls, caption
      post_type: dbPost.post_type,
      content_json: dbPost.content_json,
      media_urls: dbPost.media_urls,
      caption: dbPost.caption,
      content_text: dbPost.content_text,

      // ARTICLE-SPECIFIC FIELDS
      article_title: dbPost.article_title,
      cover_image_url: dbPost.cover_image_url,

      author: {
        username: userData?.username || 'anonymous',
        display_name: userData?.display_name,
        avatar_url: userData?.avatar_url,
        // Legacy fields for backward compatibility
        name: userData?.display_name || userData?.username || 'Unknown',
        avatar: userData?.avatar_url,
      },
      timestamp: new Date(dbPost.created_at),
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
      poolAddress: poolData?.pool_address || null,
      poolF: poolData?.f || 3,
      poolBetaNum: poolData?.beta_num || 1,
      poolBetaDen: poolData?.beta_den || 2,
      // ICBS pool state
      poolSupplyLong: poolData?.s_long_supply ? Number(poolData.s_long_supply) / USDC_PRECISION : null,
      poolSupplyShort: poolData?.s_short_supply ? Number(poolData.s_short_supply) / USDC_PRECISION : null,
      poolPriceLong: poolData?.sqrt_price_long_x96 ? sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96) : null,
      poolPriceShort: poolData?.sqrt_price_short_x96 ? sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96) : null,
      poolSqrtPriceLongX96: poolData?.sqrt_price_long_x96 || null,
      poolSqrtPriceShortX96: poolData?.sqrt_price_short_x96 || null,
      poolVaultBalance: poolData?.vault_balance ? Number(poolData.vault_balance) / USDC_PRECISION : null,
      totalVolumeUsdc: dbPost.total_volume_usdc ? Number(dbPost.total_volume_usdc) : undefined,
    };

    return post;
  }

}