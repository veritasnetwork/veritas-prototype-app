/**
 * Posts Service
 * Handles all data fetching and transformation for posts
 */

import { supabase } from '@/lib/supabase';
import type { Post, BeliefHistoryPoint } from '@/types/post.types';
import type { DbPost, DbBeliefHistory } from '@/types/database.types';
import { sqrtPriceX96ToPrice, USDC_PRECISION } from '@/lib/solana/sqrt-price-helpers';
import { feedRankingService, ImpliedRelevanceFirstRanking } from '@/services/feed';

export class PostsService {
  /**
   * Fetches updated metrics for a single post (used for polling the selected post)
   * Returns only the changed fields to minimize data transfer
   */
  static async fetchSinglePostMetrics(postId: string): Promise<Partial<Post> | null> {
    try {
      // Fetch updated pool deployments and volume for the given post
      const { data: post, error } = await supabase
        .from('posts')
        .select(`
          id,
          total_volume_usdc,
          pool_deployments (
            s_long_supply,
            s_short_supply,
            sqrt_price_long_x96,
            sqrt_price_short_x96,
            vault_balance
          )
        `)
        .eq('id', postId)
        .single();

      if (error || !post) {
        console.error('Failed to fetch post metrics:', error);
        return null;
      }

      // Fetch latest implied relevance
      const { data: impliedRelevanceData } = await supabase
        .from('implied_relevance_history')
        .select('implied_relevance')
        .eq('post_id', postId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      // Calculate total volume from trades
      const { data: volumeData } = await supabase
        .from('trades')
        .select('usdc_amount')
        .eq('post_id', postId);

      let totalVolume = 0;
      if (volumeData) {
        totalVolume = volumeData.reduce((sum, trade) => sum + (Number(trade.usdc_amount) / 1_000_000), 0);
      }

      const poolData = Array.isArray(post.pool_deployments)
        ? post.pool_deployments[0]
        : post.pool_deployments;

      const metrics: Partial<Post> & { marketImpliedRelevance?: number } = {
        id: post.id,
        totalVolumeUsdc: totalVolume > 0 ? totalVolume : undefined,
      };

      // Add pool data if available
      if (poolData) {
        metrics.poolSupplyLong = poolData.s_long_supply ? Number(poolData.s_long_supply) / USDC_PRECISION : undefined;
        metrics.poolSupplyShort = poolData.s_short_supply ? Number(poolData.s_short_supply) / USDC_PRECISION : undefined;
        metrics.poolSqrtPriceLongX96 = poolData.sqrt_price_long_x96 || undefined;
        metrics.poolSqrtPriceShortX96 = poolData.sqrt_price_short_x96 || undefined;
        metrics.poolVaultBalance = poolData.vault_balance ? Number(poolData.vault_balance) / USDC_PRECISION : undefined;
      }

      // Add implied relevance if available
      if (impliedRelevanceData?.implied_relevance !== undefined) {
        metrics.marketImpliedRelevance = impliedRelevanceData.implied_relevance;
      }

      return metrics;
    } catch (error) {
      console.error('Failed to fetch post metrics:', error);
      return null;
    }
  }

  /**
   * Fetches updated metrics for a batch of posts (used for polling)
   * Returns only the changed fields to minimize data transfer
   */
  static async fetchPostMetrics(postIds: string[]): Promise<Partial<Post>[]> {
    try {
      if (postIds.length === 0) return [];

      // Fetch updated pool deployments and volume for the given posts
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          id,
          total_volume_usdc,
          pool_deployments (
            s_long_supply,
            s_short_supply,
            sqrt_price_long_x96,
            sqrt_price_short_x96,
            vault_balance
          )
        `)
        .in('id', postIds);

      if (error) {
        console.error('Failed to fetch post metrics:', error);
        return [];
      }

      // Fetch latest implied relevance for all posts
      const { data: impliedRelevanceData } = await supabase
        .from('implied_relevance_history')
        .select('post_id, implied_relevance, recorded_at')
        .in('post_id', postIds)
        .order('recorded_at', { ascending: false });

      // Create a map of post_id -> latest implied_relevance
      const impliedRelevanceMap = new Map<string, number>();
      if (impliedRelevanceData) {
        for (const row of impliedRelevanceData) {
          if (!impliedRelevanceMap.has(row.post_id)) {
            impliedRelevanceMap.set(row.post_id, row.implied_relevance);
          }
        }
      }

      // Calculate total volume from trades for all posts
      const { data: volumeData } = await supabase
        .from('trades')
        .select('post_id, usdc_amount')
        .in('post_id', postIds);

      const volumeMap = new Map<string, number>();
      if (volumeData) {
        for (const trade of volumeData) {
          const currentVolume = volumeMap.get(trade.post_id) || 0;
          volumeMap.set(trade.post_id, currentVolume + (Number(trade.usdc_amount) / 1_000_000));
        }
      }

      // Transform to partial post updates
      return (posts || []).map(dbPost => {
        const poolData = Array.isArray(dbPost.pool_deployments)
          ? dbPost.pool_deployments[0]
          : dbPost.pool_deployments;

        const totalVolume = volumeMap.get(dbPost.id);

        const metrics: Partial<Post> & { marketImpliedRelevance?: number } = {
          id: dbPost.id,
          totalVolumeUsdc: totalVolume || undefined,
        };

        // Add pool data if available
        if (poolData) {
          metrics.poolSupplyLong = poolData.s_long_supply ? Number(poolData.s_long_supply) / USDC_PRECISION : undefined;
          metrics.poolSupplyShort = poolData.s_short_supply ? Number(poolData.s_short_supply) / USDC_PRECISION : undefined;
          metrics.poolSqrtPriceLongX96 = poolData.sqrt_price_long_x96 || undefined;
          metrics.poolSqrtPriceShortX96 = poolData.sqrt_price_short_x96 || undefined;
          metrics.poolVaultBalance = poolData.vault_balance ? Number(poolData.vault_balance) / USDC_PRECISION : undefined;
        }

        // Add implied relevance if available
        const impliedRelevance = impliedRelevanceMap.get(dbPost.id);
        if (impliedRelevance !== undefined) {
          metrics.marketImpliedRelevance = impliedRelevance;
        }

        return metrics;
      });
    } catch (error) {
      console.error('Failed to fetch post metrics:', error);
      return [];
    }
  }

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

      // Query posts with latest implied relevance from database
      // Use LATERAL join to get the most recent implied_relevance for each post
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
        console.error('[PostsService] Error fetching posts:', error);
        throw new Error(error.message || 'Unable to load posts. Please try again.');
      }

      if (!posts || !Array.isArray(posts)) {
        console.log('[PostsService] No posts returned');
        return [];
      }

      console.log('[PostsService] Fetched posts:', posts.length, 'posts');
      console.log('[PostsService] Post types:', posts.map(p => ({ id: p.id, type: p.post_type, title: p.article_title })));

      // Fetch latest implied relevance for all posts in one query
      const postIds = posts.map(p => p.id);
      const { data: impliedRelevanceData } = await supabase
        .from('implied_relevance_history')
        .select('post_id, implied_relevance, recorded_at')
        .in('post_id', postIds)
        .order('recorded_at', { ascending: false });

      // Create a map of post_id -> latest implied_relevance
      const impliedRelevanceMap = new Map<string, number>();
      if (impliedRelevanceData) {
        for (const row of impliedRelevanceData) {
          if (!impliedRelevanceMap.has(row.post_id)) {
            impliedRelevanceMap.set(row.post_id, row.implied_relevance);
          }
        }
      }

      // Fetch total volume for all posts from trades table
      const { data: volumeData } = await supabase
        .from('trades')
        .select('post_id, usdc_amount')
        .in('post_id', postIds);

      // Create a map of post_id -> total volume (sum trades, convert from micro-USDC to USDC)
      const volumeMap = new Map<string, number>();
      if (volumeData) {
        for (const trade of volumeData) {
          const currentVolume = volumeMap.get(trade.post_id) || 0;
          // usdc_amount is in micro-USDC, divide by 1M to get USDC
          volumeMap.set(trade.post_id, currentVolume + (Number(trade.usdc_amount) / 1_000_000));
        }
      }

      // Transform database posts to frontend posts with implied relevance and volume
      const transformedPosts = posts.map(dbPost => {
        const post = this.transformDbPost(dbPost);
        const impliedRelevance = impliedRelevanceMap.get(post.id);
        const totalVolume = volumeMap.get(post.id);

        // Attach implied relevance as marketImpliedRelevance
        if (impliedRelevance !== undefined) {
          (post as any).marketImpliedRelevance = impliedRelevance;
        }

        // Override totalVolumeUsdc with calculated value from trades
        if (totalVolume !== undefined) {
          post.totalVolumeUsdc = totalVolume;
        }

        return post;
      });

      // Rank using ImpliedRelevanceFirst strategy: posts with implied relevance first, then by recency
      const rankedPosts = await feedRankingService.rank(transformedPosts, {
        strategy: new ImpliedRelevanceFirstRanking(),
        enrichWithPoolState: false,  // Use database instead of on-chain
      });

      console.log('[PostsService] Returning ranked posts:', rankedPosts.length, 'posts');
      console.log('[PostsService] Post types after ranking:', rankedPosts.map(p => ({
        id: p.id.substring(0, 8),
        type: p.post_type,
        hasPool: !!p.poolAddress,
        impliedRelevance: (p as any).marketImpliedRelevance
      })));

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

      // MEDIA DIMENSION FIELDS
      media_width: dbPost.media_width,
      media_height: dbPost.media_height,
      aspect_ratio: dbPost.aspect_ratio,

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
      poolSupplyLong: poolData?.s_long_supply ? Number(poolData.s_long_supply) / USDC_PRECISION : undefined,
      poolSupplyShort: poolData?.s_short_supply ? Number(poolData.s_short_supply) / USDC_PRECISION : undefined,
      poolPriceLong: poolData?.sqrt_price_long_x96 ? sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96) : undefined,
      poolPriceShort: poolData?.sqrt_price_short_x96 ? sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96) : undefined,
      poolSqrtPriceLongX96: poolData?.sqrt_price_long_x96 || undefined,
      poolSqrtPriceShortX96: poolData?.sqrt_price_short_x96 || undefined,
      poolVaultBalance: poolData?.vault_balance ? Number(poolData.vault_balance) / USDC_PRECISION : undefined,
      totalVolumeUsdc: dbPost.total_volume_usdc ? Number(dbPost.total_volume_usdc) : undefined,
    };

    return post;
  }

}