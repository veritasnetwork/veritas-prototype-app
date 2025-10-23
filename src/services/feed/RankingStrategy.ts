/**
 * Feed Ranking Strategy Interface
 *
 * Defines the contract for feed ranking algorithms.
 * Supports strategy pattern for pluggable ranking logic.
 */

import type { Post } from '@/types/post.types';

/**
 * Strategy interface for ranking posts in the feed
 */
export interface RankingStrategy {
  /**
   * Name of the ranking strategy (for debugging/logging)
   */
  readonly name: string;

  /**
   * Rank posts by applying the strategy's sorting logic
   *
   * @param posts - Array of posts to rank
   * @returns Sorted array of posts
   */
  rank(posts: Post[]): Post[];
}

/**
 * Default ranking strategy - sorts by timestamp (newest first)
 */
export class ChronologicalRanking implements RankingStrategy {
  readonly name = 'chronological';

  rank(posts: Post[]): Post[] {
    return [...posts].sort((a, b) =>
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
}

/**
 * Simple relevance-based ranking using cached relevance scores
 */
export class RelevanceRanking implements RankingStrategy {
  readonly name = 'relevance';

  rank(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      return scoreB - scoreA;
    });
  }
}
