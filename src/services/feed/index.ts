/**
 * Feed Services
 *
 * Modular feed ranking system with pluggable strategies.
 *
 * Usage:
 * ```typescript
 * import { feedRankingService, DecayBasedRanking } from '@/services/feed';
 *
 * const rankedPosts = await feedRankingService.rank(posts);
 * ```
 */

export { FeedRankingService, feedRankingService, type FeedRankingOptions } from './FeedRankingService';
export { PoolStateEnricher, type EnrichmentOptions } from './PoolStateEnricher';
export {
  type RankingStrategy,
  ChronologicalRanking,
  RelevanceRanking,
} from './RankingStrategy';
export {
  DecayBasedRanking,
  HybridDecayRanking,
  DecayAwareRanking,
} from './DecayBasedRanking';
