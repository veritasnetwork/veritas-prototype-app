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
    console.log('[ImpliedRelevanceFirstRanking] Starting rank with', posts.length, 'posts');

    // Helper to safely get timestamp
    const getTimestamp = (post: Post): number => {
      try {
        if (post.timestamp instanceof Date) {
          return post.timestamp.getTime();
        }
        if (typeof post.timestamp === 'string') {
          return new Date(post.timestamp).getTime();
        }
        // Fallback to created_at if available
        const createdAt = (post as any).createdAt;
        if (createdAt) {
          return new Date(createdAt).getTime();
        }
        console.warn('[ImpliedRelevanceFirstRanking] Invalid timestamp for post:', post.id);
        return 0;
      } catch (error) {
        console.error('[ImpliedRelevanceFirstRanking] Error parsing timestamp for post:', post.id, error);
        return 0;
      }
    };

    // Separate posts into two groups
    const postsWithRelevance: Post[] = [];
    const postsWithoutRelevance: Post[] = [];

    for (const post of posts) {
      const marketImpliedRelevance = (post as any).marketImpliedRelevance;
      console.log('[ImpliedRelevanceFirstRanking] Checking post:', {
        id: post.id.substring(0, 8),
        relevance: marketImpliedRelevance,
        type: typeof marketImpliedRelevance,
        isUndefined: marketImpliedRelevance === undefined,
        isNull: marketImpliedRelevance === null,
        willUseRelevance: marketImpliedRelevance !== undefined && marketImpliedRelevance !== null
      });
      if (marketImpliedRelevance !== undefined && marketImpliedRelevance !== null) {
        console.log('[ImpliedRelevanceFirstRanking] Post WITH relevance:', {
          id: post.id.substring(0, 8),
          relevance: marketImpliedRelevance,
          timestamp: post.timestamp
        });
        postsWithRelevance.push(post);
      } else {
        postsWithoutRelevance.push(post);
      }
    }

    console.log('[ImpliedRelevanceFirstRanking] Split:', {
      withRelevance: postsWithRelevance.length,
      withoutRelevance: postsWithoutRelevance.length,
      postsWithRelevanceIds: postsWithRelevance.map(p => ({ id: p.id.substring(0, 8), q: (p as any).marketImpliedRelevance })),
      postsWithoutRelevanceIds: postsWithoutRelevance.map(p => p.id.substring(0, 8))
    });

    try {
      // Sort posts with relevance by their implied relevance score (descending)
      postsWithRelevance.sort((a, b) => {
        const qA = (a as any).marketImpliedRelevance;
        const qB = (b as any).marketImpliedRelevance;

        // Sort descending (highest relevance first)
        if (qB !== qA) {
          return qB - qA;
        }

        // Tie-breaker: newer posts first
        return getTimestamp(b) - getTimestamp(a);
      });

      // Sort posts without relevance by recency (newest first)
      postsWithoutRelevance.sort((a, b) => {
        return getTimestamp(b) - getTimestamp(a);
      });
    } catch (error) {
      console.error('[ImpliedRelevanceFirstRanking] Error during sort:', error);
      // Return unsorted posts rather than failing completely
      return posts;
    }

    const result = [...postsWithRelevance, ...postsWithoutRelevance];
    console.log('[ImpliedRelevanceFirstRanking] Returning', result.length, 'posts');

    // Return posts with relevance first, then posts without relevance
    return result;
  }
}