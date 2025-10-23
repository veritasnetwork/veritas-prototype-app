# Feed Ranking System

Modular, strategy-based feed ranking system with on-chain pool state enrichment.

## Architecture

### Components

1. **FeedRankingService** - Main orchestrator
   - Enriches posts with on-chain pool state
   - Applies pluggable ranking strategy
   - Returns sorted posts

2. **PoolStateEnricher** - On-chain data fetcher
   - Batch fetches pool states from Solana (with decay)
   - Enriches posts with `decayedPoolState` field
   - Handles errors gracefully

3. **RankingStrategy** - Interface for ranking algorithms
   - Pluggable strategy pattern
   - Allows A/B testing different algorithms
   - Easy to extend

4. **Built-in Strategies**
   - `ChronologicalRanking` - Newest first
   - `RelevanceRanking` - By cached relevance scores
   - `DecayBasedRanking` - By decayed on-chain q values (default)
   - `HybridDecayRanking` - Decay + recency weighted
   - `DecayAwareRanking` - Decay with expiration penalties

## Usage

### Basic (default strategy)

```typescript
import { feedRankingService } from '@/services/feed';

const rankedPosts = await feedRankingService.rank(posts);
```

### Custom strategy

```typescript
import { feedRankingService, HybridDecayRanking } from '@/services/feed';

const rankedPosts = await feedRankingService.rank(posts, {
  strategy: new HybridDecayRanking(0.8, 0.2), // 80% decay, 20% recency
});
```

### Without pool enrichment (faster, uses cached data)

```typescript
const rankedPosts = await feedRankingService.rank(posts, {
  enrichWithPoolState: false,
  strategy: new RelevanceRanking(),
});
```

## Data Flow

```
Database Posts (Supabase)
        ↓
PostsService.transformDbPost()
        ↓
FeedRankingService.rank()
        ↓
    ┌───────────────────────────────┐
    │  PoolStateEnricher.enrich()   │
    │  - Batch fetch pool states    │
    │  - Add decayedPoolState field │
    └───────────────────────────────┘
        ↓
    ┌───────────────────────────────┐
    │  RankingStrategy.rank()       │
    │  - Sort by strategy logic     │
    └───────────────────────────────┘
        ↓
Ranked Posts (Feed Display)
```

## Performance

- **Batch Fetching**: Fetches 50+ pools in parallel (~150-300ms)
- **Error Resilient**: Continues with un-enriched posts if RPC fails
- **Caching**: PoolStateEnricher can be extended with caching layer
- **Lazy Enrichment**: Can skip enrichment for better performance

## Extending

### Create Custom Strategy

```typescript
import type { RankingStrategy } from '@/services/feed/RankingStrategy';
import type { Post } from '@/types/post.types';

export class MyCustomRanking implements RankingStrategy {
  readonly name = 'my_custom';

  rank(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => {
      // Your custom sorting logic
      return myScore(b) - myScore(a);
    });
  }
}
```

### Use Custom Strategy

```typescript
import { feedRankingService } from '@/services/feed';
import { MyCustomRanking } from './MyCustomRanking';

const rankedPosts = await feedRankingService.rank(posts, {
  strategy: new MyCustomRanking(),
});
```

## Testing

See `tests/services/feed-ranking.test.ts` for examples.

## Environment

Set `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` or `SOLANA_RPC_ENDPOINT` for custom RPC endpoint.
Defaults to `http://127.0.0.1:8899` (local devnet).
