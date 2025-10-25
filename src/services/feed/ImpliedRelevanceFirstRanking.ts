/**
 * Implied Relevance First Ranking Strategy
 *
 * Ranks posts in two tiers:
 * 1. Posts WITH implied relevance scores - sorted by relevance (highest first)
 * 2. Posts WITHOUT implied relevance scores - sorted by recency (newest first)
 */

import type { Post } from '@/types/post.types';
import type { RankingStrategy } from './RankingStrategy';

export class ImpliedRelevanceFirstRanking implements RankingStrategy {
  readonly name = 'implied_relevance_first';

  rank(posts: Post[]): Post[] {
    // Separate posts into two groups
    const postsWithRelevance: Post[] = [];
    const postsWithoutRelevance: Post[] = [];

    for (const post of posts) {
      const marketImpliedRelevance = (post as any).marketImpliedRelevance;
      if (marketImpliedRelevance !== undefined && marketImpliedRelevance !== null) {
        postsWithRelevance.push(post);
      } else {
        postsWithoutRelevance.push(post);
      }
    }

    // Sort posts with relevance by their implied relevance score (descending)
    postsWithRelevance.sort((a, b) => {
      const qA = (a as any).marketImpliedRelevance;
      const qB = (b as any).marketImpliedRelevance;

      // Sort descending (highest relevance first)
      if (qB !== qA) {
        return qB - qA;
      }

      // Tie-breaker: newer posts first
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Sort posts without relevance by recency (newest first)
    postsWithoutRelevance.sort((a, b) => {
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Return posts with relevance first, then posts without relevance
    return [...postsWithRelevance, ...postsWithoutRelevance];
  }
}