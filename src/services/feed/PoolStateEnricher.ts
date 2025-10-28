/**
 * Pool State Enricher
 *
 * Fetches on-chain pool state (with decay) and enriches posts with fresh data.
 * Handles batch fetching and error recovery.
 */

import type { Post } from '@/types/post.types';
import { fetchMultiplePoolStatesWithDecay, type PoolStateWithDecay } from '@/lib/solana/fetch-pool-data';

export interface EnrichmentOptions {
  /**
   * Solana RPC endpoint
   */
  rpcEndpoint: string;

  /**
   * Whether to skip enrichment if pool address is missing
   * @default true
   */
  skipMissingPools?: boolean;

  /**
   * Whether to continue on individual pool fetch errors
   * @default true
   */
  continueOnError?: boolean;
}

export class PoolStateEnricher {
  /**
   * Enrich posts with on-chain pool state (including decay)
   *
   * @param posts - Posts to enrich
   * @param options - Enrichment configuration
   * @returns Posts with updated pool state
   */
  static async enrich(
    posts: Post[],
    options: EnrichmentOptions
  ): Promise<Post[]> {
    const { rpcEndpoint, skipMissingPools = true, continueOnError = true } = options;

    // Cache threshold: 60 seconds
    const CACHE_THRESHOLD_MS = 60000;
    const now = Date.now();

    const postsWithPools = posts.filter(p => p.poolAddress);
    const poolsNeedingSync = postsWithPools.filter(post => {
      if (!post.poolAddress) return false;

      if (post.poolLastSyncedAt) {
        const age = now - new Date(post.poolLastSyncedAt).getTime();
        if (age < CACHE_THRESHOLD_MS) {
          return false;
        }
      }
      return true;
    });

    const poolAddresses = poolsNeedingSync.map(p => p.poolAddress!);

    if (poolAddresses.length === 0) {
      return posts;
    }

    try {
      // Batch fetch pool states from chain (with decay)
      const startTime = Date.now();

      const poolStateMap = await fetchMultiplePoolStatesWithDecay(
        poolAddresses,
        rpcEndpoint
      );

      const duration = Date.now() - startTime;

      // Enrich posts with pool state
      return posts.map(post => {
        if (!post.poolAddress) {
          return skipMissingPools ? post : this.markAsUnenriched(post);
        }

        const poolState = poolStateMap.get(post.poolAddress);

        if (!poolState) {
          if (continueOnError) {
            console.warn(`[PoolStateEnricher] Pool state missing for ${post.poolAddress}`);
            return this.markAsUnenriched(post);
          } else {
            return post;
          }
        }

        // Enrich post with fresh pool state
        return this.enrichPost(post, poolState);
      });
    } catch (error) {
      console.error('[PoolStateEnricher] Batch fetch failed:', error);

      if (continueOnError) {
        // Return original posts without enrichment
        return posts.map(post => this.markAsUnenriched(post));
      } else {
        throw error;
      }
    }
  }

  /**
   * Enrich a single post with pool state
   */
  private static enrichPost(post: Post, poolState: PoolStateWithDecay): Post {
    return {
      ...post,
      // Add decayed pool state
      decayedPoolState: {
        q: poolState.q,
        priceLong: poolState.priceLong,
        priceShort: poolState.priceShort,
        daysExpired: poolState.daysExpired,
        daysSinceLastUpdate: poolState.daysSinceLastUpdate,
        decayPending: poolState.decayPending,
        expirationTimestamp: poolState.expirationTimestamp,
        lastDecayUpdate: poolState.lastDecayUpdate,
        vaultBalance: poolState.rLong + poolState.rShort, // Total USDC in vault
      },
      // Update relevance score with decayed q value (0-100 scale)
      relevanceScore: Math.round(poolState.q * 100),
      // Token supplies (atomic units)
      poolSupplyLong: poolState.sLong,
      poolSupplyShort: poolState.sShort,
      // Keep original pool data for backward compatibility
      poolPriceLong: poolState.priceLong,
      poolPriceShort: poolState.priceShort,
    };
  }

  /**
   * Mark post as unenriched (missing pool data)
   */
  private static markAsUnenriched(post: Post): Post {
    return {
      ...post,
      decayedPoolState: null,
    };
  }
}
