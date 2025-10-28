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
      } catch (error) {
        console.error('[FeedRankingService] Pool enrichment failed:', error);
        // Continue with un-enriched posts
      }
    }

    // Step 2: Filter out broken/dead pools
    // Requirement: Both LONG and SHORT market caps must be >= $1
    // (One side can be low, but not both at the same time)
    const MIN_MARKET_CAP = 1_000_000; // $1 in micro-USDC
    const filteredPosts = enrichedPosts.filter(post => {
      // Keep posts without pools (not yet deployed)
      if (!post.poolAddress) return true;

      // If enrichment succeeded, use enriched data for filtering
      if (post.decayedPoolState) {
        const sLong = post.poolSupplyLong || 0;
        const sShort = post.poolSupplyShort || 0;
        const priceLong = post.decayedPoolState.priceLong || 0; // USDC per token
        const priceShort = post.decayedPoolState.priceShort || 0; // USDC per token

        // Calculate market caps in USDC
        // Market cap = supply (atomic units) * price (USDC per token) = USDC
        const marketCapLongUsdc = sLong * priceLong;
        const marketCapShortUsdc = sShort * priceShort;

        // Convert MIN_MARKET_CAP from micro-USDC to USDC for comparison
        const minMarketCapUsdc = MIN_MARKET_CAP / 1_000_000; // $1

        // Filter out pools where BOTH sides have market cap < $1
        if (marketCapLongUsdc < minMarketCapUsdc && marketCapShortUsdc < minMarketCapUsdc) {
          return false;
        }

        // Also filter out pools with 0 supplies on both sides
        if (sLong === 0 && sShort === 0) return false;
      }

      // If enrichment failed, keep the post (show with cached DB data)
      return true;
    });

    // Step 3: Apply ranking strategy
    const rankedPosts = strategy.rank(filteredPosts);


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
