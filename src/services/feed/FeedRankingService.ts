/**
 * Feed Ranking Service
 *
 * Orchestrates feed ranking by:
 * 1. Enriching posts with on-chain pool state (with decay)
 * 2. Applying pluggable ranking strategy
 * 3. Returning sorted posts
 *
 * This service is the main entry point for feed ranking logic.
 */

import type { Post } from '@/types/post.types';
import { PoolStateEnricher, type EnrichmentOptions } from './PoolStateEnricher';
import type { RankingStrategy } from './RankingStrategy';
import { DecayBasedRanking } from './DecayBasedRanking';

export interface FeedRankingOptions {
  /**
   * Ranking strategy to use
   * @default DecayBasedRanking
   */
  strategy?: RankingStrategy;

  /**
   * Whether to enrich posts with on-chain pool state
   * @default true
   */
  enrichWithPoolState?: boolean;

  /**
   * Enrichment options (RPC endpoint, error handling)
   */
  enrichmentOptions?: Partial<EnrichmentOptions>;
}

export class FeedRankingService {
  private readonly defaultStrategy: RankingStrategy = new DecayBasedRanking();

  /**
   * Rank posts for feed display
   *
   * @param posts - Raw posts from database
   * @param options - Ranking configuration
   * @returns Ranked posts with enriched pool state
   */
  async rank(posts: Post[], options: FeedRankingOptions = {}): Promise<Post[]> {
    const {
      strategy = this.defaultStrategy,
      enrichWithPoolState = true,
      enrichmentOptions = {},
    } = options;

    console.log(`[FeedRankingService] Ranking ${posts.length} posts with strategy: ${strategy.name}`);

    // Step 1: Enrich posts with on-chain pool state (if enabled)
    let enrichedPosts = posts;
    if (enrichWithPoolState) {
      try {
        const rpcEndpoint = enrichmentOptions.rpcEndpoint || this.getDefaultRpcEndpoint();

        enrichedPosts = await PoolStateEnricher.enrich(posts, {
          rpcEndpoint,
          skipMissingPools: enrichmentOptions.skipMissingPools ?? true,
          continueOnError: enrichmentOptions.continueOnError ?? true,
        });

        const enrichedCount = enrichedPosts.filter(p => p.decayedPoolState).length;
        console.log(`[FeedRankingService] Enriched ${enrichedCount}/${posts.length} posts with pool state`);
      } catch (error) {
        console.error('[FeedRankingService] Pool enrichment failed:', error);
        // Continue with un-enriched posts
      }
    }

    // Step 2: Apply ranking strategy
    const rankedPosts = strategy.rank(enrichedPosts);

    console.log(`[FeedRankingService] Ranked ${rankedPosts.length} posts`);

    return rankedPosts;
  }

  /**
   * Get default RPC endpoint from environment
   */
  private getDefaultRpcEndpoint(): string {
    // Try environment variables in order of preference
    const endpoint =
      process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT ||
      process.env.SOLANA_RPC_ENDPOINT ||
      'http://127.0.0.1:8899'; // Default to local devnet

    return endpoint;
  }
}

/**
 * Singleton instance for convenience
 */
export const feedRankingService = new FeedRankingService();
