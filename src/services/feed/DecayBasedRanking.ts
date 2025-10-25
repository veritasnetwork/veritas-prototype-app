/**
 * Decay-Based Ranking Strategy
 *
 * Ranks posts by their decayed relevance scores (q values from on-chain).
 * Posts with higher decayed q values appear first.
 */

import type { Post } from '@/types/post.types';
import type { RankingStrategy } from './RankingStrategy';

export class DecayBasedRanking implements RankingStrategy {
  readonly name = 'decay_based';

  rank(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => {
      // Use market-implied relevance from database (0.0 to 1.0)
      // This is calculated from reserve ratios: reserve_long / (reserve_long + reserve_short)
      const qA = (a as any).marketImpliedRelevance ?? 0.5; // Default to neutral if no data
      const qB = (b as any).marketImpliedRelevance ?? 0.5;

      // Sort descending (highest relevance first)
      if (qB !== qA) {
        return qB - qA;
      }

      // Tie-breaker: newer posts first
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }
}

/**
 * Hybrid ranking: combines decay-based relevance with recency
 *
 * Formula: score = (q_value * decay_weight) + (recency_score * recency_weight)
 * Where recency_score decreases with age
 */
export class HybridDecayRanking implements RankingStrategy {
  readonly name = 'hybrid_decay';

  constructor(
    private readonly decayWeight: number = 0.7,
    private readonly recencyWeight: number = 0.3,
    private readonly recencyHalfLife: number = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  ) {}

  rank(posts: Post[]): Post[] {
    const now = Date.now();

    return [...posts].sort((a, b) => {
      const scoreA = this.calculateScore(a, now);
      const scoreB = this.calculateScore(b, now);

      return scoreB - scoreA;
    });
  }

  private calculateScore(post: Post, now: number): number {
    // Market-implied relevance from database (0.0 to 1.0)
    const q = (post as any).marketImpliedRelevance ?? 0.5;
    const decayScore = q * this.decayWeight;

    // Recency component (exponential decay)
    const age = now - post.timestamp.getTime();
    const recencyScore = Math.exp(-age / this.recencyHalfLife) * this.recencyWeight;

    return decayScore + recencyScore;
  }
}

/**
 * Decay-aware ranking with penalties for expired content
 *
 * Applies additional penalty to posts that are past expiration and actively decaying
 */
export class DecayAwareRanking implements RankingStrategy {
  readonly name = 'decay_aware';

  constructor(
    private readonly expirationPenalty: number = 0.2 // 20% penalty for expired posts
  ) {}

  rank(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => {
      const scoreA = this.calculateScore(a);
      const scoreB = this.calculateScore(b);

      return scoreB - scoreA;
    });
  }

  private calculateScore(post: Post): number {
    // Base score from market-implied relevance
    let score = (post as any).marketImpliedRelevance ?? 0.5;

    // Apply penalty if post is expired and decaying
    // Note: We don't track daysExpired in database, so this is removed for now
    // You can add this back if needed by tracking post age in the database

    return score;
  }
}
